"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth";
import { dispatchPendingEmails } from "@/lib/notify";
import { readableTextOn, slugify } from "@/lib/utils";
import { arToUtc, isoWeekday } from "@/lib/dates";
import { ensureMonth } from "./content";

type Result = { error?: string; ok?: boolean; message?: string; slug?: string } | undefined;
const refresh = () => revalidatePath("/", "layout");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const brandSchema = z.object({
  primary: hex,
  secondary: hex,
  background: hex,
  surface: hex,
  text: hex,
  muted: hex.optional(),
  font: z.string().max(60),
  headingFont: z.string().max(60),
  theme: z.enum(["light", "dark"]),
});

const slotSchema = z.object({
  type_key: z.string().max(30),
  weekday: z.number().int().min(1).max(7),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  recurrence: z.enum(["weekly", "biweekly", "monthly_first", "monthly_last"]),
  anchor_date: z.string().nullable().optional(),
  title_default: z.string().max(200).nullable().optional(),
  example: z.string().max(500).optional(),
});

const wizardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  contact_name: z.string().max(120).optional(),
  whatsapp: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  instagram: z.string().max(80).optional(),
  tiktok: z.string().max(80).optional(),
  website: z.string().max(300).optional(),
  logo_url: z.string().max(500).optional(),
  brand: brandSchema,
  production_mode: z.enum(["tana", "cliente", "mixto"]),
  approval_lead_days: z.number().int().min(0).max(30),
  revision_rounds: z.number().int().min(0).max(10),
  material_deadline_day: z.number().int().min(1).max(28).nullable(),
  slots: z.array(slotSchema).max(40),
  services: z
    .array(
      z.object({
        service_id: z.string().uuid(),
        price: z.number().min(0),
        status: z.enum(["activo", "propuesto"]),
        due_day: z.number().int().min(1).max(28).nullable(),
      }),
    )
    .max(20),
  invites: z.array(z.object({ email: z.string().email(), name: z.string().max(120).optional() })).max(10),
});
export type WizardInput = z.infer<typeof wizardSchema>;

/** Tipos de pieza por defecto, con colores derivados de la marca. */
function defaultTypes(b: z.infer<typeof brandSchema>) {
  return [
    { key: "post", label: "Post", color: b.primary, description: "Pieza estática para el feed." },
    { key: "carrusel", label: "Carrusel", color: b.primary, description: "Carrusel de imágenes para el feed." },
    { key: "reel", label: "Reel", color: b.theme === "dark" ? b.text : "#FFFFFF", description: "Video corto vertical." },
    { key: "historia", label: "Historia", color: b.secondary, description: "Contenido efímero (24 hs)." },
    { key: "tiktok", label: "TikTok", color: "#111111", description: "Video para TikTok." },
    { key: "otro", label: "Otro", color: "#78716C", description: null },
  ].map((t, i) => ({ ...t, text_color: t.key === "reel" ? (b.theme === "dark" ? b.background : b.primary) : readableTextOn(t.color), sort: i + 1 }));
}

