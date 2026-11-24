/**
 * Lógica pura de estados (piezas y cuotas). La misma regla del semáforo existe en SQL
 * (public.invoice_status) para que la base y la interfaz nunca discrepen.
 */
import type { ContentItem, ContentStatus, Invoice } from "./types";
import { arDateKey, daysBetween, todayKey } from "./dates";

// ------------------------------------------------------------------
// Estados de las piezas
// ------------------------------------------------------------------
export type Tone = "neutral" | "info" | "warn" | "ok" | "danger" | "accent" | "muted";

export const STATUS_META: Record<
  ContentStatus,
  { label: string; clientLabel: string; help: string; tone: Tone; icon: string; order: number }
> = {
  idea: { label: "Idea", clientLabel: "Idea", help: "Solo la ve Tana. Todavía es una idea.", tone: "muted", icon: "Lightbulb", order: 0 },
  en_redaccion: { label: "En redacción", clientLabel: "En redacción", help: "Tana la está escribiendo. El cliente todavía no la ve.", tone: "muted", icon: "PenLine", order: 1 },
  para_revisar: { label: "Para revisar", clientLabel: "Para que revises", help: "Esperando que el cliente la apruebe o pida cambios.", tone: "warn", icon: "Eye", order: 2 },
  cambios_solicitados: { label: "Cambios pedidos", clientLabel: "Cambios pedidos", help: "El cliente pidió cambios. Tana los está haciendo.", tone: "danger", icon: "MessageSquareWarning", order: 3 },
  aprobado: { label: "Aprobado", clientLabel: "Aprobado", help: "El cliente la aprobó.", tone: "ok", icon: "CheckCircle2", order: 4 },
  en_produccion: { label: "Para grabar", clientLabel: "Para grabar / en producción", help: "Lista para grabar o producir.", tone: "info", icon: "Video", order: 5 },
  material_recibido: { label: "Material recibido", clientLabel: "Material recibido", help: "Tana ya tiene el material.", tone: "info", icon: "Inbox", order: 6 },
  en_edicion: { label: "En edición", clientLabel: "En diseño / edición", help: "Tana la está diseñando o editando.", tone: "info", icon: "Scissors", order: 7 },
  listo: { label: "Listo", clientLabel: "Lista para publicar", help: "Terminada, lista para publicar.", tone: "accent", icon: "Rocket", order: 8 },
  publicado: { label: "Publicado", clientLabel: "Publicada", help: "Ya está publicada.", tone: "ok", icon: "BadgeCheck", order: 9 },
  cancelado: { label: "Cancelado", clientLabel: "Cancelada", help: "No se publica.", tone: "muted", icon: "Ban", order: 10 },
  reemplazado: { label: "Reemplazado", clientLabel: "Reemplazada", help: "Se cambió por otra pieza.", tone: "muted", icon: "Replace", order: 11 },
};

export const STATUS_ORDER = (Object.keys(STATUS_META) as ContentStatus[]).sort(
  (a, b) => STATUS_META[a].order - STATUS_META[b].order,
);

/** Estados que el cliente nunca ve. */
export const HIDDEN_FROM_CLIENT: ContentStatus[] = ["idea", "en_redaccion"];
/** Estados que no cuentan para el progreso del mes. */
export const INACTIVE: ContentStatus[] = ["cancelado", "reemplazado"];

export type TimeState = "publicada" | "atrasada" | "hoy" | "proxima" | "inactiva";

/**
 * Estado temporal de una pieza respecto de "ahora" (hora de Argentina):
 * - publicada: ya está publicada (se muestra tachada si su fecha ya pasó)
 * - atrasada: la fecha/hora ya pasó y NO está publicada
 * - hoy: se publica hoy y todavía no pasó la hora
 * - proxima: es a futuro
 */
export function getTimeState(item: Pick<ContentItem, "publish_at" | "status">, now: Date = new Date()): TimeState {
  if (INACTIVE.includes(item.status)) return "inactiva";
  if (item.status === "publicado") return "publicada";
  const when = new Date(item.publish_at);
  if (when.getTime() < now.getTime()) return "atrasada";
  if (arDateKey(when) === todayKey(now)) return "hoy";
  return "proxima";
}

/** ¿Se tacha en el calendario? Publicada y con fecha pasada. */
export function isStruck(item: Pick<ContentItem, "publish_at" | "status">, now: Date = new Date()): boolean {
  return item.status === "publicado" && new Date(item.publish_at).getTime() <= now.getTime();
}

