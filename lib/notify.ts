import "server-only";
import { render } from "@react-email/components";
import { createAdminClient } from "./supabase/admin";
import { NotificationEmail } from "@/emails/notification-email";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Envía por email las notificaciones pendientes (si hay RESEND_API_KEY).
 * Sin API key, el sistema funciona igual: las notificaciones quedan en la campanita.
 */
export async function dispatchPendingEmails(limit = 50): Promise<{ sent: number; skipped: boolean }> {
  if (!emailEnabled()) return { sent: 0, skipped: true };
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const admin = createAdminClient();
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await admin
    .from("notifications")
    .select("id, title, body, link, type, user_id, workspace_id, profiles!inner(email, full_name, notify_email, is_tana_admin), workspaces(name, brand)")
    .is("emailed_at", null)
    .gte("created_at", since)
    .order("created_at")
    .limit(limit);
  let sent = 0;
  type Row = {
    id: string;
    title: string;
    body: string | null;
    link: string | null;
    type: string;
    profiles: { email: string | null; full_name: string | null; notify_email: boolean; is_tana_admin: boolean };
    workspaces: { name: string; brand: { primary?: string } } | null;
  };
  for (const n of (rows ?? []) as unknown as Row[]) {
    const p = n.profiles;
    if (!p?.email || !p.notify_email) {
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
      continue;
    }
    const html = await render(
      NotificationEmail({
        title: n.title,
        body: n.body ?? "",
        ctaUrl: `${appUrl()}${n.link ?? "/"}`,
        brandName: n.workspaces?.name ?? "Tana Studio",
        color: n.workspaces?.brand?.primary ?? "#A54C34",
        name: p.full_name ?? "",
      }),
    );
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Tana Studio <onboarding@resend.dev>",
      to: p.email,
      subject: n.workspaces ? `${n.title} · ${n.workspaces.name}` : n.title,
      html,
    });
    if (!error) {
      sent++;
      await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
    } else {
      console.error("resend", error);
    }
  }
  return { sent, skipped: false };
}
