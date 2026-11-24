"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin, getSession } from "@/lib/auth";
import { arTime, arToUtc, arDateKey, isoWeekday, monthRangeUtc, shiftMonth } from "@/lib/dates";
import { generateMonthSlots, mapToSameWeekdayOccurrence } from "@/lib/generate";
import { dispatchPendingEmails } from "@/lib/notify";
import { randomToken } from "@/lib/utils";
import type { ContentStatus, TemplateSlot } from "@/lib/types";

type Result = { error?: string; ok?: boolean; count?: number; message?: string } | undefined;

const STATUSES = [
  "idea", "en_redaccion", "para_revisar", "cambios_solicitados", "aprobado", "en_produccion",
  "material_recibido", "en_edicion", "listo", "publicado", "cancelado", "reemplazado",
] as const;

const uuid = z.string().uuid();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function refresh() {
  revalidatePath("/", "layout");
}

function sendEmailsLater() {
  after(async () => {
    try {
      await dispatchPendingEmails();
    } catch (e) {
      console.error("dispatch emails", e);
    }
  });
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Algo salió mal. Probá de nuevo.";
}

export async function ensureMonth(supabase: SupabaseClient, workspaceId: string, year: number, month: number) {
  const { data: existing } = await supabase
    .from("months")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from("months")
    .insert({ workspace_id: workspaceId, year, month })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function wsSlug(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).single();
  return data?.slug as string;
}

// ------------------------------------------------------------------
// Tana: crear / mover / editar
// ------------------------------------------------------------------
export async function createItemAt(workspaceId: string, date: string, typeKey?: string): Promise<Result> {
  await assertAdmin();
  if (!uuid.safeParse(workspaceId).success || !dateKey.safeParse(date).success) return { error: "Datos inválidos" };
  const supabase = await createClient();
  const { data: types } = await supabase
    .from("content_types")
    .select("id, key")
    .eq("workspace_id", workspaceId)
    .order("sort");
  const type = types?.find((t) => t.key === typeKey) ?? types?.[0];
  if (!type) return { error: "Este cliente no tiene tipos de pieza configurados." };
  const { data: slot } = await supabase
    .from("template_slots")
    .select("time")
    .eq("workspace_id", workspaceId)
    .eq("content_type_id", type.id)
    .eq("weekday", isoWeekday(date))
    .maybeSingle();
  const [y, m] = date.split("-").map(Number);
  const monthId = await ensureMonth(supabase, workspaceId, y, m);
  const { data: ws } = await supabase.from("workspaces").select("slug, production_mode").eq("id", workspaceId).single();
  const { data, error } = await supabase
    .from("content_items")
    .insert({
      workspace_id: workspaceId,
      month_id: monthId,
      content_type_id: type.id,
      publish_at: arToUtc(date, (slot?.time as string | undefined)?.slice(0, 5) ?? "19:00").toISOString(),
      status: "idea",
      production_owner: ws?.production_mode ?? "tana",
    })
    .select("id")
    .single();
  if (error) return { error: errMsg(error) };
  refresh();
  redirect(`/clientes/${ws?.slug}/pieza/${data.id}`);
}

export async function moveItem(id: string, newDate: string): Promise<Result> {
  await assertAdmin();
  if (!uuid.safeParse(id).success || !dateKey.safeParse(newDate).success) return { error: "Datos inválidos" };
  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("publish_at, workspace_id").eq("id", id).single();
  if (!item) return { error: "No encontramos la pieza" };
  const [y, m] = newDate.split("-").map(Number);
  const monthId = await ensureMonth(supabase, item.workspace_id, y, m);
  const { error } = await supabase
    .from("content_items")
    .update({ publish_at: arToUtc(newDate, arTime(item.publish_at)).toISOString(), month_id: monthId })
    .eq("id", id);
  if (error) return { error: errMsg(error) };
  sendEmailsLater();
  refresh();
  return { ok: true };
}

export async function setItemStatus(id: string, status: ContentStatus): Promise<Result> {
  await assertAdmin();
  if (!uuid.safeParse(id).success || !STATUSES.includes(status)) return { error: "Datos inválidos" };
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").update({ status }).eq("id", id);
  if (error) return { error: errMsg(error) };
  sendEmailsLater();
  refresh();
  return { ok: true };
}

