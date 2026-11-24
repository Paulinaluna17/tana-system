-- =====================================================================
-- Funciones auxiliares, triggers, vistas y RPCs
-- =====================================================================

-- ---------- Fecha "hoy" en Argentina ----------
create or replace function public.ar_today() returns date
language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- ---------- Permisos ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_tana_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where workspace_id = ws and user_id = auth.uid())
$$;

create or replace function public.is_editor(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where workspace_id = ws and user_id = auth.uid() and role = 'client_editor'
  )
$$;

-- ¿El cliente puede ver esta pieza? (borradores ocultos hasta que el mes se envía o la pieza se publica)
create or replace function public.item_visible_to_client(p_status public.content_status, p_visible boolean, p_month uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_status not in ('idea', 'en_redaccion')
    and (
      p_visible
      or p_month is null
      or exists (select 1 from public.months m where m.id = p_month and m.status <> 'borrador')
    )
$$;

create or replace function public.can_see_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.content_items ci
    where ci.id = p_item
      and public.is_member(ci.workspace_id)
      and public.item_visible_to_client(ci.status, ci.is_visible_to_client, ci.month_id)
  )
$$;

-- ---------- Estado de cuota (semáforo) ----------
-- Misma lógica que lib/status.ts → getInvoiceStatus()
create or replace function public.invoice_status(
  p_paid_at timestamptz, p_reported_at timestamptz, p_due date, p_override text, p_today date default public.ar_today()
) returns text language sql immutable as $$
  select case
    when p_override = 'anulada' then 'anulada'
    when p_paid_at is not null then 'pagado'
    when p_reported_at is not null then 'informado'
    when p_due < p_today then 'vencido'
    when p_due - p_today <= 3 then 'por_vencer'
    else 'pendiente'
  end
$$;

create or replace view public.invoices_view with (security_invoker = true) as
select i.*,
  public.invoice_status(i.paid_at, i.reported_at, i.due_date, i.status_override) as computed_status,
  (i.due_date - public.ar_today()) as days_to_due
from public.invoices i;

-- ---------- Perfil automático al crear usuario ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Notificaciones ----------
create or replace function public.notify_users(
  p_users uuid[], p_ws uuid, p_type text, p_title text, p_body text, p_link text, p_dedupe text default null
) returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  foreach u in array coalesce(p_users, '{}') loop
    if u is distinct from auth.uid() then
      insert into public.notifications (user_id, workspace_id, type, title, body, link, dedupe_key)
      values (u, p_ws, p_type, p_title, p_body, p_link, p_dedupe)
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end loop;
end $$;

create or replace function public.admin_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where is_tana_admin
$$;

