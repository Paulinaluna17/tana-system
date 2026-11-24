import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Check } from "lucide-react";
import { arDateKey, arTime, formatDateKeyLong, monthGrid, monthName, todayKey, weekOfMonth, formatDayMonth } from "@/lib/dates";
import { brandCssVars, googleFontsHref } from "@/lib/brand";
import { isStruck } from "@/lib/status";
import { BriefView } from "@/components/piece/brief-view";
import { StatusBadge } from "@/components/status";
import type { Brand, ContentItem, ContentType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendario de contenidos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Shared {
  month: { id: string; year: number; month: number; status: string; intro: string | null };
  workspace: { name: string; slug: string; logo_url: string | null; brand: Brand; how_to_read_md: string | null; calendar_note: string | null };
  types: ContentType[];
  items: ContentItem[];
}

/** Vista pública de solo lectura (link con token revocable). Nunca incluye notas internas ni borradores. */
export default async function Compartir({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase.rpc("get_shared_month", { p_token: token });
  if (!data) notFound();
  const d = data as Shared;
  const w = d.workspace;
  const typeById = Object.fromEntries(d.types.map((t) => [t.id, t]));
  const now = new Date();
  const today = todayKey(now);
  const weeks = monthGrid(d.month.year, d.month.month).map((wk) => wk.map((x) => x.key)).filter((wk) => wk.some((k) => Number(k.slice(5, 7)) === d.month.month));

  return (
    <div style={brandCssVars(w.brand)} data-theme={w.brand.theme} className="min-h-screen bg-bg text-ink">
      { }
      <link rel="stylesheet" href={googleFontsHref(w.brand)} />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 py-8 text-center">
          {w.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.logo_url} alt={w.name} className="h-20 w-auto object-contain" />
          )}
          <h1 className="font-display text-3xl font-bold uppercase">Calendario de contenidos</h1>
          <p className="text-lg font-semibold uppercase text-accent">{monthName(d.month.year, d.month.month)}</p>
          {d.month.intro && <p className="max-w-2xl text-sm text-muted">{d.month.intro}</p>}
          <p className="text-xs text-muted">Vista de solo lectura · Planificación de Tana Studio</p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {weeks.map((wk) => {
          const inMonth = wk.filter((k) => Number(k.slice(5, 7)) === d.month.month);
          const list = d.items.filter((i) => inMonth.includes(arDateKey(i.publish_at)));
          if (!list.length) return null;
          return (
            <section key={wk[0]}>
              <h2 className={cn("mb-2 text-sm font-semibold", wk.includes(today) ? "text-accent" : "text-muted")}>
                Semana {weekOfMonth(inMonth[0])} · {formatDayMonth(inMonth[0])} al {formatDayMonth(inMonth[inMonth.length - 1])}
              </h2>
              <ul className="space-y-2">
                {list.map((i) => {
                  const t = typeById[i.content_type_id];
                  const struck = isStruck(i, now);
                  const story = t?.key === "historia";
                  return (
                    <li key={i.id} className="rounded-2xl border border-line bg-surface">
                      <details>
                        <summary className="flex cursor-pointer list-none items-start gap-3 p-3">
                          <span className="mt-0.5 w-20 shrink-0 rounded-md px-1.5 py-1 text-center text-[11px] font-bold uppercase" style={{ background: t?.color, color: t?.text_color, border: `1px solid ${t?.text_color}33` }}>
                            {t?.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block font-medium", struck && "text-muted line-through")}>
                              {struck && <Check className="mr-1 inline size-4 text-ok" />}
                              {i.title || t?.label}
                            </span>
                            <span className="block text-xs text-muted">
                              {formatDateKeyLong(arDateKey(i.publish_at))} · {arTime(i.publish_at)} hs
                            </span>
                            <span className="mt-1 inline-block">
                              <StatusBadge status={i.status} client />
                            </span>
                          </span>
                          {!story && <span className="text-xs text-accent">Ver detalle ▾</span>}
                        </summary>
                        <div className="border-t border-line p-4">
                          <BriefView item={i} type={t} showHeader={false} />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {w.calendar_note && <p className="text-center text-xs italic text-muted">{w.calendar_note}</p>}
      </main>
      <footer className="pb-8 text-center text-xs text-muted">Hecho por Tana Studio</footer>
    </div>
  );
}