/** Aprobación urgente: está para revisar y faltan menos de `leadDays` días para publicarse. */
export function isUrgentApproval(
  item: Pick<ContentItem, "publish_at" | "status">,
  leadDays: number,
  now: Date = new Date(),
): boolean {
  if (item.status !== "para_revisar" && item.status !== "cambios_solicitados") return false;
  const days = daysBetween(todayKey(now), arDateKey(item.publish_at));
  return days < leadDays;
}

/** ¿Mostrar la etiqueta "Actualizado" a este usuario? */
export function showUpdatedBadge(
  item: Pick<ContentItem, "updated_flag_until" | "client_changed_at">,
  seenAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!item.updated_flag_until || !item.client_changed_at) return false;
  if (new Date(item.updated_flag_until).getTime() < now.getTime()) return false;
  if (seenAt && new Date(seenAt).getTime() >= new Date(item.client_changed_at).getTime()) return false;
  return true;
}

export interface MonthProgress {
  total: number;
  published: number;
  late: number;
  pct: number;
  weeksDone: number;
  weeksTotal: number;
}

export function monthProgress(
  items: Pick<ContentItem, "publish_at" | "status">[],
  weeks: string[][],
  now: Date = new Date(),
): MonthProgress {
  const active = items.filter((i) => !INACTIVE.includes(i.status));
  const published = active.filter((i) => i.status === "publicado").length;
  const late = active.filter((i) => getTimeState(i, now) === "atrasada").length;
  const today = todayKey(now);
  const weeksDone = weeks.filter((w) => w[w.length - 1] < today).length;
  return {
    total: active.length,
    published,
    late,
    pct: active.length ? Math.round((published / active.length) * 100) : 0,
    weeksDone,
    weeksTotal: weeks.length,
  };
}

// ------------------------------------------------------------------
// Semáforo de cuotas
// ------------------------------------------------------------------
export type InvoiceStatus = "pagado" | "informado" | "vencido" | "por_vencer" | "pendiente" | "anulada";

export const INVOICE_META: Record<InvoiceStatus, { label: string; tone: Tone; icon: string; help: string }> = {
  pagado: { label: "Pagado", tone: "ok", icon: "CheckCircle2", help: "Pago recibido y confirmado por Tana." },
  informado: { label: "Informado", tone: "info", icon: "Clock", help: "El cliente subió el comprobante. Falta que Tana lo confirme." },
  por_vencer: { label: "Por vencer", tone: "warn", icon: "AlertTriangle", help: "Vence en 3 días o menos." },
  pendiente: { label: "Pendiente", tone: "neutral", icon: "Circle", help: "Todavía no venció." },
  vencido: { label: "Vencido", tone: "danger", icon: "XCircle", help: "La fecha de pago ya pasó y no está pagado." },
  anulada: { label: "Anulada", tone: "muted", icon: "Ban", help: "Esta cuota se anuló." },
};

export const DUE_SOON_DAYS = 3;

export function getInvoiceStatus(
  inv: Pick<Invoice, "paid_at" | "reported_at" | "due_date" | "status_override">,
  today: string = todayKey(),
): InvoiceStatus {
  if (inv.status_override === "anulada") return "anulada";
  if (inv.paid_at) return "pagado";
  if (inv.reported_at) return "informado";
  const diff = daysBetween(today, inv.due_date);
  if (diff < 0) return "vencido";
  if (diff <= DUE_SOON_DAYS) return "por_vencer";
  return "pendiente";
}

/** "Vence hoy", "Vence mañana", "Vence en 12 días", "Venció ayer", "Venció hace 4 días". */
export function dueText(dueDate: string, today: string = todayKey()): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff > 1) return `Vence en ${diff} días`;
  if (diff === -1) return "Venció ayer";
  return `Venció hace ${-diff} días`;
}

export const SERVICE_STATUS_META: Record<string, { label: string; tone: Tone; help: string }> = {
  activo: { label: "Activo", tone: "ok", help: "Contratado y en curso." },
  pausado: { label: "Pausado", tone: "neutral", help: "Suspendido temporalmente." },
  inactivo: { label: "Inactivo", tone: "muted", help: "No está contratado." },
  propuesto: { label: "Disponible para sumar", tone: "info", help: "Servicio que Tana ofrece y se puede agregar." },
};

export const BILLING_LABEL: Record<string, string> = {
  mensual: "por mes",
  unico: "pago único",
  por_pieza: "por pieza",
};