export async function createWorkspace(input: WizardInput): Promise<Result> {
  const s = await assertAdmin();
  const p = wizardSchema.safeParse(input);
  if (!p.success) return { error: "Revisá los datos: " + p.error.issues.map((i) => i.path.join(".")).join(", ") };
  const d = p.data;
  const supabase = await createClient();
  let slug = slugify(d.name) || "cliente";
  const { data: clash } = await supabase.from("workspaces").select("slug").like("slug", `${slug}%`);
  if (clash?.some((c) => c.slug === slug)) slug = `${slug}-${(clash?.length ?? 0) + 1}`;
  const { data: ws, error } = await supabase
    .from("workspaces")
    .insert({
      slug,
      name: d.name,
      industry: d.industry || null,
      city: d.city || null,
      contact_name: d.contact_name || null,
      whatsapp: d.whatsapp?.replace(/\D/g, "") || null,
      email: d.email || null,
      socials: Object.fromEntries(Object.entries({ instagram: d.instagram, tiktok: d.tiktok }).filter(([, v]) => v)),
      website: d.website || null,
      logo_url: d.logo_url || null,
      brand: d.brand,
      production_mode: d.production_mode,
      approval_lead_days: d.approval_lead_days,
      revision_rounds: d.revision_rounds,
      material_deadline_day: d.material_deadline_day,
    })
    .select("id, slug")
    .single();
  if (error) return { error: error.message };

  const { data: types, error: e1 } = await supabase
    .from("content_types")
    .insert(defaultTypes(d.brand).map((t) => ({ ...t, workspace_id: ws.id })))
    .select("id, key");
  if (e1) return { error: e1.message };
  const typeId = Object.fromEntries((types ?? []).map((t) => [t.key, t.id]));
  await supabase.from("pillars").insert(
    ["Educativo", "Comunidad", "Producto / servicio", "Marca"].map((name) => ({ workspace_id: ws.id, name })),
  );
  if (d.slots.length) {
    const { error: e2 } = await supabase.from("template_slots").insert(
      d.slots.map((sl, i) => ({
        workspace_id: ws.id,
        content_type_id: typeId[sl.type_key] ?? typeId.post,
        weekday: sl.weekday,
        time: sl.time,
        recurrence: sl.recurrence,
        anchor_date: sl.anchor_date || null,
        title_default: sl.title_default || null,
        story_template: sl.example ? { example: sl.example } : {},
        sort: i,
      })),
    );
    if (e2) return { error: e2.message };
  }
  if (d.services.length) {
    const { data: cat } = await supabase.from("services").select("*").in("id", d.services.map((x) => x.service_id));
    await supabase.from("workspace_services").insert(
      d.services.map((x) => {
        const c = cat?.find((k) => k.id === x.service_id);
        return {
          workspace_id: ws.id,
          service_id: x.service_id,
          description: c?.description,
          includes: c?.includes ?? [],
          excludes: c?.excludes ?? [],
          price: x.price,
          billing: c?.billing ?? "mensual",
          status: x.status,
          due_day: x.due_day,
          start_date: x.status === "activo" ? new Date().toISOString().slice(0, 10) : null,
        };
      }),
    );
  }
  for (const inv of d.invites) {
    const r = await addMemberInternal(ws.id, inv.email, inv.name ?? "", "client_editor", d.name);
    if (r?.error) return { error: `Cliente creado, pero falló la invitación a ${inv.email}: ${r.error}`, slug: ws.slug };
  }
  await createAdminClient().from("activity_log").insert({
    workspace_id: ws.id,
    actor_id: s.userId,
    entity: "workspace",
    entity_id: ws.id,
    action: "created",
    summary: `Alta de ${d.name} en el sistema`,
  });
  refresh();
  return { ok: true, slug: ws.slug };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().max(120).nullable(),
  city: z.string().max(120).nullable(),
  contact_name: z.string().max(120).nullable(),
  whatsapp: z.string().max(40).nullable(),
  email: z.string().max(200).nullable(),
  website: z.string().max(300).nullable(),
  socials: z.record(z.string(), z.string()),
  logo_url: z.string().max(500).nullable(),
  brand: brandSchema,
  production_mode: z.enum(["tana", "cliente", "mixto"]),
  approval_lead_days: z.number().int().min(0).max(30),
  revision_rounds: z.number().int().min(0).max(10),
  material_deadline_day: z.number().int().min(1).max(28).nullable(),
  how_to_read_md: z.string().max(20000).nullable(),
  calendar_note: z.string().max(500).nullable(),
  brand_book: z.object({
    tone: z.string().max(2000).optional(),
    audience: z.string().max(2000).optional(),
    pillars: z.array(z.string()).optional(),
    use_words: z.array(z.string()).optional(),
    avoid_words: z.array(z.string()).optional(),
    hashtags: z.string().max(1000).optional(),
    links: z.array(z.string()).optional(),
  }),
});
export type WorkspaceUpdate = z.infer<typeof updateSchema>;

