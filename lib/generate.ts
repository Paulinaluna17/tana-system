/**
 * Generación automática del mes a partir de la plantilla semanal del cliente.
 * Función pura: devuelve qué piezas crear; la Server Action las inserta.
 */
import type { Recurrence } from "./types";
import { arToUtc, daysBetween, daysOfMonth, isoWeekday } from "./dates";

export interface SlotLike {
  id: string;
  weekday: number; // 1 = lunes ... 7 = domingo
  time: string; // "HH:mm" o "HH:mm:ss"
  recurrence: Recurrence;
  anchor_date: string | null;
  active: boolean;
}

export interface GeneratedSlot {
  slotId: string;
  dateKey: string;
  time: string;
  publishAt: string; // ISO UTC
}

export function slotMatches(slot: SlotLike, dateKey: string, monthDays: string[]): boolean {
  if (!slot.active || isoWeekday(dateKey) !== slot.weekday) return false;
  switch (slot.recurrence) {
    case "weekly":
      return true;
    case "biweekly": {
      if (!slot.anchor_date) return true;
      const diff = daysBetween(slot.anchor_date, dateKey);
      return ((diff % 14) + 14) % 14 === 0;
    }
    case "monthly_first":
      return monthDays.filter((d) => isoWeekday(d) === slot.weekday)[0] === dateKey;
    case "monthly_last": {
      const same = monthDays.filter((d) => isoWeekday(d) === slot.weekday);
      return same[same.length - 1] === dateKey;
    }
    default:
      return false;
  }
}

export function generateMonthSlots(slots: SlotLike[], year: number, month: number): GeneratedSlot[] {
  const days = daysOfMonth(year, month);
  const out: GeneratedSlot[] = [];
  for (const dateKey of days) {
    for (const slot of slots) {
      if (slotMatches(slot, dateKey, days)) {
        const time = slot.time.slice(0, 5);
        out.push({ slotId: slot.id, dateKey, time, publishAt: arToUtc(dateKey, time).toISOString() });
      }
    }
  }
  return out.sort((a, b) => a.publishAt.localeCompare(b.publishAt));
}

/**
 * Para "Duplicar mes anterior": ubica la misma posición (n-ésimo día X de la semana) en el mes destino.
 * Ej.: el 2° martes de noviembre → 2° martes de diciembre. Si no existe (5° lunes), devuelve null.
 */
export function mapToSameWeekdayOccurrence(sourceKey: string, year: number, month: number): string | null {
  const wd = isoWeekday(sourceKey);
  const [sy, sm] = sourceKey.split("-").map(Number);
  const nth = daysOfMonth(sy, sm)
    .filter((d) => isoWeekday(d) === wd)
    .indexOf(sourceKey);
  const target = daysOfMonth(year, month).filter((d) => isoWeekday(d) === wd);
  return target[nth] ?? null;
}
