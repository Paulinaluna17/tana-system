-- =====================================================================
-- Row Level Security: Tana (admin) ve todo; cada cliente solo su workspace.
-- Las escrituras del cliente pasan únicamente por las RPCs (security definer).
-- =====================================================================

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.content_types enable row level security;
alter table public.pillars enable row level security;
alter table public.series enable row level security;
alter table public.template_slots enable row level security;
alter table public.months enable row level security;
alter table public.content_items enable row level security;
alter table public.content_internal enable row level security;
alter table public.content_versions enable row level security;
alter table public.item_views enable row level security;
alter table public.comments enable row level security;
alter table public.approvals enable row level security;
alter table public.assets enable row level security;
alter table public.idea_bank enable row level security;
alter table public.piece_templates enable row level security;
alter table public.services enable row level security;
alter table public.workspace_services enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;

-- Workspaces
create policy ws_select on public.workspaces for select to authenticated
  using (public.is_admin() or public.is_member(id));
create policy ws_admin_all on public.workspaces for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profiles: uno mismo, Tana, o personas que comparten workspace (para mostrar nombres en comentarios)
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid() or public.is_admin() or is_tana_admin
    or exists (
      select 1 from public.memberships a join public.memberships b on a.workspace_id = b.workspace_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid() and is_tana_admin = (select p.is_tana_admin from public.profiles p where p.id = auth.uid()))
  );
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.is_admin());

-- Memberships
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or public.is_member(workspace_id));
create policy memberships_admin_all on public.memberships for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catálogos del cliente: lectura miembros, escritura admin
create policy ct_select on public.content_types for select to authenticated using (public.is_admin() or public.is_member(workspace_id));
create policy ct_admin on public.content_types for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pillars_select on public.pillars for select to authenticated using (public.is_admin() or public.is_member(workspace_id));
create policy pillars_admin on public.pillars for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy series_select on public.series for select to authenticated using (public.is_admin() or public.is_member(workspace_id));
create policy series_admin on public.series for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy slots_select on public.template_slots for select to authenticated using (public.is_admin() or public.is_member(workspace_id));
create policy slots_admin on public.template_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Meses: el cliente solo ve meses ya enviados
create policy months_select on public.months for select to authenticated
  using (public.is_admin() or (public.is_member(workspace_id) and status <> 'borrador'));
create policy months_admin on public.months for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Piezas
create policy items_select on public.content_items for select to authenticated
  using (
    public.is_admin()
    or (public.is_member(workspace_id) and public.item_visible_to_client(status, is_visible_to_client, month_id))
  );
create policy items_admin on public.content_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notas internas: SOLO Tana
create policy internal_admin on public.content_internal for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Versiones
create policy versions_select on public.content_versions for select to authenticated
  using (public.can_see_item(content_item_id));

-- Vistas de piezas (propias)
create policy views_own on public.item_views for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Comentarios: el cliente nunca ve los internos
create policy comments_select on public.comments for select to authenticated
  using (public.is_admin() or (not is_internal and public.can_see_item(content_item_id)));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and kind = 'comment'
    and (
      public.is_admin()
      or (not is_internal and public.is_member(workspace_id) and public.can_see_item(content_item_id)
          and workspace_id = (select ci.workspace_id from public.content_items ci where ci.id = content_item_id))
    )
  );
create policy comments_admin_delete on public.comments for delete to authenticated using (public.is_admin());

-- Aprobaciones (solo lectura; se crean vía RPC)
create policy approvals_select on public.approvals for select to authenticated
  using (public.is_admin() or public.is_member(workspace_id));

-- Archivos subidos
create policy assets_select on public.assets for select to authenticated
  using (public.is_admin() or (public.is_member(workspace_id) and (content_item_id is null or public.can_see_item(content_item_id))));
create policy assets_insert on public.assets for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (public.is_admin() or (public.is_editor(workspace_id) and kind = 'material'
         and (content_item_id is null or public.can_see_item(content_item_id))))
  );
create policy assets_admin on public.assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Solo Tana
create policy ideas_admin on public.idea_bank for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ptpl_admin on public.piece_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Servicios: catálogo legible por usuarios logueados; escritura Tana
create policy services_select on public.services for select to authenticated using (true);
create policy services_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy wss_select on public.workspace_services for select to authenticated using (public.is_admin() or public.is_member(workspace_id));
create policy wss_admin on public.workspace_services for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Cuotas
create policy invoices_select on public.invoices for select to authenticated using (public.is_admin() or public.is_member(workspace_id));
create policy invoices_admin on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notificaciones propias
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Actividad
create policy activity_select on public.activity_log for select to authenticated
  using (public.is_admin() or (public.is_member(workspace_id) and client_visible));

-- Permisos de RPCs: solo usuarios logueados
revoke execute on function public.client_approve_item(uuid, text) from public, anon;
revoke execute on function public.client_request_changes(uuid, text) from public, anon;
revoke execute on function public.client_mark_material_sent(uuid, text) from public, anon;
revoke execute on function public.client_toggle_shot(uuid, int, boolean) from public, anon;
revoke execute on function public.client_approve_month(uuid) from public, anon;
revoke execute on function public.client_report_payment(uuid, text, text, text) from public, anon;
revoke execute on function public.notify_users(uuid[], uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.log_activity(uuid, text, uuid, text, text, jsonb, boolean) from public, anon, authenticated;

-- Realtime: el cliente ve los cambios al instante (Realtime respeta RLS)
alter publication supabase_realtime add table public.content_items;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.invoices;

create or replace function public.try_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- =====================================================================
-- Storage: buckets privados con carpeta por workspace ({workspace_id}/...)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', false, 524288000),
       ('receipts', 'receipts', false, 20971520),
       ('logos', 'logos', true, 5242880)
on conflict (id) do nothing;

create policy "storage read own workspace" on storage.objects for select to authenticated
  using (
    bucket_id in ('assets', 'receipts')
    and (public.is_admin() or public.is_member(public.try_uuid((storage.foldername(name))[1])))
  );
create policy "storage upload own workspace" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('assets', 'receipts')
    and (public.is_admin() or public.is_editor(public.try_uuid((storage.foldername(name))[1])))
  );
create policy "storage admin all" on storage.objects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "logos public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'logos');
