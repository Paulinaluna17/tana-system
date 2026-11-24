import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPendingEmails } from "@/lib/notify";
import { buildMonthlyInvoice } from "@/lib/billing";
import { addDaysKey, arDateKey, arToUtc, currentYearMonth, formatDateKeyLong, isoWeekday, monthName, shiftMonth, todayKey, weekRange } from "@/lib/dates";
import { dueText, getInvoiceStatus, getTimeState, isUrgentApproval } from "@/lib/status";
import type { ContentItem, Invoice, Workspace, WorkspaceService } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Tareas diarias (Vercel Cron, 1 vez por día):
 * 1) genera las cuotas mensuales automáticas, 2) recordatorios de pago, aprobación y material,
 * 3) avisa a Tana de piezas atrasadas, 4) resumen semanal los lunes, 5) envía los emails pendientes.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const now = new Date();
  const today = todayKey(now);
  const stats = { invoices: 0, notifications: 0, emails: 0 };

  const { data: wss } = await admin.from("workspaces").select("*").is("archived_at", null);
  const { data: adminsRows } = await admin.from("profiles").select("id").eq("is_tana_admin", true);
  const adminIds = (adminsRows ?? []).map((a) => a.id as string);

  const notify = async (
    users: string[],
    ws: Workspace,
    type: string,
    title: string,
    body: string,
    link: string,
    dedupe: string,
  ) => {
    if (!users.length) return;
    const { data } = await admin
      .from("notifications")
      .upsert(
        users.map((u) => ({ user_id: u, workspace_id: ws.id, type, title, body, link, dedupe_key: dedupe })),
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    stats.notifications += data?.length ?? 0;
  };

  for (const ws of (wss ?? []) as Workspace[]) {
    const { data: members } = await admin.from("memberships").select("user_id, profiles(weekly_digest)").eq("workspace_id", ws.id);
    const memberIds = (members ?? []).map((m) => m.user_id as string);

    // 1) Cuotas automáticas (mes actual y próximo)
    const { data: services } = await admin.from("workspace_services").select("*, services(name)").eq("workspace_id", ws.id);
    const cur = currentYearMonth(now);
    for (const ym of [cur, shiftMonth(cur.year, cur.month, 1)]) {
      const draft = buildMonthlyInvoice((services ?? []) as WorkspaceService[], ym.year, ym.month);
      if (!draft) continue;
      const { data: exists } = await admin
        .from("invoices")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("period", draft.period)
        .eq("auto_generated", true)
        .maybeSingle();
      if (exists) continue;
      const { error } = await admin.from("invoices").insert({ workspace_id: ws.id, ...draft, auto_generated: true });
      if (!error) stats.invoices++;
    }

    // 2) Recordatorios de pago
    const { data: invs } = await admin.from("invoices").select("*").eq("workspace_id", ws.id).is("paid_at", null).is("status_override", null);
    for (const inv of (invs ?? []) as Invoice[]) {
      const st = getInvoiceStatus(inv, today);
      const [py, pm] = inv.period.split("-").map(Number);
      const label = `Cuota de ${monthName(py, pm).toLowerCase()}`;
      if (st === "por_vencer")
        await notify(memberIds, ws, "pago_por_vencer", `${label}: ${dueText(inv.due_date, today).toLowerCase()}`, `Monto: $ ${Number(inv.amount).toLocaleString("es-AR")}. Podés informar el pago desde el portal.`, `/portal/${ws.slug}/presupuesto`, `inv-soon:${inv.id}`);
      if (st === "vencido") {
        const wk = weekRange(today).start;
        await notify(memberIds, ws, "pago_vencido", `${label} vencida`, `${dueText(inv.due_date, today)}. Si ya pagaste, subí el comprobante desde el portal.`, `/portal/${ws.slug}/presupuesto`, `inv-late:${inv.id}:${wk}`);
        await notify(adminIds, ws, "pago_vencido", `${ws.name}: ${label.toLowerCase()} vencida`, dueText(inv.due_date, today), `/clientes/${ws.slug}/presupuesto`, `inv-late:${inv.id}:${wk}`);
      }
    }

    // 3) Piezas: aprobación urgente, material, atrasadas
    const { data: items } = await admin
      .from("content_items")
      .select("*")
      .eq("workspace_id", ws.id)
      .gte("publish_at", arToUtc(addDaysKey(today, -7)).toISOString())
      .lt("publish_at", arToUtc(addDaysKey(today, 21)).toISOString());
    const { data: months } = await admin.from("months").select("id, status").eq("workspace_id", ws.id);
    const sent = new Set((months ?? []).filter((m) => m.status !== "borrador").map((m) => m.id));
    for (const it of (items ?? []) as ContentItem[]) {
      const visible = !["idea", "en_redaccion"].includes(it.status) && (it.is_visible_to_client || !it.month_id || sent.has(it.month_id));
      const when = formatDateKeyLong(arDateKey(it.publish_at)).toLowerCase();
      if (visible && isUrgentApproval(it, ws.approval_lead_days, now))
        await notify(memberIds, ws, "aprobacion_urgente", "Hay una pieza esperando tu aprobación", `${it.title || "Pieza"} · se publica el ${when}`, `/portal/${ws.slug}/pieza/${it.id}`, `urg:${it.id}`);
      if (visible && it.client_material_request && !it.client_material_sent_at && it.client_material_due && it.client_material_due <= addDaysKey(today, 1) && it.status !== "publicado")
        await notify(memberIds, ws, "material", "Recordatorio: material pendiente", `${it.client_material_request} · fecha límite ${formatDateKeyLong(it.client_material_due).toLowerCase()}`, `/portal/${ws.slug}/pieza/${it.id}`, `mat:${it.id}:${today}`);
      if (getTimeState(it, now) === "atrasada")
        await notify(adminIds, ws, "atrasada", `${ws.name}: pieza atrasada`, `${it.title || "Pieza"} (${when}) todavía no está publicada.`, `/clientes/${ws.slug}/pieza/${it.id}`, `late:${it.id}`);
    }

    // 4) Resumen semanal (lunes)
    if (isoWeekday(today) === 1) {
      const wk = weekRange(today);
      const count = ((items ?? []) as ContentItem[]).filter((i) => {
        const k = arDateKey(i.publish_at);
        return k >= wk.start && k <= wk.end && !["idea", "en_redaccion", "cancelado", "reemplazado"].includes(i.status);
      }).length;
      const digestUsers = (members ?? [])
        .filter((m) => (m.profiles as unknown as { weekly_digest: boolean } | null)?.weekly_digest !== false)
        .map((m) => m.user_id as string);
      if (count)
        await notify(digestUsers, ws, "resumen_semanal", "Esta semana en tu calendario", `Tenés ${count} publicaciones programadas esta semana. Mirá qué hay que grabar y aprobar.`, `/portal/${ws.slug}`, `digest:${wk.start}`);
    }
  }

  const sentEmails = await dispatchPendingEmails(200);
  stats.emails = sentEmails.sent;
  return NextResponse.json({ ok: true, today, ...stats, emailsEnabled: !sentEmails.skipped });
}