const itemSchema = z.object({
  content_type_id: uuid,
  date: dateKey,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  networks: z.array(z.string().max(30)).max(8),
  status: z.enum(STATUSES),
  pillar_id: uuid.nullable(),
  series_id: uuid.nullable(),
  production_owner: z.enum(["tana", "cliente", "mixto"]),
  production_person: z.string().max(200).nullable(),
  title: z.string().max(300),
  objective: z.string().max(4000).nullable(),
  audience: z.string().max(2000).nullable(),
  format: z.object({
    ratio: z.string().max(20).optional(),
    duration: z.string().max(60).optional(),
    slides: z.union([z.string(), z.number()]).optional(),
    audio: z.string().max(300).optional(),
    on_screen_text: z.string().max(1000).optional(),
  }),
  recording_instructions: z.string().max(10000).nullable(),
  shot_list: z.array(z.object({ text: z.string().max(1000), done: z.boolean().optional() })).max(60),
  script: z
    .array(
      z.object({
        section: z.string().max(100),
        time: z.string().max(30).optional(),
        voice: z.string().max(4000).optional(),
        on_screen: z.string().max(1000).optional(),
      }),
    )
    .max(40),
  slides: z.array(z.object({ text: z.string().max(2000) })).max(30),
  caption: z.string().max(2200).nullable(),
  cta: z.string().max(500).nullable(),
  hashtags: z.string().max(1000).nullable(),
  mentions: z.string().max(500).nullable(),
  location: z.string().max(200).nullable(),
  client_material_request: z.string().max(4000).nullable(),
  client_material_due: dateKey.nullable(),
  references: z.array(z.object({ label: z.string().max(200).optional(), url: z.string().url().max(1000) })).max(30),
  final_asset_url: z.string().max(1000).nullable(),
  published_url: z.string().max(1000).nullable(),
  clarifications: z.string().max(4000).nullable(),
  is_visible_to_client: z.boolean(),
  metrics: z.object({ reach: z.number().optional(), saves: z.number().optional(), comments: z.number().optional() }),
  internal_notes: z.string().max(10000).nullable(),
});
export type ItemInput = z.infer<typeof itemSchema>;

export async function updateItem(id: string, input: ItemInput): Promise<Result> {
  await assertAdmin();
  if (!uuid.safeParse(id).success) return { error: "Pieza inválida" };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisá los campos: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("workspace_id").eq("id", id).single();
  if (!item) return { error: "No encontramos la pieza" };
  const [y, m] = d.date.split("-").map(Number);
  const monthId = await ensureMonth(supabase, item.workspace_id, y, m);
  const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);
  const { error } = await supabase
    .from("content_items")
    .update({
      content_type_id: d.content_type_id,
      publish_at: arToUtc(d.date, d.time).toISOString(),
      month_id: monthId,
      networks: d.networks,
      status: d.status,
      pillar_id: d.pillar_id,
      series_id: d.series_id,
      production_owner: d.production_owner,
      production_person: clean(d.production_person),
      title: d.title.trim(),
      objective: clean(d.objective),
      audience: clean(d.audience),
      format: Object.fromEntries(Object.entries(d.format).filter(([, v]) => v !== "" && v !== undefined)),
      recording_instructions: clean(d.recording_instructions),
      shot_list: d.shot_list.filter((s) => s.text.trim()),
      script: d.script.filter((s) => s.section.trim() || s.voice?.trim() || s.on_screen?.trim()),
      slides: d.slides.filter((s) => s.text.trim()),
      caption: clean(d.caption),
      cta: clean(d.cta),
      hashtags: clean(d.hashtags),
      mentions: clean(d.mentions),
      location: clean(d.location),
      client_material_request: clean(d.client_material_request),
      client_material_due: d.client_material_due,
      references: d.references,
      final_asset_url: clean(d.final_asset_url),
      published_url: clean(d.published_url),
      clarifications: clean(d.clarifications),
      is_visible_to_client: d.is_visible_to_client,
      metrics: d.metrics,
    })
    .eq("id", id);
  if (error) return { error: errMsg(error) };
  const { error: e2 } = await supabase
    .from("content_internal")
    .upsert({ content_item_id: id, workspace_id: item.workspace_id, internal_notes: clean(d.internal_notes), updated_at: new Date().toISOString() });
  if (e2) return { error: errMsg(e2) };
  sendEmailsLater();
  refresh();
  return { ok: true };
}