export async function updateWorkspace(id: string, input: WorkspaceUpdate): Promise<Result> {
  await assertAdmin();
  const p = updateSchema.safeParse(input);
  if (!p.success) return { error: "Revisá los datos: " + p.error.issues.map((i) => i.path.join(".")).join(", ") };
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ ...p.data, whatsapp: p.data.whatsapp?.replace(/\D/g, "") || null })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Guardado" };
}

export async function archiveWorkspace(id: string, archived: boolean): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: archived ? "Cliente archivado" : "Cliente reactivado" };
}

export async function uploadLogo(formData: FormData): Promise<{ url?: string; error?: string }> {
  await assertAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí una imagen" };
  if (file.size > 5 * 1024 * 1024) return { error: "La imagen pesa más de 5 MB" };
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return { error: "Formato no soportado (PNG, JPG, WEBP o SVG)" };
  const supabase = await createClient();
  const path = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };
  return { url: supabase.storage.from("logos").getPublicUrl(path).data.publicUrl };
}

// ---------- Plantilla semanal ----------
export async function saveSlot(input: {
  id?: string;
  workspace_id: string;
  content_type_id: string;
  weekday: number;
  time: string;
  recurrence: "weekly" | "biweekly" | "monthly_first" | "monthly_last";
  anchor_date: string | null;
  title_default: string | null;
  series_id: string | null;
  story_template: { example?: string; objective?: string; format?: string };
  active: boolean;
}): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { id, ...row } = input;
  if (row.recurrence === "biweekly" && !row.anchor_date) return { error: "Para “cada 15 días” elegí una fecha en la que toca." };
  if (row.anchor_date && isoWeekday(row.anchor_date) !== row.weekday)
    return { error: "La fecha de referencia tiene que caer el mismo día de la semana." };
  const { error } = id ? await supabase.from("template_slots").update(row).eq("id", id) : await supabase.from("template_slots").insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Plantilla guardada" };
}

export async function deleteSlot(id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("template_slots").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

// ---------- Tipos, pilares, series ----------
export async function saveContentType(input: { id?: string; workspace_id: string; key: string; label: string; color: string; text_color: string; description: string | null }): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { id, ...row } = input;
  const { error } = id
    ? await supabase.from("content_types").update(row).eq("id", id)
    : await supabase.from("content_types").insert({ ...row, key: slugify(row.key || row.label), sort: 50 });
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Tipo guardado" };
}

export async function saveNamed(table: "pillars" | "series", input: { id?: string; workspace_id: string; name: string; extra?: string }): Promise<Result> {
  await assertAdmin();
  if (!input.name.trim()) return { error: "Poné un nombre" };
  const supabase = await createClient();
  const row: Record<string, unknown> =
    table === "pillars"
      ? { workspace_id: input.workspace_id, name: input.name.trim(), color: input.extra || "#94a3b8" }
      : { workspace_id: input.workspace_id, name: input.name.trim(), description: input.extra || null };
  const { error } = input.id ? await supabase.from(table).update(row).eq("id", input.id) : await supabase.from(table).insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteNamed(table: "pillars" | "series" | "idea_bank" | "piece_templates", id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

// ---------- Banco de ideas ----------
export async function saveIdea(input: { id?: string; workspace_id: string; title: string; notes: string | null; pillar_id: string | null; content_type_id: string | null }): Promise<Result> {
  await assertAdmin();
  if (!input.title.trim()) return { error: "Escribí la idea" };
  const supabase = await createClient();
  const { id, ...row } = input;
  const { error } = id ? await supabase.from("idea_bank").update(row).eq("id", id) : await supabase.from("idea_bank").insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Idea guardada" };
}

/** Pasa una idea del banco a una fecha del calendario. */
export async function scheduleIdea(ideaId: string, date: string, time: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: idea } = await supabase.from("idea_bank").select("*").eq("id", ideaId).single();
  if (!idea) return { error: "Idea no encontrada" };
  let typeId = idea.content_type_id as string | null;
  if (!typeId) {
    const { data: t } = await supabase.from("content_types").select("id").eq("workspace_id", idea.workspace_id).order("sort").limit(1).single();
    typeId = t?.id ?? null;
  }
  const [y, m] = date.split("-").map(Number);
  const monthId = await ensureMonth(supabase, idea.workspace_id, y, m);
  const { error } = await supabase.from("content_items").insert({
    workspace_id: idea.workspace_id,
    month_id: monthId,
    content_type_id: typeId,
    pillar_id: idea.pillar_id,
    publish_at: arToUtc(date, time).toISOString(),
    status: "en_redaccion",
    title: idea.title,
    objective: idea.notes,
  });
  if (error) return { error: error.message };
  await supabase.from("idea_bank").delete().eq("id", ideaId);
  refresh();
  return { ok: true, message: "La idea pasó al calendario" };
}

// ---------- Usuarios del cliente ----------
async function addMemberInternal(workspaceId: string, email: string, name: string, role: "client_editor" | "client_viewer", wsName: string): Promise<Result> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  let { data: profile } = await admin.from("profiles").select("id").eq("email", normalized).maybeSingle();
  if (!profile) {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalized,
      email_confirm: true,
      user_metadata: { full_name: name || normalized.split("@")[0] },
    });
    if (error) return { error: error.message };
    profile = { id: data.user.id };
    await admin.from("profiles").upsert({ id: data.user.id, email: normalized, full_name: name || normalized.split("@")[0] });
  }
  const { error } = await admin.from("memberships").upsert({ user_id: profile.id, workspace_id: workspaceId, role });
  if (error) return { error: error.message };
  await admin.from("notifications").insert({
    user_id: profile.id,
    workspace_id: workspaceId,
    type: "bienvenida",
    title: `Ya tenés acceso al calendario de ${wsName}`,
    body: "Entrá con tu email: te mandamos un link para ingresar, sin contraseña.",
    link: "/login",
  });
  after(async () => {
    try {
      await dispatchPendingEmails();
    } catch (e) {
      console.error(e);
    }
  });
  return { ok: true };
}

