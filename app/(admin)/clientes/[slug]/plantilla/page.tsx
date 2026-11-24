import { requireWorkspace } from "@/lib/auth";
import { weekdayLabel } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { DeleteButton, NamedList, SlotDialog, TypeDialog } from "@/components/admin/settings-client";
import type { ContentType, Pillar, Series, TemplateSlot } from "@/lib/types";

const REC: Record<string, string> = {
  weekly: "todas las semanas",
  biweekly: "cada 15 días",
  monthly_first: "1° del mes",
  monthly_last: "último del mes",
};

export default async function Plantilla({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const [{ data: slots }, { data: types }, { data: pillars }, { data: series }, { data: tpls }] = await Promise.all([
    supabase.from("template_slots").select("*").eq("workspace_id", w.id).order("weekday").order("time"),
    supabase.from("content_types").select("*").eq("workspace_id", w.id).order("sort"),
    supabase.from("pillars").select("*").eq("workspace_id", w.id).order("name"),
    supabase.from("series").select("*").eq("workspace_id", w.id).order("name"),
    supabase.from("piece_templates").select("id, name, content_type_key, workspace_id").or(`workspace_id.is.null,workspace_id.eq.${w.id}`).order("name"),
  ]);
  const ts = (types ?? []) as ContentType[];
  const typeById = Object.fromEntries(ts.map((t) => [t.id, t]));
  const sl = (slots ?? []) as TemplateSlot[];
  const sr = (series ?? []) as Series[];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Plantilla semanal</CardTitle>
            <SlotDialog workspaceId={w.id} types={ts} series={sr} />
          </div>
          <p className="text-sm text-muted">
            Las publicaciones fijas de cada semana (incluye historias recurrentes). “Generar mes desde plantilla” crea todas las fechas
            automáticamente.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const list = sl.filter((s) => s.weekday === d);
              return (
                <div key={d} className="rounded-2xl border border-line p-3">
                  <p className="mb-2 text-sm font-semibold">{weekdayLabel(d)}</p>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted">Sin publicaciones fijas</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.map((s) => {
                        const t = typeById[s.content_type_id];
                        return (
                          <li key={s.id} className={`flex items-start gap-2 ${s.active ? "" : "opacity-50"}`}>
                            <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: t?.color, color: t?.text_color, border: `1px solid ${t?.text_color}33` }}>
                              {t?.label}
                            </span>
                            <span className="min-w-0 flex-1 text-sm">
                              <strong>{s.time.slice(0, 5)}</strong> · {REC[s.recurrence]}
                              {s.title_default && <span className="block text-xs text-muted">{s.title_default}</span>}
                              {s.story_template?.example && <span className="block text-xs italic text-muted">Ej.: {s.story_template.example}</span>}
                            </span>
                            <SlotDialog workspaceId={w.id} types={ts} series={sr} slot={s} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tipos de pieza y colores</CardTitle>
            <p className="text-sm text-muted">Tocá uno para cambiar nombre, color o descripción.</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ts.map((t) => (
              <TypeDialog key={t.id} workspaceId={w.id} type={t} />
            ))}
            <TypeDialog workspaceId={w.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pilares de contenido</CardTitle>
          </CardHeader>
          <CardContent>
            <NamedList workspaceId={w.id} table="pillars" items={(pillars ?? []) as Pillar[]} placeholder="Nuevo pilar" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Series / secciones fijas</CardTitle>
            <p className="text-sm text-muted">Ej.: “Testimonios reales”, “Un mate con los profes”.</p>
          </CardHeader>
          <CardContent>
            <NamedList workspaceId={w.id} table="series" items={sr} placeholder="Nueva serie" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plantillas de pieza</CardTitle>
            <p className="text-sm text-muted">Se crean desde una pieza con “Guardar como plantilla”.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {(tpls ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-1.5 text-sm">
                  <span>
                    {t.name} <span className="text-xs text-muted">{t.workspace_id ? "· de este cliente" : "· de Tana (todas las marcas)"}</span>
                  </span>
                  <DeleteButton table="piece_templates" id={t.id} label={t.name} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