export async function duplicateItem(id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: it } = await supabase.from("content_items").select("*").eq("id", id).single();
  if (!it) return { error: "No encontramos la pieza" };
  const copy = stripForCopy(it);
  const { data, error } = await supabase
    .from("content_items")
    .insert({ ...copy, status: "idea", title: it.title ? `${it.title} (copia)` : "" })
    .select("id")
    .single();
  if (error) return { error: errMsg(error) };
  refresh();
  redirect(`/clientes/${await wsSlug(supabase, it.workspace_id)}/pieza/${data.id}`);
}

/** Cambiar una pieza por otra (a pedido del cliente): la vieja queda como "Reemplazada". */
export async function replaceItem(id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: it } = await supabase.from("content_items").select("*").eq("id", id).single();
  if (!it) return { error: "No encontramos la pieza" };
  const copy = stripForCopy(it);
  const now = new Date();
  const { data, error } = await supabase
    .from("content_items")
    .insert({
      workspace_id: it.workspace_id,
      month_id: it.month_id,
      content_type_id: it.content_type_id,
      publish_at: it.publish_at,
      networks: it.networks,
      production_owner: it.production_owner,
      pillar_id: copy.pillar_id,
      status: "en_redaccion",
      title: "",
      client_changed_at: now.toISOString(),
      updated_flag_until: new Date(now.getTime() + 7 * 86400000).toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: errMsg(error) };
  await supabase.from("content_items").update({ status: "reemplazado", replaced_by_id: data.id }).eq("id", id);
  refresh();
  redirect(`/clientes/${await wsSlug(supabase, it.workspace_id)}/pieza/${data.id}`);
}

export async function deleteItem(id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: it } = await supabase.from("content_items").select("workspace_id, publish_at").eq("id", id).single();
  if (!it) return { error: "No encontramos la pieza" };
  const { error } = await supabase.from("content_items").delete().eq("id", id);
  if (error) return { error: errMsg(error) };
  const [y, m] = arDateKey(it.publish_at).split("-").map(Number);
  refresh();
  redirect(`/clientes/${await wsSlug(supabase, it.workspace_id)}/calendario?y=${y}&m=${m}`);
}

function stripForCopy(it: Record<string, unknown>) {
  const omit = [
    "id", "created_at", "updated_at", "created_by", "updated_by", "replaced_by_id", "client_changed_at",
    "updated_flag_until", "revision_count", "client_material_sent_at", "client_material_note", "published_url", "metrics",
  ];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(it)) if (!omit.includes(k)) out[k] = v;
  if (Array.isArray(out.shot_list)) out.shot_list = (out.shot_list as { text: string }[]).map((s) => ({ text: s.text, done: false }));
  return out;
}

export async function applyPieceTemplate(itemId: string, templateId: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: tpl } = await supabase.from("piece_templates").select("data").eq("id", templateId).single();
  if (!tpl) return { error: "Plantilla no encontrada" };
  const allowed = ["title", "objective", "format", "recording_instructions", "shot_list", "script", "slides", "caption", "cta", "clarifications"];
  const patch = Object.fromEntries(Object.entries(tpl.data as Record<string, unknown>).filter(([k]) => allowed.includes(k)));
  const { error } = await supabase.from("content_items").update(patch).eq("id", itemId);
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: true };
}

export async function saveItemAsTemplate(itemId: string, name: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: it } = await supabase
    .from("content_items")
    .select("workspace_id, title, objective, format, recording_instructions, shot_list, script, slides, caption, cta, clarifications, content_types(key)")
    .eq("id", itemId)
    .single();
  if (!it) return { error: "No encontramos la pieza" };
  const { content_types, workspace_id, ...data } = it as unknown as Record<string, unknown> & {
    content_types: { key: string } | null;
    workspace_id: string;
  };
  const { error } = await supabase
    .from("piece_templates")
    .insert({ workspace_id, name: name.slice(0, 120) || "Plantilla", content_type_key: content_types?.key, data });
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: true, message: "Plantilla guardada" };
}

