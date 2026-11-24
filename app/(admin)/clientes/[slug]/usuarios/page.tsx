import { requireWorkspace } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTimeShort } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { InviteForm, MemberRow } from "@/components/admin/settings-client";

export default async function Usuarios({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w } = await requireWorkspace(slug);
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, role, last_seen_at, profiles(full_name, email)")
    .eq("workspace_id", w.id);
  const rows = (members ?? []) as unknown as {
    user_id: string;
    role: "client_editor" | "client_viewer";
    last_seen_at: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Dar acceso a alguien del cliente</CardTitle>
          <p className="text-sm text-muted">
            Entra con su email (le llega un link, sin contraseña). Si el mail no le llega, generá un “Link de acceso” y mandáselo por WhatsApp.
          </p>
        </CardHeader>
        <CardContent>
          <InviteForm workspaceId={w.id} />
        </CardContent>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="Todavía nadie del cliente tiene acceso" />
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.user_id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-medium">{m.profiles?.full_name ?? m.profiles?.email}</p>
              <p className="mb-2 text-sm text-muted">
                {m.profiles?.email} · {m.last_seen_at ? `Última visita: ${formatDateTimeShort(m.last_seen_at)}` : "Todavía no entró"}
              </p>
              <MemberRow workspaceId={w.id} userId={m.user_id} email={m.profiles?.email ?? ""} role={m.role} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
