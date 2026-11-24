import { describe, expect, it } from "vitest";
import {
  arDateKey,
  arToUtc,
  daysOfMonth,
  formatLong,
  monthGrid,
  weekOfMonth,
  isoWeekday,
} from "@/lib/dates";
import {
  dueText,
  getInvoiceStatus,
  getTimeState,
  isStruck,
  isUrgentApproval,
  monthProgress,
  showUpdatedBadge,
} from "@/lib/status";
import { generateMonthSlots, mapToSameWeekdayOccurrence, type SlotLike } from "@/lib/generate";

const at = (local: string) => arToUtc(local.slice(0, 10), local.slice(11, 16));

describe("fechas en hora de Argentina", () => {
  it("el 2/11/2026 es lunes y noviembre tiene 30 días", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(daysOfMonth(2026, 11)).toHaveLength(30);
    expect(daysOfMonth(2026, 11)).not.toContain("2026-11-31");
  });

  it("meses de 28, 30 y 31 días", () => {
    expect(daysOfMonth(2027, 2)).toHaveLength(28);
    expect(daysOfMonth(2028, 2)).toHaveLength(29);
    expect(daysOfMonth(2026, 12)).toHaveLength(31);
  });

  it("formatea la fecha derivada (nunca día y fecha que no coincidan)", () => {
    expect(formatLong(at("2026-11-03 18:00"))).toBe("Martes 3 de noviembre · 18:00 hs");
    expect(formatLong(at("2026-11-26 19:00"))).toBe("Jueves 26 de noviembre · 19:00 hs");
  });

  it("23:59 y 00:01 caen en el día correcto en Argentina (no en UTC)", () => {
    const late = at("2026-11-24 23:59");
    const early = at("2026-11-25 00:01");
    expect(late.toISOString()).toBe("2026-11-25T02:59:00.000Z");
    expect(arDateKey(late)).toBe("2026-11-24");
    expect(arDateKey(early)).toBe("2026-11-25");
  });

  it("la grilla arranca el lunes", () => {
    const g = monthGrid(2026, 11);
    expect(g[0][0].key).toBe("2026-10-26");
    expect(g[0][6].key).toBe("2026-11-01");
    expect(g[g.length - 1][6].key).toBe("2026-12-06");
  });

  it("semanas del mes: Semana 1 es la primera con días hábiles", () => {
    expect(weekOfMonth("2026-11-03")).toBe(1);
    expect(weekOfMonth("2026-11-01")).toBe(1);
    expect(weekOfMonth("2026-11-12")).toBe(2);
    expect(weekOfMonth("2026-11-26")).toBe(4);
    expect(weekOfMonth("2026-11-30")).toBe(5);
  });
});

describe("semáforo de cuotas", () => {
  const base = { paid_at: null, reported_at: null, status_override: null } as const;
  it("vence hoy / mañana → por vencer", () => {
    expect(getInvoiceStatus({ ...base, due_date: "2026-11-24" }, "2026-11-24")).toBe("por_vencer");
    expect(getInvoiceStatus({ ...base, due_date: "2026-11-25" }, "2026-11-24")).toBe("por_vencer");
    expect(getInvoiceStatus({ ...base, due_date: "2026-11-27" }, "2026-11-24")).toBe("por_vencer");
  });
  it("más de 3 días → pendiente", () => {
    expect(getInvoiceStatus({ ...base, due_date: "2026-11-28" }, "2026-11-24")).toBe("pendiente");
  });
  it("venció hace 1 día → vencido", () => {
    expect(getInvoiceStatus({ ...base, due_date: "2026-11-23" }, "2026-11-24")).toBe("vencido");
  });
  it("cambio de mes", () => {
    expect(getInvoiceStatus({ ...base, due_date: "2026-11-30" }, "2026-12-01")).toBe("vencido");
    expect(getInvoiceStatus({ ...base, due_date: "2026-12-02" }, "2026-11-30")).toBe("por_vencer");
  });
  it("pagado e informado ganan sobre la fecha", () => {
    expect(getInvoiceStatus({ ...base, due_date: "2026-01-01", paid_at: "2026-01-02" }, "2026-11-24")).toBe("pagado");
    expect(getInvoiceStatus({ ...base, due_date: "2026-01-01", reported_at: "2026-11-01" }, "2026-11-24")).toBe(
      "informado",
    );
  });
  it("textos", () => {
    expect(dueText("2026-11-24", "2026-11-24")).toBe("Vence hoy");
    expect(dueText("2026-11-25", "2026-11-24")).toBe("Vence mañana");
    expect(dueText("2026-12-06", "2026-11-24")).toBe("Vence en 12 días");
    expect(dueText("2026-11-23", "2026-11-24")).toBe("Venció ayer");
    expect(dueText("2026-11-20", "2026-11-24")).toBe("Venció hace 4 días");
  });
});

