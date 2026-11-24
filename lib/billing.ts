/** Armado de la cuota mensual a partir de los servicios contratados (función pura). */
import type { WorkspaceService } from "./types";

export interface InvoiceDraft {
  period: string; // YYYY-MM-01
  items: { workspace_service_id: string; name: string; amount: number }[];
  amount: number;
  due_date: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function serviceName(s: Pick<WorkspaceService, "custom_name" | "services">): string {
  return s.custom_name || s.services?.name || "Servicio";
}

export function buildMonthlyInvoice(
  services: Pick<WorkspaceService, "id" | "custom_name" | "services" | "price" | "billing" | "status" | "start_date" | "end_date" | "due_day">[],
  year: number,
  month: number,
): InvoiceDraft | null {
  const period = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const active = services.filter(
    (s) =>
      s.status === "activo" &&
      s.billing === "mensual" &&
      (!s.start_date || s.start_date <= periodEnd) &&
      (!s.end_date || s.end_date >= period),
  );
  if (!active.length) return null;
  const dueDay = Math.min(...active.map((s) => s.due_day ?? 10));
  return {
    period,
    items: active.map((s) => ({ workspace_service_id: s.id, name: serviceName(s), amount: Number(s.price) })),
    amount: active.reduce((a, s) => a + Number(s.price), 0),
    due_date: `${year}-${pad(month)}-${pad(Math.min(dueDay, lastDay))}`,
  };
}
