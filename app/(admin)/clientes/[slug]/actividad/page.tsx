import Link from "next/link";
import { Lock } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { formatDateTimeShort } from "@/lib/dates";
import { Card, CardContent, EmptyState } from "@/components/ui";
import type { ActivityRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  ["", "Todo"],
  ["approved", "Aprobaciones"],
  ["changes_requested", "Cambios pedidos"],
  ["status", "Cambios de estado"],
  ["commented", "Comentarios"],
  ["payment", "Pagos"],
] as const;

export default async function Actividad({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { slug } = await params;
  const { f = "" } = await searchParams;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  let q = supabase
    .from("activity_log")
    .select("*, profiles(full_name, is_tana_admin)")
    .eq("workspace_id", w.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (f === "payment") q = q.like("action", "payment%");
  else if (f) q = q.eq("action", f);
  const { data } = await q;
  const rows = (data ?? []) as (ActivityRow & { profiles: { full_name: string | null; is_tana_admin: boolean } | null })[];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <Link
            key={k}
            href={`/clientes/${slug}/actividad${k ? `?f=${k}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-sm", f === k ? "border-ink bg-ink text-bg" : "border-line hover:bg-ink/5")}
          >
            {l}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Sin actividad registrada" />
      ) : (
        <Card>
          <CardContent>
            <ol className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted">{formatDateTimeShort(r.created_at)}</span>
                  <span className="min-w-0 flex-1">
                    {r.summary}
                    {!r.client_visible && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted">
                        <Lock className="size-3" /> interno
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {r.profiles?.full_name ?? "Sistema"}
                    {r.profiles?.is_tana_admin ? " · Tana" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
