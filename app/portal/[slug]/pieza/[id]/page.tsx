import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { loadPiece } from "@/lib/piece";
import { arDateKey } from "@/lib/dates";
import { getTimeState, isUrgentApproval, showUpdatedBadge } from "@/lib/status";
import { BriefView } from "@/components/piece/brief-view";
import { RecordingMode } from "@/components/piece/brief-client";
import { Conversation } from "@/components/piece/conversation";
import { ApprovalsLog, VersionHistory } from "@/components/piece/history";
import { ClientPieceActions } from "@/components/portal/piece-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { LateBadge, StatusBadge, UpdatedBadge, UrgentBadge } from "@/components/status";
import { markItemSeen } from "@/app/actions/content";

export default async function PortalPieza({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { workspace: w, supabase, role, session } = await requireWorkspace(slug);
  const data = await loadPiece(supabase, id, w.id, false);
  if (!data) notFound();
  const { item } = data;
  const { data: view } = await supabase
    .from("item_views")
    .select("seen_at")
    .eq("user_id", session.userId)
    .eq("content_item_id", id)
    .maybeSingle();
  const updated = showUpdatedBadge(item, view?.seen_at);
  if (role !== "admin") await markItemSeen(id);

  const type = data.types.find((t) => t.id === item.content_type_id);
  const [y, m] = arDateKey(item.publish_at).split("-").map(Number);
  const canAct = role === "admin" || role === "client_editor";
  const typeLabels = Object.fromEntries(data.types.map((t) => [t.id, t.label]));
  const clientVersions = data.versions.filter((v) => Object.keys(v.diff).some((k) => k !== "shot_list"));

  return (
    <div className="space-y-4">
      <Link href={`/portal/${slug}/calendario?y=${y}&m=${m}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Volver al calendario
      </Link>
      {item.status === "reemplazado" && item.replaced_by_id && (
        <p className="rounded-xl border border-line p-3 text-sm">
          Esta pieza se cambió por otra.{" "}
          <Link className="text-accent underline" href={`/portal/${slug}/pieza/${item.replaced_by_id}`}>
            Ver la nueva
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={item.status} client />
        {getTimeState(item) === "atrasada" && <LateBadge />}
        {isUrgentApproval(item, w.approval_lead_days) && <UrgentBadge />}
        {updated && <UpdatedBadge />}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <ClientPieceActions
            itemId={id}
            workspaceId={w.id}
            status={item.status}
            canAct={canAct}
            revisionCount={item.revision_count}
            includedRounds={w.revision_rounds}
            needsMaterial={!!item.client_material_request && !item.client_material_sent_at}
          />
          <div className="sm:hidden">
            <RecordingMode
              itemId={id}
              title={item.title || type?.label || "Pieza"}
              instructions={item.recording_instructions}
              shots={item.shot_list}
              script={item.script}
              canToggle={canAct}
            />
          </div>
          <BriefView
            item={item}
            type={type}
            pillarName={data.pillars.find((p) => p.id === item.pillar_id)?.name}
            seriesName={data.series.find((s) => s.id === item.series_id)?.name}
            canToggleShots={canAct}
          />
        </div>
        <aside className="space-y-4">
          <div className="hidden sm:block">
            <RecordingMode
              itemId={id}
              title={item.title || type?.label || "Pieza"}
              instructions={item.recording_instructions}
              shots={item.shot_list}
              script={item.script}
              canToggle={canAct}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Comentarios</CardTitle>
            </CardHeader>
            <CardContent>
              <Conversation itemId={id} comments={data.comments.filter((c) => !c.is_internal)} isAdmin={false} canComment />
            </CardContent>
          </Card>
          {data.assets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Archivos enviados</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {data.assets.map((a) => (
                    <li key={a.id}>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          <Paperclip className="size-4" /> {a.name}
                        </a>
                      ) : (
                        a.name
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Aprobaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalsLog approvals={data.approvals} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Qué cambió</CardTitle>
            </CardHeader>
            <CardContent>
              <VersionHistory versions={clientVersions} typeLabels={typeLabels} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