describe("estado temporal de piezas", () => {
  const now = at("2026-11-24 15:00");
  it("publicada en el pasado se tacha", () => {
    const it1 = { publish_at: at("2026-11-17 18:00").toISOString(), status: "publicado" as const };
    expect(getTimeState(it1, now)).toBe("publicada");
    expect(isStruck(it1, now)).toBe(true);
  });
  it("pasada sin publicar → atrasada", () => {
    expect(getTimeState({ publish_at: at("2026-11-20 19:00").toISOString(), status: "listo" }, now)).toBe("atrasada");
  });
  it("hoy más tarde → hoy; mañana → próxima", () => {
    expect(getTimeState({ publish_at: at("2026-11-24 18:00").toISOString(), status: "listo" }, now)).toBe("hoy");
    expect(getTimeState({ publish_at: at("2026-11-25 10:00").toISOString(), status: "aprobado" }, now)).toBe("proxima");
  });
  it("aprobación urgente según días de anticipación", () => {
    const item = { publish_at: at("2026-11-26 19:00").toISOString(), status: "para_revisar" as const };
    expect(isUrgentApproval(item, 3, now)).toBe(true);
    expect(isUrgentApproval(item, 2, now)).toBe(false);
    expect(isUrgentApproval({ ...item, status: "aprobado" }, 3, now)).toBe(false);
  });
  it("progreso del mes", () => {
    const items = [
      { publish_at: at("2026-11-03 18:00").toISOString(), status: "publicado" as const },
      { publish_at: at("2026-11-20 19:00").toISOString(), status: "listo" as const },
      { publish_at: at("2026-11-27 19:00").toISOString(), status: "aprobado" as const },
      { publish_at: at("2026-11-28 19:00").toISOString(), status: "cancelado" as const },
    ];
    const weeks = monthGrid(2026, 11).map((w) => w.map((d) => d.key));
    const p = monthProgress(items, weeks, now);
    expect(p).toMatchObject({ total: 3, published: 1, late: 1, pct: 33, weeksDone: 4, weeksTotal: 6 });
  });
  it("badge Actualizado: 7 días o hasta que lo vea", () => {
    const item = { client_changed_at: "2026-11-24T10:00:00Z", updated_flag_until: "2026-12-01T10:00:00Z" };
    expect(showUpdatedBadge(item, null, now)).toBe(true);
    expect(showUpdatedBadge(item, "2026-11-24T11:00:00Z", now)).toBe(false);
    expect(showUpdatedBadge(item, null, new Date("2026-12-02T00:00:00Z"))).toBe(false);
  });
});

describe("generar mes desde la plantilla", () => {
  const slot = (p: Partial<SlotLike>): SlotLike => ({
    id: p.id ?? "s",
    weekday: 2,
    time: "18:00:00",
    recurrence: "weekly",
    anchor_date: null,
    active: true,
    ...p,
  });

  it("martes semanales de noviembre 2026", () => {
    const g = generateMonthSlots([slot({})], 2026, 11);
    expect(g.map((x) => x.dateKey)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
    expect(g[0].publishAt).toBe("2026-11-03T21:00:00.000Z");
  });

  it("cada 15 días con fecha de referencia (reel de Las Popas)", () => {
    const s = slot({ weekday: 5, time: "20:00", recurrence: "biweekly", anchor_date: "2026-11-13" });
    expect(generateMonthSlots([s], 2026, 11).map((x) => x.dateKey)).toEqual(["2026-11-13", "2026-11-27"]);
    expect(generateMonthSlots([s], 2026, 12).map((x) => x.dateKey)).toEqual(["2026-12-11", "2026-12-25"]);
  });

  it("primer y último del mes", () => {
    expect(generateMonthSlots([slot({ weekday: 1, recurrence: "monthly_first" })], 2026, 11).map((x) => x.dateKey)).toEqual([
      "2026-11-02",
    ]);
    expect(generateMonthSlots([slot({ weekday: 1, recurrence: "monthly_last" })], 2026, 11).map((x) => x.dateKey)).toEqual([
      "2026-11-30",
    ]);
  });

  it("diciembre 2026 para Roma: 5 martes, 5 jueves, historias correctas", () => {
    const slots = [
      slot({ id: "post", weekday: 2 }),
      slot({ id: "reel", weekday: 4, time: "19:00" }),
      slot({ id: "h-lun", weekday: 1, time: "10:00" }),
    ];
    const g = generateMonthSlots(slots, 2026, 12);
    expect(g.filter((x) => x.slotId === "post")).toHaveLength(5);
    expect(g.filter((x) => x.slotId === "reel")).toHaveLength(5);
    expect(g.filter((x) => x.slotId === "h-lun").map((x) => x.dateKey)).toEqual([
      "2026-12-07",
      "2026-12-14",
      "2026-12-21",
      "2026-12-28",
    ]);
    expect(g.every((x) => x.dateKey.startsWith("2026-12"))).toBe(true);
  });

  it("slots inactivos no generan nada", () => {
    expect(generateMonthSlots([slot({ active: false })], 2026, 11)).toHaveLength(0);
  });

  it("duplicar: mismo n-ésimo día de la semana", () => {
    expect(mapToSameWeekdayOccurrence("2026-11-10", 2026, 12)).toBe("2026-12-08");
    expect(mapToSameWeekdayOccurrence("2026-11-30", 2026, 12)).toBe(null);
  });
});
