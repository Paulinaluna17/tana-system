import { requireWorkspace } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { DeleteButton, IdeaForm, ScheduleIdeaDialog } from "@/components/admin/settings-client";
import type { ContentType, Pillar } from "@/lib/types";

export default async function Ideas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const [{ data: ideas }, { data: types }, { data: pillars }] = await Promise.all([
    supabase.from("idea_bank").select("*").eq("workspace_id", w.id).order("created_at", { ascending: false }),
    supabase.from("content_types").select("*").eq("workspace_id", w.id).order("sort"),
    supabase.from("pillars").select("*").eq("workspace_id", w.id).order("name"),
  ]);
  const ts = (types ?? []) as ContentType[];
  const ps = (pillars ?? []) as Pillar[];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Banco de ideas</CardTitle>
          <p className="text-sm text-muted">Ideas sueltas para usar cuando haga falta. Solo las ve Tana.</p>
        </CardHeader>
        <CardContent>
          <IdeaForm workspaceId={w.id} types={ts} pillars={ps} />
        </CardContent>
      </Card>
      {(ideas ?? []).length === 0 ? (
        <EmptyState title="Sin ideas guardadas" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(ideas ?? []).map((i) => {
            const t = ts.find((x) => x.id === i.content_type_id);
            const p = ps.find((x) => x.id === i.pillar_id);
            return (
              <li key={i.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-muted">{[t?.label, p?.name].filter(Boolean).join(" · ")}</p>
                  </div>
                  <DeleteButton table="idea_bank" id={i.id} label={i.title} />
                </div>
                {i.notes && <p className="mt-1 text-sm text-muted">{i.notes}</p>}
                <div className="mt-3">
                  <ScheduleIdeaDialog ideaId={i.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
