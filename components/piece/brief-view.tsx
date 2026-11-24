import { Check, CircleDashed, ExternalLink } from "lucide-react";
import type { ContentItem, ContentType } from "@/lib/types";
import { formatDateKeyLong, formatLong, weekOfMonth, arDateKey } from "@/lib/dates";
import { CopyButton, ShotChecklist } from "./brief-client";

/** Texto con viñetas: líneas que empiezan con "- " se muestran como lista. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
          {list.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (/^\s*[-•]\s+/.test(l)) list.push(l.replace(/^\s*[-•]\s+/, ""));
    else {
      flush();
      if (l.trim()) blocks.push(<p key={`p-${blocks.length}`}>{l}</p>);
    }
  }
  flush();
  return <div className={className ?? "space-y-2 leading-relaxed"}>{blocks}</div>;
}

function Block({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "accent" }) {
  return (
    <section className="space-y-2">
      <h3 className={`text-xs font-bold uppercase tracking-[0.12em] ${tone === "accent" ? "text-accent" : "text-accent"}`}>{title}</h3>
      <div className="rounded-2xl border border-line bg-surface p-4 text-[15px]">{children}</div>
    </section>
  );
}

const ratioLabel = (r?: string) =>
  r === "9:16" ? "Vertical 9:16" : r === "4:5" ? "Vertical 4:5" : r === "1:1" ? "Cuadrado 1:1" : r === "16:9" ? "Horizontal 16:9" : r;

export function BriefView({
  item,
  type,
  pillarName,
  seriesName,
  canToggleShots = false,
  showHeader = true,
}: {
  item: ContentItem;
  type?: ContentType;
  pillarName?: string | null;
  seriesName?: string | null;
  canToggleShots?: boolean;
  showHeader?: boolean;
}) {
  const f = item.format ?? {};
  const fmt = [
    f.ratio && ["Formato", ratioLabel(f.ratio)],
    f.duration && ["Duración", f.duration],
    f.slides && ["Placas", String(f.slides)],
    f.audio && ["Audio", f.audio],
    f.on_screen_text && ["Texto en pantalla", f.on_screen_text],
  ].filter(Boolean) as [string, string][];
  const dk = arDateKey(item.publish_at);

  return (
    <div className="space-y-5">
      {showHeader && (
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-lg px-3 py-1 text-sm font-bold uppercase tracking-wide"
              style={{ background: type?.color, color: type?.text_color, border: `1px solid ${type?.text_color}33` }}
            >
              {type?.label}
            </span>
            <span className="text-sm font-semibold text-accent">SEMANA {weekOfMonth(dk)}</span>
            {seriesName && <span className="rounded-full border border-line px-2 py-0.5 text-xs">{seriesName}</span>}
            {pillarName && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{pillarName}</span>}
          </div>
          <p className="text-lg">{formatLong(item.publish_at)}</p>
        </header>
      )}

      {item.title && (
        <Block title="Tema / idea">
          <p className="font-medium">{item.title}</p>
        </Block>
      )}
      {item.objective && (
        <Block title="Objetivo de la pieza">
          <RichText text={item.objective} />
        </Block>
      )}
      {item.audience && (
        <Block title="A quién le habla">
          <RichText text={item.audience} />
        </Block>
      )}
      {fmt.length > 0 && (
        <Block title="Formato">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fmt.map(([k, val]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium">{val}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}
      {item.recording_instructions && (
        <Block title={item.production_owner === "tana" ? "Indicaciones de producción" : "Indicaciones de grabación"}>
          <RichText text={item.recording_instructions} />
        </Block>
      )}
      {item.shot_list?.length > 0 && (
        <Block title="Tomas a grabar">
          <ShotChecklist itemId={item.id} shots={item.shot_list} editable={canToggleShots} />
        </Block>
      )}
      {item.script?.length > 0 && (
        <Block title="Guion">
          <ol className="space-y-3">
            {item.script.map((b, i) => (
              <li key={i} className="grid gap-1 border-b border-line pb-3 last:border-0 last:pb-0 sm:grid-cols-[9rem_1fr]">
                <div>
                  <p className="text-sm font-semibold">{b.section}</p>
                  {b.time && <p className="text-xs text-muted">{b.time}</p>}
                </div>
                <div className="space-y-1">
                  {b.voice && <p className="whitespace-pre-line">{b.voice}</p>}
                  {b.on_screen && (
                    <p className="text-sm text-muted">
                      <span className="font-semibold">Texto en pantalla:</span> {b.on_screen}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Block>
      )}
      {item.slides?.length > 0 && (
        <Block title="Placa por placa">
          <ol className="space-y-2">
            {item.slides.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <span className="whitespace-pre-line">{s.text}</span>
              </li>
            ))}
          </ol>
        </Block>
      )}
      {item.caption && (
        <Block title="Copy / texto sugerido">
          <p className="whitespace-pre-line">{item.caption}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton text={[item.caption, item.hashtags].filter(Boolean).join("\n\n")} />
            <span className="text-xs text-muted">{item.caption.length} caracteres</span>
          </div>
        </Block>
      )}
      {(item.cta || item.hashtags || item.mentions || item.location) && (
        <Block title="Llamado a la acción y detalles">
          <dl className="space-y-2">
            {item.cta && (
              <div>
                <dt className="text-xs text-muted">CTA</dt>
                <dd className="font-medium">{item.cta}</dd>
              </div>
            )}
            {item.hashtags && (
              <div>
                <dt className="text-xs text-muted">Hashtags</dt>
                <dd>{item.hashtags}</dd>
              </div>
            )}
            {item.mentions && (
              <div>
                <dt className="text-xs text-muted">Menciones</dt>
                <dd>{item.mentions}</dd>
              </div>
            )}
            {item.location && (
              <div>
                <dt className="text-xs text-muted">Ubicación</dt>
                <dd>{item.location}</dd>
              </div>
            )}
          </dl>
        </Block>
      )}
      {item.client_material_request && (
        <Block title="Material que tenés que mandar">
          <p>{item.client_material_request}</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm">
            {item.client_material_sent_at ? (
              <>
                <Check className="size-4 text-ok" /> <span className="text-ok">Enviado</span>
              </>
            ) : (
              <>
                <CircleDashed className="size-4 text-warn" />
                <span className="text-warn">
                  Pendiente{item.client_material_due ? ` · hasta el ${formatDateKeyLong(item.client_material_due).toLowerCase()}` : ""}
                </span>
              </>
            )}
          </p>
          {item.client_material_note && <p className="mt-1 text-sm text-muted">“{item.client_material_note}”</p>}
        </Block>
      )}
      {(item.references?.length > 0 || item.final_asset_url || item.published_url) && (
        <Block title="Links">
          <ul className="space-y-1.5">
            {item.final_asset_url && <LinkRow href={item.final_asset_url} label="Pieza terminada (para previsualizar)" />}
            {item.published_url && <LinkRow href={item.published_url} label="Ver publicación" />}
            {item.references?.map((r, i) => <LinkRow key={i} href={r.url} label={r.label || "Referencia"} />)}
          </ul>
        </Block>
      )}
      {item.clarifications && (
        <Block title="Aclaraciones">
          <RichText text={item.clarifications} />
        </Block>
      )}
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent underline-offset-2 hover:underline">
        <ExternalLink className="size-4" /> {label}
      </a>
    </li>
  );
}
