import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Paperclip } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { loadPiece } from "@/lib/piece";
import { arDateKey, arTime, formatDateTimeShort } from "@/lib/dates";
import { PieceEditor } from "@/components/piece/editor";
import { Conversation } from "@/components/piece/conversation";
import { ApprovalsLog, VersionHistory } from "@/components/piece/history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { LateBadge, StatusBadge, UrgentBadge } from "@/components/status";
import { getTimeState, isUrgentApproval } from "@/lib/status";
import type { ItemInput } from "@/app/actions/content";

export default async function PiezaAdmin({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const data = await loadPiece(supabase, id, w.id, true);
  if (!data) notFound();
  const { item } = data;
  const dk = arDateKey(item.publish_at);
  const [y, m] = dk.split("-").map(Number);

  const initial: ItemInput = {
    content_type_id: item.content_type_id,
    date: dk,
    time: arTime(item.publish_at),
    networks: item.networks ?? ["instagram"],
    status: item.status,
    pillar_id: item.pillar_id,
    series_id: item.series_id,
    production_owner: item.production_owner,
    production_person: item.production_person,
    title: item.title ?? "",
    objective: item.objective,
    audience: item.audience,
    format: item.format ?? {},
    recording_instructions: item.recording_instructions,
    shot_list: item.shot_list ?? [],
    script: item.script ?? [],
    slides: item.slides ?? [],
    caption: item.caption,
    cta: item.cta,
    hashtags: item.hashtags,
    mentions: item.mentions,
    location: item.location,
    client_material_request: item.client_material_request,
    client_material_due: item.client_material_due,
    references: item.references ?? [],
    final_asset_url: item.final_asset_url,
    published_url: item.published_url,
    clarifications: item.clarifications,
    is_visible_to_client: item.is_visible_to_client,
    metrics: item.metrics ?? {},
    internal_notes: data.internalNotes,
  };
  const typeLabels = Object.fromEntries(data.types.map((t) => [t.id, t.label]));
  const late = getTimeState(item) === "atrasada";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/clientes/${slug}/calendario?y=${y}&m=${m}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Calendario
        </Link>
        <span className="flex-1" />
        <StatusBadge status={item.status} />
        {late && <LateBadge />}
        {isUrgentApproval(item, w.approval_lead_days) && <UrgentBadge />}
        <Link href={`/portal/${slug}/pieza/${id}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <ExternalLink className="size-4" /> Ver como cliente
        </Link>
      </div>
      {item.status === "reemplazado" && item.replaced_by_id && (
        <p className="rounded-xl border border-line bg-ink/5 p-3 text-sm">
          Esta pieza fue reemplazada.{" "}
          <Link className="text-accent underline" href={`/clientes/${slug}/pieza/${item.replaced_by_id}`}>
            Ver la nueva
          </Link>
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <PieceEditor
          id={id}
          initial={initial}
          types={data.types}
          pillars={data.pillars}
          series={data.series}
          templates={data.templates}
          revisionInfo={`Rondas de cambios: ${item.revision_count} de ${w.revision_rounds} incluidas.${
            item.revision_count > w.revision_rounds ? " ⚠ Se superaron las rondas incluidas." : ""
          }`}
        />
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversación</CardTitle>
            </CardHeader>
            <CardContent>
              <Conversation itemId={id} comments={data.comments} isAdmin canComment />
            </CardContent>
          </Card>
          {(data.assets.length > 0 || item.client_material_sent_at) && (
            <Card>
              <CardHeader>
                <CardTitle>Material recibido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {item.client_material_sent_at && (
                  <p className="text-ok">Marcado como enviado el {formatDateTimeShort(item.client_material_sent_at)}</p>
                )}
                {item.client_material_note && <p className="text-muted">“{item.client_material_note}”</p>}
                <ul className="space-y-1">
                  {data.assets.map((a) => (
                    <li key={a.id}>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          <Paperclip className="size-4" /> {a.name}
                        </a>
                      ) : (
                        a.name
                      )}{" "}
                      <span className="text-xs text-muted">· {a.author_name}</span>
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
              <CardTitle>Historial de cambios</CardTitle>
            </CardHeader>
            <CardContent>
              <VersionHistory versions={data.versions} typeLabels={typeLabels} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
