import { requireWorkspace } from "@/lib/auth";
import { formatDateTimeShort } from "@/lib/dates";
import { Card, CardContent, EmptyState } from "@/components/ui";
import type { ActivityRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export default async function Novedades({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase, role } = await requireWorkspace(slug);
  // Marca la visita y obtiene la anterior, para resaltar lo nuevo.
  const { data: prevSeen } = role === "admin" ? { data: null } : await supabase.rpc("mark_workspace_seen", { p_ws: w.id });
  const { data } = await supabase
    .from("activity_log")
    .select("*, profiles(full_name, is_tana_admin)")
    .eq("workspace_id", w.id)
    .eq("client_visible", true)
    .order("created_at", { ascending: false })
    .limit(80);
  const rows = (data ?? []) as (ActivityRow & { profiles: { full_name: string | null; is_tana_admin: boolean } | null })[];
  const since = prevSeen as string | null;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Novedades</h1>
      <p className="text-sm text-muted">Todo lo que cambió en tu calendario, en orden. Lo nuevo desde tu última visita aparece resaltado.</p>
      {rows.length === 0 ? (
        <EmptyState title="Todavía no hay novedades" />
      ) : (
        <Card>
          <CardContent>
            <ol className="space-y-2">
              {rows.map((r) => {
                const isNew = since ? r.created_at > since : false;
                return (
                  <li key={r.id} className={cn("rounded-xl p-2 text-sm", isNew && "bg-accent/10")}>
                    <p>
                      {isNew && <span className="mr-1 rounded bg-accent px-1 text-[10px] font-bold uppercase text-accent-ink">Nuevo</span>}
                      {r.summary}
                    </p>
                    <p className="text-xs text-muted">
                      {r.profiles?.full_name ?? "Sistema"}
                      {r.profiles?.is_tana_admin ? " · Tana" : ""} · {formatDateTimeShort(r.created_at)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
