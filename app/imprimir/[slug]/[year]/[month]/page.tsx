import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { loadCalendar } from "@/lib/data";
import { arDateKey, arTime, monthGrid, monthName, weekOfMonth, formatDayMonth, formatDateKeyLong } from "@/lib/dates";
import { brandCssVars, googleFontsHref } from "@/lib/brand";
import { BriefView } from "@/components/piece/brief-view";
import { MarkdownLite } from "@/components/markdown-lite";
import { PrintButton } from "@/components/misc/print-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendario para imprimir" };

export default async function PrintMonth({ params }: { params: Promise<{ slug: string; year: string; month: string }> }) {
  const { slug, year: ys, month: ms } = await params;
  const year = Number(ys);
  const month = Number(ms);
  if (!Number.isInteger(year) || month < 1 || month > 12) notFound();
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const data = await loadCalendar(supabase, w.id, year, month);
  const items = data.items.filter((i) => !["idea", "en_redaccion", "cancelado", "reemplazado"].includes(i.status));
  const typeById = Object.fromEntries(data.types.map((t) => [t.id, t]));
  const isStory = (id: string) => typeById[id]?.key === "historia";
  const pieces = items.filter((i) => !isStory(i.content_type_id));
  const stories = items.filter((i) => isStory(i.content_type_id));
  const grid = monthGrid(year, month);
  const label = monthName(year, month);
  const storyWeeks = Array.from(new Set(stories.map((s) => weekOfMonth(arDateKey(s.publish_at)))));

  const Footer = ({ n }: { n: number }) => (
    <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between text-[10px] text-muted">
      <span>{w.name} · Tana Studio</span>
      <span>{String(n).padStart(2, "0")}</span>
    </div>
  );
  let page = 1;

  return (
    <div style={brandCssVars(w.brand)} data-theme={w.brand.theme} className="bg-bg text-ink">
      { }
      <link rel="stylesheet" href={googleFontsHref(w.brand)} />
      <PrintButton />
      <section className="print-page relative flex min-h-[190mm] flex-col items-center justify-center gap-6 p-10 text-center">
        {w.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.logo_url} alt={w.name} className="max-h-40 max-w-xs object-contain" />
        )}
        <div className="h-0.5 w-full bg-accent" />
        <h1 className="font-display text-6xl font-bold uppercase leading-tight">Calendario de contenidos</h1>
        <p className="text-2xl font-semibold uppercase text-accent">{label}</p>
        {data.month?.intro && <p className="max-w-2xl text-sm text-muted">{data.month.intro}</p>}
        <p className="text-xs text-muted">Planificación y dirección de contenido a cargo de Tana Studio</p>
        <Footer n={page++} />
      </section>

      {w.how_to_read_md && (
        <section className="print-page relative min-h-[190mm] p-10">
          <h2 className="mb-4 font-display text-3xl font-bold uppercase">Cómo leer este calendario</h2>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {data.types
              .filter((t) => !["tiktok", "otro"].includes(t.key) && items.some((i) => i.content_type_id === t.id))
              .map((t) => (
                <div key={t.id} className="rounded-xl p-4" style={{ background: t.color, color: t.text_color, border: `1px solid ${t.text_color}33` }}>
                  <p className="text-lg font-bold uppercase">{t.label}</p>
                  {t.description && <p className="text-sm opacity-90">{t.description}</p>}
                </div>
              ))}
          </div>
          <div className="prose-tana text-sm">
            <MarkdownLite text={w.how_to_read_md} />
          </div>
          <Footer n={page++} />
        </section>
      )}

      <section className="print-page relative min-h-[190mm] p-8">
        <h2 className="mb-3 font-display text-3xl font-bold uppercase">{label}</h2>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase text-muted">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {grid.flat().map((d) => {
            const list = items.filter((i) => arDateKey(i.publish_at) === d.key);
            return (
              <div key={d.key} className={cn("min-h-[26mm] rounded-lg border border-line p-1.5", d.inMonth ? "bg-surface" : "opacity-30")}>
                <p className="text-sm font-bold">{d.inMonth ? Number(d.key.slice(8)) : ""}</p>
                {d.inMonth &&
                  list.map((i) => {
                    const t = typeById[i.content_type_id];
                    return (
                      <p key={i.id} className="mt-0.5 rounded px-1 text-[9px] font-bold uppercase" style={{ background: t?.color, color: t?.text_color }}>
                        {t?.label} {arTime(i.publish_at)}
                      </p>
                    );
                  })}
              </div>
            );
          })}
        </div>
        {w.calendar_note && <p className="mt-3 text-xs italic text-muted">{w.calendar_note}</p>}
        <Footer n={page++} />
      </section>

      {pieces.map((i) => (
        <section key={i.id} className="print-page relative min-h-[190mm] p-8">
          <BriefView
            item={i}
            type={typeById[i.content_type_id]}
            pillarName={data.pillars.find((p) => p.id === i.pillar_id)?.name}
            seriesName={data.series.find((s) => s.id === i.series_id)?.name}
          />
          <Footer n={page++} />
        </section>
      ))}

      {storyWeeks.length > 0 && (
        <section className="print-page relative min-h-[190mm] p-8">
          <h2 className="mb-4 font-display text-3xl font-bold uppercase">Historias</h2>
          <div className="grid grid-cols-2 gap-3">
            {storyWeeks.map((wk) => {
              const list = stories.filter((s) => weekOfMonth(arDateKey(s.publish_at)) === wk);
              const first = arDateKey(list[0].publish_at);
              const last = arDateKey(list[list.length - 1].publish_at);
              return (
                <div key={wk} className="rounded-xl border border-line bg-surface p-3 text-sm">
                  <p className="mb-1 font-semibold text-accent">
                    Semana {wk} · {formatDayMonth(first)} al {formatDayMonth(last)}
                  </p>
                  <ul className="space-y-1">
                    {list.map((s) => (
                      <li key={s.id}>
                        <strong>{formatDateKeyLong(arDateKey(s.publish_at)).split(" ")[0]} {arTime(s.publish_at)}</strong> · {s.title || "Historia"}
                        {s.objective && <span className="block text-xs text-muted">{s.objective.split("\n")[0]}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <Footer n={page++} />
        </section>
      )}
    </div>
  );
}
