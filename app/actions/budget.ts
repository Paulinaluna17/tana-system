"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";
import { buildMonthlyInvoice } from "@/lib/billing";
import { dispatchPendingEmails } from "@/lib/notify";
import type { WorkspaceService } from "@/lib/types";

type Result = { error?: string; ok?: boolean; message?: string } | undefined;
const refresh = () => revalidatePath("/", "layout");
const emails = () =>
  after(async () => {
    try {
      await dispatchPendingEmails();
    } catch (e) {
      console.error(e);
    }
  });

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid(),
  service_id: z.string().uuid().nullable(),
  custom_name: z.string().max(200).nullable(),
  description: z.string().max(2000).nullable(),
  includes: z.array(z.string().max(300)).max(30),
  excludes: z.array(z.string().max(300)).max(30),
  price: z.coerce.number().min(0).max(1e12),
  currency: z.string().max(5).default("ARS"),
  billing: z.enum(["mensual", "unico", "por_pieza"]),
  status: z.enum(["activo", "pausado", "inactivo", "propuesto"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  due_day: z.coerce.number().int().min(1).max(28).nullable(),
  conditions: z.string().max(2000).nullable(),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export async function saveWorkspaceService(input: ServiceInput): Promise<Result> {
  await assertAdmin();
  const p = serviceSchema.safeParse(input);
  if (!p.success) return { error: "Revisá los datos del servicio" };
  const supabase = await createClient();
  const { id, ...data } = p.data;
  const clean = {
    ...data,
    includes: data.includes.map((s) => s.trim()).filter(Boolean),
    excludes: data.excludes.map((s) => s.trim()).filter(Boolean),
    custom_name: data.custom_name?.trim() || null,
  };
  const { error } = id
    ? await supabase.from("workspace_services").update(clean).eq("id", id)
    : await supabase.from("workspace_services").insert(clean);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Servicio guardado" };
}

export async function deleteWorkspaceService(id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_services").delete().eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function generateInvoice(workspaceId: string, year: number, month: number): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const period = `${year}-${String(month).padStart(2, "0")}-01`;
  const { data: exists } = await supabase
    .from("invoices")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("period", period)
    .eq("auto_generated", true)
    .maybeSingle();
  if (exists) return { error: "Ya existe la cuota de ese mes." };
  const { data: services } = await supabase.from("workspace_services").select("*, services(name)").eq("workspace_id", workspaceId);
  const draft = buildMonthlyInvoice((services ?? []) as WorkspaceService[], year, month);
  if (!draft) return { error: "No hay servicios mensuales activos para ese mes." };
  const { error } = await supabase.from("invoices").insert({ workspace_id: workspaceId, ...draft, auto_generated: true });
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Cuota generada" };
}

const invoiceSchema = z.object({
  id: z.string().uuid().optional(),
  workspace_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(300),
  amount: z.coerce.number().min(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_link: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(),
});

export async function saveInvoice(input: z.infer<typeof invoiceSchema>): Promise<Result> {
  await assertAdmin();
  const p = invoiceSchema.safeParse(input);
  if (!p.success) return { error: "Revisá los datos de la cuota" };
  const supabase = await createClient();
  const { id, description, ...d } = p.data;
  const row = { ...d, items: [{ name: description || "Servicios", amount: d.amount }] };
  const { error } = id
    ? await supabase.from("invoices").update(row).eq("id", id)
    : await supabase.from("invoices").insert(row);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Cuota guardada" };
}

export async function markInvoicePaid(id: string, method: string | null): Promise<Result> {
  const s = await assertAdmin();
  const supabase = await createClient();
  const { data: inv, error } = await supabase
    .from("invoices")
    .update({ paid_at: new Date().toISOString(), method: method || undefined })
    .eq("id", id)
    .select("workspace_id, period, amount")
    .single();
  if (error) return { error: error.message };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: members } = await admin.from("memberships").select("user_id").eq("workspace_id", inv.workspace_id);
  const { data: ws } = await admin.from("workspaces").select("slug").eq("id", inv.workspace_id).single();
  const label = new Date(inv.period + "T12:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  if (members?.length)
    await admin.from("notifications").insert(
      members.map((m) => ({
        user_id: m.user_id,
        workspace_id: inv.workspace_id,
        type: "pago_confirmado",
        title: "Pago confirmado ✔",
        body: `Recibimos el pago de ${label}. ¡Gracias!`,
        link: `/portal/${ws?.slug}/presupuesto`,
      })),
    );
  await admin.from("activity_log").insert({
    workspace_id: inv.workspace_id,
    actor_id: s.userId,
    entity: "invoice",
    entity_id: id,
    action: "payment_confirmed",
    summary: `Pago confirmado: ${label}`,
  });
  emails();
  refresh();
  return { ok: true, message: "Marcado como pagado" };
}

export async function unmarkInvoicePaid(id: string): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ paid_at: null }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function voidInvoice(id: string, voided: boolean): Promise<Result> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ status_override: voided ? "anulada" : null }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

/** El cliente informa un pago (el comprobante ya se subió al bucket "receipts" desde el navegador). */
export async function reportPayment(invoiceId: string, receiptPath: string, method: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_report_payment", {
    p_invoice: invoiceId,
    p_receipt_path: receiptPath,
    p_method: method,
    p_note: note,
  });
  if (error) return { error: error.message };
  emails();
  refresh();
  return { ok: true, message: "¡Gracias! Tana va a confirmar el pago." };
}