create or replace function public.member_ids(ws uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.memberships where workspace_id = ws
$$;

create or replace function public.ws_slug(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select slug from public.workspaces where id = ws
$$;

create or replace function public.log_activity(
  p_ws uuid, p_entity text, p_entity_id uuid, p_action text, p_summary text,
  p_data jsonb default '{}'::jsonb, p_client_visible boolean default true
) returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (workspace_id, actor_id, entity, entity_id, action, summary, data, client_visible)
  values (p_ws, auth.uid(), p_entity, p_entity_id, p_action, p_summary, p_data, p_client_visible)
$$;

create or replace function public.status_label(s public.content_status) returns text
language sql immutable as $$
  select case s
    when 'idea' then 'Idea' when 'en_redaccion' then 'En redacción'
    when 'para_revisar' then 'Para que revises' when 'cambios_solicitados' then 'Cambios pedidos'
    when 'aprobado' then 'Aprobado' when 'en_produccion' then 'Para grabar / en producción'
    when 'material_recibido' then 'Material recibido' when 'en_edicion' then 'En diseño / edición'
    when 'listo' then 'Listo para publicar' when 'publicado' then 'Publicado'
    when 'cancelado' then 'Cancelado' when 'reemplazado' then 'Reemplazado' end
$$;

create or replace function public.item_label(p_item uuid) returns text
language sql stable security definer set search_path = public as $$
  select ct.label || ' del ' ||
    to_char(ci.publish_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') ||
    case when ci.title <> '' then ' · "' || left(ci.title, 60) || '"' else '' end
  from public.content_items ci join public.content_types ct on ct.id = ci.content_type_id
  where ci.id = p_item
$$;

-- ---------- Trigger: versiones, "Actualizado" y actividad ----------
create or replace function public.content_items_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tracked text[] := array['publish_at','content_type_id','title','objective','audience','format',
    'recording_instructions','script','slides','caption','cta','hashtags','mentions','location',
    'client_material_request','client_material_due','clarifications','final_asset_url','networks'];
  col text; changed boolean := false;
  o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  foreach col in array tracked loop
    if o -> col is distinct from n -> col then changed := true; end if;
  end loop;
  -- Si Tana cambia el contenido de una pieza que el cliente ya veía, se marca "Actualizado" por 7 días.
  if changed and public.is_admin()
     and public.item_visible_to_client(old.status, old.is_visible_to_client, old.month_id) then
    new.client_changed_at := now();
    new.updated_flag_until := now() + interval '7 days';
  end if;
  return new;
end $$;

create trigger content_items_bu before update on public.content_items
for each row execute function public.content_items_before_update();

create or replace function public.content_items_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tracked text[] := array['publish_at','content_type_id','status','title','objective','audience','format',
    'recording_instructions','shot_list','script','slides','caption','cta','hashtags','mentions','location',
    'client_material_request','client_material_due','clarifications','final_asset_url','published_url',
    'networks','pillar_id','series_id','production_owner','production_person'];
  col text; diff jsonb := '{}'::jsonb;
  o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
  lbl text; slug text;
begin
  foreach col in array tracked loop
    if o -> col is distinct from n -> col then
      diff := diff || jsonb_build_object(col, jsonb_build_object('before', o -> col, 'after', n -> col));
    end if;
  end loop;
  if diff = '{}'::jsonb then return new; end if;

  insert into public.content_versions (content_item_id, workspace_id, changed_by, diff)
  values (new.id, new.workspace_id, auth.uid(), diff);

  lbl := public.item_label(new.id);
  slug := public.ws_slug(new.workspace_id);

  if old.status is distinct from new.status then
    if not public.is_admin() then return new; end if; -- las RPCs del cliente registran su propia actividad
    perform public.log_activity(new.workspace_id, 'content_item', new.id, 'status',
      lbl || ': ' || public.status_label(old.status) || ' → ' || public.status_label(new.status),
      jsonb_build_object('from', old.status, 'to', new.status),
      public.item_visible_to_client(new.status, new.is_visible_to_client, new.month_id));
    if new.status = 'para_revisar'
       and public.item_visible_to_client(new.status, new.is_visible_to_client, new.month_id) then
      perform public.notify_users(public.member_ids(new.workspace_id), new.workspace_id, 'para_revisar',
        'Tenés una pieza para revisar', lbl, '/portal/' || slug || '/pieza/' || new.id);
    end if;
  elsif public.is_admin() and new.client_changed_at is distinct from old.client_changed_at then
    perform public.log_activity(new.workspace_id, 'content_item', new.id, 'updated',
      'Tana actualizó ' || lbl, jsonb_build_object('fields', (select jsonb_agg(k) from jsonb_object_keys(diff) k)), true);
    perform public.notify_users(public.member_ids(new.workspace_id), new.workspace_id, 'pieza_actualizada',
      'Se actualizó una pieza', lbl, '/portal/' || slug || '/pieza/' || new.id,
      'upd:' || new.id || ':' || to_char(now(), 'YYYYMMDDHH24'));
  elsif not public.is_admin() then
    null; -- cambios del cliente se registran en sus RPCs
  else
    perform public.log_activity(new.workspace_id, 'content_item', new.id, 'edited',
      'Se editó ' || lbl, jsonb_build_object('fields', (select jsonb_agg(k) from jsonb_object_keys(diff) k)), false);
  end if;
  return new;
end $$;

create trigger content_items_au after update on public.content_items
for each row execute function public.content_items_after_update();

create or replace function public.content_items_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(new.workspace_id, 'content_item', new.id, 'created',
    'Nueva pieza: ' || public.item_label(new.id), '{}'::jsonb,
    public.item_visible_to_client(new.status, new.is_visible_to_client, new.month_id));
  return new;
end $$;

create trigger content_items_ai after insert on public.content_items
for each row execute function public.content_items_after_insert();

-- ---------- Trigger: comentarios → notificaciones ----------
create or replace function public.comments_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare lbl text := public.item_label(new.content_item_id); slug text := public.ws_slug(new.workspace_id);
begin
  if new.kind <> 'comment' then return new; end if;
  if public.is_admin() then
    if not new.is_internal then
      perform public.notify_users(public.member_ids(new.workspace_id), new.workspace_id, 'comentario',
        'Tana te escribió en una pieza', lbl || ': ' || left(new.body, 140),
        '/portal/' || slug || '/pieza/' || new.content_item_id);
    end if;
  else
    perform public.notify_users(public.admin_ids(), new.workspace_id, 'comentario',
      'Comentario nuevo del cliente', lbl || ': ' || left(new.body, 140),
      '/clientes/' || slug || '/pieza/' || new.content_item_id);
  end if;
  perform public.log_activity(new.workspace_id, 'comment', new.content_item_id, 'commented',
    'Comentario en ' || lbl, '{}'::jsonb, not new.is_internal);
  return new;
end $$;

create trigger comments_ai after insert on public.comments
for each row execute function public.comments_after_insert();

-- =====================================================================
-- RPCs del cliente (únicas acciones de escritura que tiene el cliente)
-- =====================================================================
create or replace function public.assert_editor_for_item(p_item uuid) returns public.content_items
language plpgsql stable security definer set search_path = public as $$
declare r public.content_items;
begin
  select * into r from public.content_items where id = p_item;
  if r.id is null or not public.can_see_item(p_item) then
    raise exception 'Pieza no encontrada';
  end if;
  if not (public.is_admin() or public.is_editor(r.workspace_id)) then
    raise exception 'No tenés permiso para esta acción';
  end if;
  return r;
end $$;

create or replace function public.client_approve_item(p_item uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.content_items; lbl text;
begin
  r := public.assert_editor_for_item(p_item);
  if r.status not in ('para_revisar', 'cambios_solicitados') then
    raise exception 'Esta pieza no está esperando aprobación';
  end if;
  update public.content_items set status = 'aprobado' where id = p_item;
  insert into public.approvals (workspace_id, content_item_id, user_id, action, note)
  values (r.workspace_id, p_item, auth.uid(), 'aprobado', nullif(trim(p_note), ''));
  if nullif(trim(p_note), '') is not null then
    insert into public.comments (content_item_id, workspace_id, author_id, body, kind)
    values (p_item, r.workspace_id, auth.uid(), trim(p_note), 'approval');
  end if;
  lbl := public.item_label(p_item);
  perform public.log_activity(r.workspace_id, 'content_item', p_item, 'approved', 'Aprobada: ' || lbl);
  perform public.notify_users(public.admin_ids(), r.workspace_id, 'aprobado', 'El cliente aprobó una pieza',
    lbl, '/clientes/' || public.ws_slug(r.workspace_id) || '/pieza/' || p_item);
end $$;

create or replace function public.client_request_changes(p_item uuid, p_note text) returns int
language plpgsql security definer set search_path = public as $$
declare r public.content_items; lbl text; rounds int; included int;
begin
  if p_note is null or length(trim(p_note)) < 3 then
    raise exception 'Contanos qué querés cambiar';
  end if;
  r := public.assert_editor_for_item(p_item);
  if r.status in ('publicado', 'cancelado', 'reemplazado') then
    raise exception 'Esta pieza ya no se puede modificar';
  end if;
  rounds := r.revision_count + 1;
  update public.content_items set status = 'cambios_solicitados', revision_count = rounds where id = p_item;
  insert into public.approvals (workspace_id, content_item_id, user_id, action, note)
  values (r.workspace_id, p_item, auth.uid(), 'cambios', trim(p_note));
  insert into public.comments (content_item_id, workspace_id, author_id, body, kind)
  values (p_item, r.workspace_id, auth.uid(), trim(p_note), 'change_request');
  select revision_rounds into included from public.workspaces where id = r.workspace_id;
  lbl := public.item_label(p_item);
  perform public.log_activity(r.workspace_id, 'content_item', p_item, 'changes_requested',
    'Cambios pedidos (ronda ' || rounds || ' de ' || included || '): ' || lbl, jsonb_build_object('note', p_note));
  perform public.notify_users(public.admin_ids(), r.workspace_id, 'cambios', 'El cliente pidió cambios',
    lbl || ': ' || left(p_note, 160), '/clientes/' || public.ws_slug(r.workspace_id) || '/pieza/' || p_item);
  return rounds;
end $$;

create or replace function public.client_mark_material_sent(p_item uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.content_items; lbl text;
begin
  r := public.assert_editor_for_item(p_item);
  update public.content_items
  set client_material_sent_at = now(),
      client_material_note = nullif(trim(p_note), ''),
      status = case when status in ('aprobado', 'en_produccion') then 'material_recibido'::public.content_status else status end
  where id = p_item;
  insert into public.comments (content_item_id, workspace_id, author_id, body, kind)
  values (p_item, r.workspace_id, auth.uid(), coalesce(nullif(trim(p_note), ''), 'Material enviado ✔'), 'material');
  lbl := public.item_label(p_item);
  perform public.log_activity(r.workspace_id, 'content_item', p_item, 'material_sent', 'Material enviado: ' || lbl);
  perform public.notify_users(public.admin_ids(), r.workspace_id, 'material', 'El cliente mandó material',
    lbl, '/clientes/' || public.ws_slug(r.workspace_id) || '/pieza/' || p_item);
end $$;

create or replace function public.client_toggle_shot(p_item uuid, p_index int, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.content_items;
begin
  r := public.assert_editor_for_item(p_item);
  if p_index < 0 or p_index >= jsonb_array_length(r.shot_list) then
    raise exception 'Toma inexistente';
  end if;
  update public.content_items
  set shot_list = jsonb_set(shot_list, array[p_index::text, 'done'], to_jsonb(p_done))
  where id = p_item;
end $$;

create or replace function public.client_approve_month(p_month uuid) returns int
language plpgsql security definer set search_path = public as $$
declare m public.months; n int;
begin
  select * into m from public.months where id = p_month;
  if m.id is null or not (public.is_admin() or public.is_editor(m.workspace_id)) then
    raise exception 'No tenés permiso para esta acción';
  end if;
  if m.status = 'borrador' then raise exception 'Este mes todavía no fue enviado'; end if;
  with upd as (
    update public.content_items set status = 'aprobado'
    where month_id = p_month and status in ('para_revisar', 'cambios_solicitados')
    returning id
  ) select count(*) into n from upd;
  update public.months set status = 'aprobado', approved_at = now(), approved_by = auth.uid() where id = p_month;
  insert into public.approvals (workspace_id, month_id, user_id, action) values (m.workspace_id, p_month, auth.uid(), 'aprobado');
  perform public.log_activity(m.workspace_id, 'month', p_month, 'month_approved',
    'Mes aprobado completo (' || to_char(make_date(m.year, m.month, 1), 'MM/YYYY') || ')');
  perform public.notify_users(public.admin_ids(), m.workspace_id, 'mes_aprobado', 'El cliente aprobó todo el mes',
    to_char(make_date(m.year, m.month, 1), 'MM/YYYY'), '/clientes/' || public.ws_slug(m.workspace_id) || '/calendario');
  return n;
end $$;

create or replace function public.client_report_payment(
  p_invoice uuid, p_receipt_path text, p_method text default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice;
  if inv.id is null or not (public.is_admin() or public.is_editor(inv.workspace_id)) then
    raise exception 'No tenés permiso para esta acción';
  end if;
  if inv.paid_at is not null then raise exception 'Esta cuota ya figura como pagada'; end if;
  if p_receipt_path is null or p_receipt_path not like inv.workspace_id::text || '/%' then
    raise exception 'Adjuntá el comprobante';
  end if;
  update public.invoices set reported_at = now(), receipt_path = p_receipt_path,
    method = coalesce(nullif(trim(p_method), ''), method), reported_note = nullif(trim(p_note), '')
  where id = p_invoice;
  perform public.log_activity(inv.workspace_id, 'invoice', p_invoice, 'payment_reported',
    'Pago informado: ' || to_char(inv.period, 'MM/YYYY'));
  perform public.notify_users(public.admin_ids(), inv.workspace_id, 'pago_informado', 'El cliente informó un pago',
    to_char(inv.period, 'MM/YYYY') || ' · $ ' || inv.amount, '/clientes/' || public.ws_slug(inv.workspace_id) || '/presupuesto');
end $$;

create or replace function public.mark_item_seen(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_see_item(p_item) then return; end if;
  insert into public.item_views (user_id, content_item_id, seen_at) values (auth.uid(), p_item, now())
  on conflict (user_id, content_item_id) do update set seen_at = now();
end $$;

create or replace function public.mark_workspace_seen(p_ws uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare prev timestamptz;
begin
  select last_seen_at into prev from public.memberships where workspace_id = p_ws and user_id = auth.uid();
  update public.memberships set last_seen_at = now() where workspace_id = p_ws and user_id = auth.uid();
  return prev;
end $$;

-- ---------- Vista pública por link (solo lectura, sin notas internas) ----------
create or replace function public.get_shared_month(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.months; res jsonb;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into m from public.months where share_token = p_token and status <> 'borrador';
  if m.id is null then return null; end if;
  select jsonb_build_object(
    'month', jsonb_build_object('id', m.id, 'year', m.year, 'month', m.month, 'status', m.status, 'intro', m.intro),
    'workspace', (select jsonb_build_object('name', w.name, 'slug', w.slug, 'logo_url', w.logo_url, 'brand', w.brand,
        'how_to_read_md', w.how_to_read_md, 'calendar_note', w.calendar_note) from public.workspaces w where w.id = m.workspace_id),
    'types', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sort), '[]') from public.content_types t where t.workspace_id = m.workspace_id),
    'items', (select coalesce(jsonb_agg(
        to_jsonb(ci) - 'metrics' - 'created_by' - 'updated_by' - 'client_material_note' order by ci.publish_at), '[]')
      from public.content_items ci
      where ci.month_id = m.id and ci.status not in ('idea', 'en_redaccion', 'cancelado', 'reemplazado'))
  ) into res;
  return res;
end $$;
grant execute on function public.get_shared_month(text) to anon, authenticated;
