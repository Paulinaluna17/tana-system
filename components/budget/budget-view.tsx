import { Check, FileText, Printer, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { InvoiceBadge, ServiceStatusBadge } from "@/components/status";
import { BILLING_LABEL, dueText, getInvoiceStatus, INVOICE_META } from "@/lib/status";
import { formatDateKeyLong, formatDateTimeShort, monthName, todayKey } from "@/lib/dates";
import { serviceName } from "@/lib/billing";
import type { Invoice, Workspace, WorkspaceService } from "@/lib/types";
import { cn, formatMoney, whatsappLink } from "@/lib/utils";
import { AdminInvoiceActions, GenerateInvoiceButton, InvoiceFormDialog, ReportPaymentButton, ServiceFormDialog } from "./budget-client";

export async function loadBudget(supabase: SupabaseClient, workspaceId: string) {
  const [{ data: services }, { data: invoices }, { data: catalog }] = await Promise.all([
    supabase.from("workspace_services").select("*, services(name)").eq("workspace_id", workspaceId).order("created_at"),
    supabase.from("invoices").select("*").eq("workspace_id", workspaceId).order("period", { ascending: false }),
    supabase.from("services").select("*").eq("active", true).order("name"),
  ]);
  const inv = (invoices ?? []) as Invoice[];
  const receipts = await Promise.all(
    inv.map(async (i) => {
      if (!i.receipt_path) return null;
      const { data } = await supabase.storage.from("receipts").createSignedUrl(i.receipt_path, 3600);
      return data?.signedUrl ?? null;
    }),
  );
  return {
    services: (services ?? []) as WorkspaceService[],
    invoices: inv.map((i, k) => ({ ...i, receipt_url: receipts[k] })),
    catalog: (catalog ?? []) as { id: string; name: string; description: string | null; includes: string[]; excludes: string[]; default_price: number; billing: string }[],
  };
}

export function BudgetView({
  workspace: w,
  data,
  mode,
  canReport,
}: {
  workspace: Workspace;
  data: Awaited<ReturnType<typeof loadBudget>>;
  mode: "admin" | "client";
  canReport: boolean;
}) {
  const today = todayKey();
  const admin = mode === "admin";
  const active = data.services.filter((s) => s.status === "activo");
  const proposed = data.services.filter((s) => s.status === "propuesto");
  const others = data.services.filter((s) => s.status === "pausado" || s.status === "inactivo");
  const monthlyTotal = active.filter((s) => s.billing === "mensual").reduce((a, s) => a + Number(s.price), 0);
  const withStatus = data.invoices.map((i) => ({ ...i, st: getInvoiceStatus(i, today) }));
  const overdue = withStatus.filter((i) => i.st === "vencido");
  const nextDue = withStatus
    .filter((i) => ["pendiente", "por_vencer"].includes(i.st))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const year = Number(today.slice(0, 4));
  const paidYear = withStatus.filter((i) => i.st === "pagado" && i.period.startsWith(String(year))).reduce((a, i) => a + Number(i.amount), 0);
  const [cy, cm] = today.split("-").map(Number);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Total mensual activo" value={formatMoney(monthlyTotal)} />
        <Summary
          label="Próximo vencimiento"
          value={nextDue ? formatMoney(nextDue.amount) : "—"}
          sub={nextDue ? `${formatDateKeyLong(nextDue.due_date)} · ${dueText(nextDue.due_date, today)}` : "Sin cuotas pendientes"}
          tone={nextDue?.st === "por_vencer" ? "warn" : undefined}
        />
        <Summary
          label="Deuda vencida"
          value={formatMoney(overdue.reduce((a, i) => a + Number(i.amount), 0))}
          sub={overdue.length ? `${overdue.length} cuota${overdue.length > 1 ? "s" : ""} vencida${overdue.length > 1 ? "s" : ""}` : "¡Al día!"}
          tone={overdue.length ? "danger" : "ok"}
        />
        <Summary label={`Pagado en ${year}`} value={formatMoney(paidYear)} />
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        <a
          href={`/imprimir/${w.slug}/presupuesto`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm hover:bg-ink/5"
        >
          <Printer className="size-4" /> Descargar resumen en PDF
        </a>
        {admin && <ServiceFormDialog workspaceId={w.id} catalog={data.catalog} />}
        {admin && <GenerateInvoiceButton workspaceId={w.id} year={cm === 12 ? cy + 1 : cy} month={cm === 12 ? 1 : cm + 1} />}
        {admin && <InvoiceFormDialog workspaceId={w.id} />}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Servicios contratados</h2>
        {active.length === 0 ? (
          <EmptyState title="No hay servicios activos" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((s) => (
              <ServiceCard key={s.id} s={s} admin={admin} catalog={data.catalog} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Cuotas y pagos</h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {(["pagado", "pendiente", "por_vencer", "informado", "vencido"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <InvoiceBadge status={k} /> {INVOICE_META[k].help}
            </span>
          ))}
        </div>
        {withStatus.length === 0 ? (
          <EmptyState title="Todavía no hay cuotas" />
        ) : (
          <ul className="space-y-2">
            {withStatus.map((i) => {
              const [py, pm] = i.period.split("-").map(Number);
              return (
                <li
                  key={i.id}
                  className={cn(
                    "rounded-2xl border bg-surface p-4",
                    i.st === "vencido" ? "border-danger/50 bg-danger/[0.06]" : i.st === "pagado" ? "border-ok/40" : i.st === "por_vencer" ? "border-warn/50" : "border-line",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{monthName(py, pm)}</p>
                      <p className="text-sm text-muted">{i.items.map((it) => it.name).join(" + ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatMoney(i.amount, i.currency)}</p>
                      <InvoiceBadge status={i.st} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>
                      Vence: <strong>{formatDateKeyLong(i.due_date)}</strong>
                    </span>
                    {i.st !== "pagado" && i.st !== "anulada" && (
                      <span className={cn(i.st === "vencido" ? "font-semibold text-danger" : i.st === "por_vencer" ? "text-warn" : "text-muted")}>
                        {dueText(i.due_date, today)}
                      </span>
                    )}
                    {i.paid_at && (
                      <span className="text-ok">
                        <Check className="mr-1 inline size-4" />
                        Pagado el {formatDateTimeShort(i.paid_at)}
                        {i.method ? ` · ${i.method}` : ""}
                      </span>
                    )}
                    {i.reported_at && !i.paid_at && <span className="text-info">Informado el {formatDateTimeShort(i.reported_at)}</span>}
                    {i.receipt_url && (
                      <a href={i.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline">
                        <FileText className="size-4" /> Comprobante
                      </a>
                    )}
                    {i.payment_link && !i.paid_at && (
                      <a href={i.payment_link} target="_blank" rel="noreferrer" className="text-accent underline">
                        Link de pago
                      </a>
                    )}
                  </div>
                  {i.reported_note && <p className="mt-1 text-sm text-muted">“{i.reported_note}”</p>}
                  {i.notes && <p className="mt-1 text-sm text-muted">{i.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 no-print">
                    {!admin && canReport && !i.paid_at && !i.reported_at && i.st !== "anulada" && (
                      <ReportPaymentButton invoiceId={i.id} workspaceId={w.id} />
                    )}
                    {admin && (
                      <AdminInvoiceActions
                        invoice={i}
                        status={i.st}
                        whatsappHref={whatsappLink(
                          w.whatsapp,
                          `¡Hola! ¿Cómo andan? Les recordamos que la cuota de ${monthName(py, pm).toLowerCase()} (${formatMoney(i.amount)}) ${
                            i.st === "vencido" ? "venció el" : "vence el"
                          } ${formatDateKeyLong(i.due_date).toLowerCase()}. Pueden informar el pago desde el portal. ¡Gracias! 🙌 — Tana Studio`,
                        )}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {proposed.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Disponibles para sumar</h2>
          <p className="text-sm text-muted">Servicios que Tana ofrece y se pueden agregar cuando quieran.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {proposed.map((s) => (
              <ServiceCard key={s.id} s={s} admin={admin} catalog={data.catalog} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-muted">Pausados o no contratados</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((s) => (
              <ServiceCard key={s.id} s={s} admin={admin} catalog={data.catalog} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Summary({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" | "danger" | "ok" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", tone === "danger" && "text-danger", tone === "ok" && "text-ok", tone === "warn" && "text-warn")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function ServiceCard({
  s,
  admin,
  catalog,
}: {
  s: WorkspaceService;
  admin: boolean;
  catalog: Awaited<ReturnType<typeof loadBudget>>["catalog"];
}) {
  const dim = s.status === "inactivo" || s.status === "pausado";
  return (
    <Card className={cn(dim && "opacity-75", s.status === "activo" && "border-ok/40", s.status === "propuesto" && "border-info/40")}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle>{serviceName(s)}</CardTitle>
          <ServiceStatusBadge status={s.status} />
        </div>
        <p className="text-lg font-semibold">
          {formatMoney(s.price, s.currency)} <span className="text-sm font-normal text-muted">{BILLING_LABEL[s.billing]}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {s.description && <p>{s.description}</p>}
        {s.includes.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Incluye</p>
            <ul className="space-y-1">
              {s.includes.map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {x}
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.excludes.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">No incluye</p>
            <ul className="space-y-1">
              {s.excludes.map((x) => (
                <li key={x} className="flex gap-2 text-muted">
                  <X className="mt-0.5 size-4 shrink-0" /> {x}
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
          {s.billing === "mensual" && s.due_day && (
            <div>
              <dt className="text-muted">Se paga</dt>
              <dd className="font-medium">Hasta el día {s.due_day} de cada mes</dd>
            </div>
          )}
          {s.start_date && (
            <div>
              <dt className="text-muted">Desde</dt>
              <dd className="font-medium">{formatDateKeyLong(s.start_date)}</dd>
            </div>
          )}
          {s.end_date && (
            <div>
              <dt className="text-muted">Hasta</dt>
              <dd className="font-medium">{formatDateKeyLong(s.end_date)}</dd>
            </div>
          )}
        </dl>
        {s.conditions && <p className="rounded-lg bg-ink/5 p-2 text-xs">{s.conditions}</p>}
        {admin && <ServiceFormDialog workspaceId={s.workspace_id} catalog={catalog} service={s} />}
      </CardContent>
    </Card>
  );
}