// ------------------------------------------------------------------
// Tana: meses
// ------------------------------------------------------------------
export async function generateMonth(workspaceId: string, year: number, month: number): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: slots } = await supabase.from("template_slots").select("*").eq("workspace_id", workspaceId);
  if (!slots?.length) return { error: "Este cliente no tiene plantilla semanal. Configurala en la pestaña Plantilla." };
  const monthId = await ensureMonth(supabase, workspaceId, year, month);
  const range = monthRangeUtc(year, month);
  const { data: existing } = await supabase
    .from("content_items")
    .select("template_slot_id, publish_at")
    .eq("workspace_id", workspaceId)
    .gte("publish_at", range.from)
    .lt("publish_at", range.to);
  const taken = new Set((existing ?? []).map((e) => `${e.template_slot_id}|${arDateKey(e.publish_at)}`));
  const { data: ws } = await supabase.from("workspaces").select("production_mode").eq("id", workspaceId).single();
  const slotById = Object.fromEntries((slots as TemplateSlot[]).map((s) => [s.id, s]));
  const rows = generateMonthSlots(slots as TemplateSlot[], year, month)
    .filter((g) => !taken.has(`${g.slotId}|${g.dateKey}`))
    .map((g) => {
      const s = slotById[g.slotId];
      const st = s.story_template ?? {};
      const objective = [st.objective, st.example ? `Por ejemplo: ${st.example}` : null].filter(Boolean).join("\n");
      return {
        workspace_id: workspaceId,
        month_id: monthId,
        content_type_id: s.content_type_id,
        template_slot_id: s.id,
        series_id: s.series_id,
        publish_at: g.publishAt,
        status: "idea",
        title: s.title_default ?? "",
        objective: objective || null,
        format: st.format ? { on_screen_text: st.format } : {},
        production_owner: ws?.production_mode ?? "tana",
      };
    });
  if (rows.length) {
    const { error } = await supabase.from("content_items").insert(rows);
    if (error) return { error: errMsg(error) };
  }
  refresh();
  return {
    ok: true,
    count: rows.length,
    message: rows.length ? `Se crearon ${rows.length} piezas desde la plantilla.` : "El mes ya tenía todas las piezas de la plantilla.",
  };
}

export async function duplicatePrevMonth(
  workspaceId: string,
  year: number,
  month: number,
  withContent: boolean,
): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const prev = shiftMonth(year, month, -1);
  const prevRange = monthRangeUtc(prev.year, prev.month);
  const { data: src } = await supabase
    .from("content_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("publish_at", prevRange.from)
    .lt("publish_at", prevRange.to)
    .not("status", "in", "(cancelado,reemplazado)");
  if (!src?.length) return { error: "El mes anterior no tiene piezas para copiar." };
  const monthId = await ensureMonth(supabase, workspaceId, year, month);
  const rows = [];
  for (const it of src) {
    const target = mapToSameWeekdayOccurrence(arDateKey(it.publish_at), year, month);
    if (!target) continue;
    const recurring = !!(it.series_id || it.template_slot_id);
    const base = {
      workspace_id: workspaceId,
      month_id: monthId,
      content_type_id: it.content_type_id,
      template_slot_id: it.template_slot_id,
      series_id: it.series_id,
      pillar_id: it.pillar_id,
      networks: it.networks,
      production_owner: it.production_owner,
      publish_at: arToUtc(target, arTime(it.publish_at)).toISOString(),
      status: "idea",
      title: recurring || withContent ? it.title : "",
    };
    if (withContent && recurring) {
      const c = stripForCopy(it);
      rows.push({ ...c, ...base });
    } else rows.push(base);
  }
  const { error } = await supabase.from("content_items").insert(rows);
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: true, count: rows.length, message: `Se copiaron ${rows.length} piezas del mes anterior.` };
}

