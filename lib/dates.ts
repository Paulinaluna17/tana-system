/**
 * Manejo de fechas — TODO se calcula en hora de Argentina (America/Argentina/Buenos_Aires).
 * Nunca calcular días de la semana "a mano": usamos date-fns + date-fns-tz.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISODay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const TZ = "America/Argentina/Buenos_Aires";
const WEEK = { weekStartsOn: 1 as const };

/** "YYYY-MM-DD" de un instante, en hora de Argentina. */
export function arDateKey(d: Date | string): string {
  return formatInTimeZone(new Date(d), TZ, "yyyy-MM-dd");
}

/** "HH:mm" de un instante, en hora de Argentina. */
export function arTime(d: Date | string): string {
  return formatInTimeZone(new Date(d), TZ, "HH:mm");
}

/** Convierte fecha + hora locales de Argentina a un instante UTC (para guardar en la base). */
export function arToUtc(dateKey: string, time = "00:00"): Date {
  return fromZonedTime(`${dateKey}T${time.slice(0, 5)}:00`, TZ);
}

/** Hoy en Argentina como "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): string {
  return arDateKey(now);
}

/** Convierte "YYYY-MM-DD" en un Date "local" (mediodía) para hacer aritmética de calendario sin problemas de zona. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function dateToKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Martes 3 de noviembre · 18:00 hs" — siempre derivado de la fecha real. */
export function formatLong(d: Date | string, withTime = true): string {
  const z = toZonedTime(new Date(d), TZ);
  const base = cap(format(z, "EEEE d 'de' MMMM", { locale: es }));
  return withTime ? `${base} · ${format(z, "HH:mm")} hs` : base;
}

/** "Mar 3/11 · 18:00" */
export function formatShort(d: Date | string): string {
  const z = toZonedTime(new Date(d), TZ);
  return `${cap(format(z, "EEE d/M", { locale: es }))} · ${format(z, "HH:mm")}`;
}

export function formatDayMonth(key: string): string {
  return format(keyToDate(key), "d/M");
}

export function formatDateKeyLong(key: string): string {
  return cap(format(keyToDate(key), "EEEE d 'de' MMMM", { locale: es }));
}

export function monthName(year: number, month: number): string {
  return cap(format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es }));
}

export function monthNameOnly(month: number): string {
  return cap(format(new Date(2026, month - 1, 1), "MMMM", { locale: es }));
}

export function formatDateTimeShort(d: Date | string): string {
  return formatInTimeZone(new Date(d), TZ, "dd/MM HH:mm");
}

export function weekdayLabel(isoWeekday: number, short = false): string {
  // 2026-11-02 es lunes
  const d = addDays(new Date(2026, 10, 2, 12), isoWeekday - 1);
  return cap(format(d, short ? "EEE" : "EEEE", { locale: es }));
}

/** Grilla del mes: semanas de lunes a domingo (incluye días de meses vecinos para completar). */
export function monthGrid(year: number, month: number): { key: string; inMonth: boolean }[][] {
  const first = new Date(year, month - 1, 1, 12);
  const start = startOfWeek(startOfMonth(first), WEEK);
  const end = endOfWeek(endOfMonth(first), WEEK);
  const days = eachDayOfInterval({ start, end });
  const weeks: { key: string; inMonth: boolean }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7).map((d) => ({ key: dateToKey(d), inMonth: isSameMonth(d, first) })));
  }
  return weeks;
}

/** Todas las fechas "YYYY-MM-DD" del mes (no existe el 31 de noviembre). */
export function daysOfMonth(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1, 12);
  return eachDayOfInterval({ start: first, end: endOfMonth(first) }).map(dateToKey);
}

/**
 * Número de semana dentro del mes. La Semana 1 es la primera semana (lun→dom) que contiene
 * un día hábil del mes. Ej.: noviembre 2026 empieza domingo → la Semana 1 es del lunes 2 al domingo 8.
 */
export function weekOfMonth(key: string): number {
  return Math.max(1, weekOfMonthRaw(key));
}

/** Igual que weekOfMonth pero puede dar 0 (días sueltos antes de la Semana 1, ej. domingo 1/11/2026). */
export function weekOfMonthRaw(key: string): number {
  const d = keyToDate(key);
  const first = startOfMonth(d);
  let firstWorkday = first;
  while (getISODay(firstWorkday) > 5) firstWorkday = addDays(firstWorkday, 1);
  const week1 = startOfWeek(firstWorkday, WEEK);
  return Math.floor(differenceInCalendarDays(startOfWeek(d, WEEK), week1) / 7) + 1;
}

/** Lunes→domingo de la semana que contiene `key`. */
export function weekRange(key: string): { start: string; end: string; days: string[] } {
  const d = keyToDate(key);
  const s = startOfWeek(d, WEEK);
  const days = Array.from({ length: 7 }, (_, i) => dateToKey(addDays(s, i)));
  return { start: days[0], end: days[6], days };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = addMonths(new Date(year, month - 1, 1, 12), delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Rango UTC [desde, hasta) que cubre el mes completo en hora argentina. */
export function monthRangeUtc(year: number, month: number): { from: string; to: string } {
  const next = shiftMonth(year, month, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: arToUtc(`${year}-${pad(month)}-01`).toISOString(),
    to: arToUtc(`${next.year}-${pad(next.month)}-01`).toISOString(),
  };
}

export function isoWeekday(key: string): number {
  return getISODay(keyToDate(key));
}

export function daysBetween(fromKey: string, toKey: string): number {
  return differenceInCalendarDays(keyToDate(toKey), keyToDate(fromKey));
}

export function addDaysKey(key: string, n: number): string {
  return dateToKey(addDays(keyToDate(key), n));
}

export function currentYearMonth(now: Date = new Date()): { year: number; month: number } {
  const [y, m] = todayKey(now).split("-").map(Number);
  return { year: y, month: m };
}
