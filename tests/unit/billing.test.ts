import { describe, expect, it } from "vitest";
import { buildMonthlyInvoice } from "@/lib/billing";

const svc = (p: Record<string, unknown>) => ({
  id: "x",
  custom_name: null,
  services: { name: "Planificación" },
  price: 100,
  billing: "mensual" as const,
  status: "activo" as const,
  start_date: null,
  end_date: null,
  due_day: 10,
  ...p,
});

describe("cuota mensual automática", () => {
  it("suma los servicios mensuales activos y usa el día de vencimiento", () => {
    const inv = buildMonthlyInvoice([svc({ id: "a", price: 160000, due_day: 5 }), svc({ id: "b", price: 60000, due_day: 5 })], 2026, 12);
    expect(inv).toMatchObject({ period: "2026-12-01", amount: 220000, due_date: "2026-12-05" });
    expect(inv?.items).toHaveLength(2);
  });
  it("ignora propuestos, pausados, únicos y fuera de fecha", () => {
    const inv = buildMonthlyInvoice(
      [
        svc({ id: "a", price: 100 }),
        svc({ id: "b", status: "propuesto" }),
        svc({ id: "c", status: "pausado" }),
        svc({ id: "d", billing: "unico" }),
        svc({ id: "e", start_date: "2027-01-01" }),
        svc({ id: "f", end_date: "2026-11-30" }),
      ],
      2026,
      12,
    );
    expect(inv?.items.map((i) => i.workspace_service_id)).toEqual(["a"]);
  });
  it("sin servicios activos no genera cuota", () => {
    expect(buildMonthlyInvoice([svc({ status: "inactivo" })], 2026, 12)).toBeNull();
  });
  it("febrero: el vencimiento no supera el último día", () => {
    expect(buildMonthlyInvoice([svc({ due_day: 28 })], 2027, 2)?.due_date).toBe("2027-02-28");
  });
});