export async function sendMonth(workspaceId: string, year: number, month: number, promoteDrafts: boolean): Promise<Result> {
  const s = await assertAdmin();
  const supabase = await createClient();
  const monthId = await ensureMonth(supabase, workspaceId, year, month);
  const { data: m } = await supabase.from("months").select("share_token").eq("id", monthId).single();
  if (promoteDrafts) {
    await supabase
      .from("content_items")
      .update({ status: "para_revisar" })
      .eq("month_id", monthId)
      .eq("status", "en_redaccion");
  }
  const { error } = await supabase
    .from("months")
    .update({ status: "enviado", sent_at: new Date().toISOString(), share_token: m?.share_token ?? randomToken() })
    .eq("id", monthId);
  if (error) return { error: errMsg(error) };
  // Notificar al cliente
  const { data: members } = await supabase.from("memberships").select("user_id").eq("workspace_id", workspaceId);
  const { data: ws } = await supabase.from("workspaces").select("slug, name").eq("id", workspaceId).single();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  if (members?.length) {
    await admin.from("notifications").insert(
      members.map((mm) => ({
        user_id: mm.user_id,
        workspace_id: workspaceId,
        type: "mes_enviado",
        title: `Ya está tu calendario de ${monthLabel}`,
        body: "Revisalo, aprobá las piezas o pedí cambios desde el portal.",
        link: `/portal/${ws?.slug}/calendario?y=${year}&m=${month}`,
      })),
    );
  }
  await admin.from("activity_log").insert({
    workspace_id: workspaceId,
    actor_id: s.userId,
    entity: "month",
    entity_id: monthId,
    action: "month_sent",
    summary: `Calendario de ${monthLabel} enviado para revisar`,
  });
  sendEmailsLater();
  refresh();
  return { ok: true, message: "Calendario enviado. El cliente ya lo puede ver." };
}

export async function setMonthStatus(monthId: string, status: "borrador" | "enviado" | "aprobado"): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("months").update({ status }).eq("id", monthId);
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: true };
}

export async function rotateShareToken(monthId: string, revoke: boolean): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("months")
    .update({ share_token: revoke ? null : randomToken() })
    .eq("id", monthId);
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: true, message: revoke ? "Link desactivado" : "Link nuevo generado" };
}

export async function saveMonthIntro(monthId: string, intro: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("months").update({ intro: intro.trim() || null }).eq("id", monthId);
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: true };
}

// ------------------------------------------------------------------
// Comentarios (Tana y cliente)
// ------------------------------------------------------------------
export async function addComment(itemId: string, body: string, internal: boolean): Promise<Result> {
  const s = await getSession();
  if (!s) return { error: "Tenés que entrar de nuevo." };
  const text = body.trim();
  if (text.length < 1 || text.length > 5000) return { error: "Escribí un comentario" };
  const supabase = await createClient();
  const { data: it } = await supabase.from("content_items").select("workspace_id").eq("id", itemId).single();
  if (!it) return { error: "No encontramos la pieza" };
  const { error } = await supabase.from("comments").insert({
    content_item_id: itemId,
    workspace_id: it.workspace_id,
    author_id: s.userId,
    body: text,
    is_internal: s.isAdmin && internal,
  });
  if (error) return { error: "No se pudo guardar el comentario" };
  sendEmailsLater();
  refresh();
  return { ok: true };
}

// ------------------------------------------------------------------
// Cliente (vía RPCs seguras)
// ------------------------------------------------------------------
async function rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  sendEmailsLater();
  refresh();
  return { ok: true, count: typeof data === "number" ? data : undefined };
}

export async function approveItem(itemId: string, note?: string) {
  return rpc("client_approve_item", { p_item: itemId, p_note: note ?? null });
}
export async function requestChanges(itemId: string, note: string) {
  if (!note || note.trim().length < 3) return { error: "Contanos qué querés cambiar" };
  return rpc("client_request_changes", { p_item: itemId, p_note: note });
}
export async function markMaterialSent(itemId: string, note?: string) {
  return rpc("client_mark_material_sent", { p_item: itemId, p_note: note ?? null });
}
export async function toggleShot(itemId: string, index: number, done: boolean) {
  return rpc("client_toggle_shot", { p_item: itemId, p_index: index, p_done: done });
}
export async function approveMonth(monthId: string) {
  return rpc("client_approve_month", { p_month: monthId });
}
export async function markItemSeen(itemId: string) {
  const supabase = await createClient();
  await supabase.rpc("mark_item_seen", { p_item: itemId });
}