export async function inviteMember(workspaceId: string, email: string, name: string, role: "client_editor" | "client_viewer"): Promise<Result> {
  await assertAdmin();
  if (!z.string().email().safeParse(email.trim()).success) return { error: "Revisá el email" };
  const supabase = await createClient();
  const { data: ws } = await supabase.from("workspaces").select("name").eq("id", workspaceId).single();
  const r = await addMemberInternal(workspaceId, email, name, role, ws?.name ?? "");
  if (r?.error) return r;
  refresh();
  return { ok: true, message: "Acceso creado. Ya puede entrar con su email." };
}

export async function setMemberRole(workspaceId: string, userId: string, role: "client_editor" | "client_viewer"): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role }).eq("workspace_id", workspaceId).eq("user_id", userId);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function removeMember(workspaceId: string, userId: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Acceso quitado" };
}

/** Genera un link de acceso de un solo uso (para mandar por WhatsApp si el mail no llega). */
export async function accessLink(email: string): Promise<{ url?: string; error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return { error: error?.message ?? "No se pudo generar" };
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return { url: `${appUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/` };
}

// ---------- Catálogo de servicios de Tana ----------
export async function saveCatalogService(input: {
  id?: string;
  name: string;
  description: string | null;
  includes: string[];
  excludes: string[];
  default_price: number;
  billing: "mensual" | "unico" | "por_pieza";
  active: boolean;
}): Promise<Result> {
  await assertAdmin();
  if (!input.name.trim()) return { error: "Poné un nombre" };
  const supabase = await createClient();
  const { id, ...row } = input;
  const clean = { ...row, includes: row.includes.map((x) => x.trim()).filter(Boolean), excludes: row.excludes.map((x) => x.trim()).filter(Boolean) };
  const { error } = id ? await supabase.from("services").update(clean).eq("id", id) : await supabase.from("services").insert(clean);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Servicio guardado" };
}

// ---------- Perfil y notificaciones ----------
export async function updateMyProfile(input: { full_name: string; notify_email: boolean; weekly_digest: boolean }): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que entrar de nuevo" };
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name.trim().slice(0, 120), notify_email: input.notify_email, weekly_digest: input.weekly_digest })
    .eq("id", user.id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Guardado" };
}

export async function markNotificationsRead(ids?: string[]): Promise<Result> {
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}
