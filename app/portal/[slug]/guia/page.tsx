import { requireWorkspace } from "@/lib/auth";
import { RichText } from "@/components/piece/brief-view";
import { StatusBadge } from "@/components/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { STATUS_META } from "@/lib/status";
import type { ContentStatus, ContentType } from "@/lib/types";
import { MarkdownLite } from "@/components/markdown-lite";

const CLIENT_STATUSES: ContentStatus[] = [
  "para_revisar",
  "cambios_solicitados",
  "aprobado",
  "en_produccion",
  "material_recibido",
  "en_edicion",
  "listo",
  "publicado",
];

export default async function Guia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const { data: types } = await supabase.from("content_types").select("*").eq("workspace_id", w.id).order("sort");
  const used = ((types ?? []) as ContentType[]).filter((t) => !["tiktok", "otro"].includes(t.key));
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">Cómo leer este calendario</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {used.map((t) => (
          <div key={t.id} className="rounded-2xl p-4" style={{ background: t.color, color: t.text_color, border: `1px solid ${t.text_color}22` }}>
            <p className="text-lg font-bold uppercase">{t.label}</p>
            {t.description && <p className="mt-1 text-sm opacity-90">{t.description}</p>}
          </div>
        ))}
      </div>
      {w.how_to_read_md && (
        <Card>
          <CardContent className="prose-tana">
            <MarkdownLite text={w.how_to_read_md} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>¿Qué significa cada estado?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {CLIENT_STATUSES.map((s) => (
              <li key={s} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-56 shrink-0">
                  <StatusBadge status={s} client />
                </span>
                <span className="text-sm text-muted">{STATUS_META[s].help}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>En el calendario</CardTitle>
        </CardHeader>
        <CardContent>
          <RichText
            text={[
              "- Lo que ya se publicó aparece tachado con un ✓.",
              "- El día de hoy está resaltado.",
              "- “Atrasada” (en rojo) = la fecha pasó y todavía no se publicó.",
              "- “Actualizado” = Tana cambió esa pieza hace poco. Entrá para ver qué cambió.",
              "- “Aprobación urgente” = se publica en pocos días y todavía no la aprobaste.",
              w.calendar_note ? `- ${w.calendar_note}` : "",
            ]
              .filter(Boolean)
              .join("\n")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
