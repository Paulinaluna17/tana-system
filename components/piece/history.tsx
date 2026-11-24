import { ArrowRight, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { formatDateTimeShort, formatLong } from "@/lib/dates";
import { STATUS_META } from "@/lib/status";
import type { ContentStatus } from "@/lib/types";

const FIELD_LABELS: Record<string, string> = {
  publish_at: "Fecha y hora",
  content_type_id: "Tipo de pieza",
  status: "Estado",
  title: "Tema / idea",
  objective: "Objetivo",
  audience: "Público",
  format: "Formato",
  recording_instructions: "Indicaciones de grabación",
  shot_list: "Tomas",
  script: "Guion",
  slides: "Placas",
  caption: "Copy",
  cta: "CTA",
  hashtags: "Hashtags",
  mentions: "Menciones",
  location: "Ubicación",
  client_material_request: "Material a mandar",
  client_material_due: "Fecha límite del material",
  clarifications: "Aclaraciones",
  final_asset_url: "Pieza terminada",
  published_url: "Link publicado",
  networks: "Redes",
  pillar_id: "Pilar",
  series_id: "Serie",
  production_owner: "Quién produce",
  production_person: "Responsable",
};

function show(field: string, v: unknown, typeLabels: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "publish_at") return formatLong(String(v));
  if (field === "status") return STATUS_META[v as ContentStatus]?.label ?? String(v);
  if (field === "content_type_id") return typeLabels[String(v)] ?? "—";
  if (field === "pillar_id" || field === "series_id") return "(cambió)";
  if (field === "shot_list" && Array.isArray(v))
    return (v as { text: string; done?: boolean }[]).map((s) => `${s.done ? "☑" : "☐"} ${s.text}`).join(" · ");
  if (field === "script" && Array.isArray(v))
    return (v as { section: string; voice?: string }[]).map((b) => `${b.section}: ${b.voice ?? ""}`).join(" · ");
  if (field === "slides" && Array.isArray(v)) return (v as { text: string }[]).map((s, i) => `${i + 1}) ${s.text}`).join(" · ");
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object")
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== "" && x != null)
      .map(([k, x]) => `${k}: ${x}`)
      .join(" · ") || "—";
  return String(v);
}

const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n) + "…" : s);

export interface VersionView {
  id: string;
  changed_at: string;
  author_name: string;
  diff: Record<string, { before: unknown; after: unknown }>;
}
export interface ApprovalView {
  id: string;
  action: "aprobado" | "cambios";
  note: string | null;
  created_at: string;
  author_name: string;
}

export function ApprovalsLog({ approvals }: { approvals: ApprovalView[] }) {
  if (!approvals.length) return <p className="text-sm text-muted">Sin aprobaciones todavía.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {approvals.map((a) => (
        <li key={a.id} className="flex items-start gap-2">
          {a.action === "aprobado" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
          ) : (
            <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-danger" />
          )}
          <span>
            <strong>{a.action === "aprobado" ? "Aprobado" : "Cambios pedidos"}</strong> por {a.author_name} el{" "}
            {formatDateTimeShort(a.created_at)}
            {a.note && <span className="block text-muted">“{a.note}”</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VersionHistory({
  versions,
  typeLabels,
}: {
  versions: VersionView[];
  typeLabels: Record<string, string>;
}) {
  if (!versions.length) return <p className="text-sm text-muted">Sin cambios registrados.</p>;
  return (
    <ol className="space-y-3">
      {versions.map((v) => (
        <li key={v.id} className="rounded-xl border border-line p-3 text-sm">
          <p className="mb-1 text-xs text-muted">
            <strong className="text-ink">{v.author_name}</strong> · {formatDateTimeShort(v.changed_at)}
          </p>
          <ul className="space-y-1.5">
            {Object.entries(v.diff).map(([field, d]) => (
              <li key={field}>
                <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
                <span className="text-muted line-through decoration-danger/60">{clip(show(field, d.before, typeLabels))}</span>
                <ArrowRight className="mx-1 inline size-3.5 text-muted" aria-label="cambió a" />
                <span>{clip(show(field, d.after, typeLabels))}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
