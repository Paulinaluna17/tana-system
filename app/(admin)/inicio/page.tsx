import Link from "next/link";
import { AlertTriangle, CalendarPlus, Eye, Inbox, MessageSquareWarning, Plus, Receipt, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { addDaysKey, arDateKey, arTime, arToUtc, currentYearMonth, formatDateKeyLong, todayKey, weekRange } from "@/lib/dates";
import { getInvoiceStatus, getTimeState, dueText } from "@/lib/status";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { InvoiceBadge, StatusBadge } from "@/components/status";
import { LiveRefresh } from "@/components/shell/live-refresh";
import type { ContentItem, ContentType, Invoice, Workspace } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Inicio" };

export default async function InicioPage() {
  const s = await requireAdmin();
  const supabase = await createClient();
  const today = todayKey();
  const tomorrow = addDaysKey(today, 1);
  const week = weekRange(today);
  const from = arToUtc(addDaysKey(today, -45)).toISOString();
  const to = arToUtc(addDaysKey(today, 21)).toISOString();

  const [{ data: wss }, { data: items }, { data: invoices }, { data: types }] = await Promise.all([
    supabase.from("workspaces").select("*").is("archived_at", null).order("name"),
    supabase.from("content_items").select("*").gte("publish_at", from).lt("publish_at", to).order("publish_at"),
    supabase.from("invoices").select("*").is("paid_at", null).is("status_override", null),
    supabase.from("content_types").select("*"),
  ]);
  const workspaces = (wss ?? []) as Workspace[];
  const all = (items ?? []) as ContentItem[];
  const typeById = Object.fromEntries(((types ?? []) as ContentType[]).map((t) => [t.id, t]));
  const wsById = Object.fromEntries(workspaces.map((w) => [w.id, w]));
  const now = new Date();
  const { year, month } = currentYearMonth();

  const todayTomorrow = all.filter((i) => {
    const k = arDateKey(i.publish_at);
    return (k === today || k === tomorrow) && !["cancelado", "reemplazado"].includes(i.status);
  });
  const materialDue = all.filter(
    (i) =>
      i.client_material_request &&
      !i.client_material_sent_at &&
      i.client_material_due &&
      i.client_material_due <= tomorrow &&
      i.status !== "publicado",
  );

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader
        title={`Hola, ${(s.profile.full_name ?? "").split(" ")[0] || "equipo"} 👋`}
        subtitle={formatDateKeyLong(today)}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/clientes/nuevo">
                <Plus /> Nuevo cliente
              </Link>
            </Button>
            {workspaces[0] && (
              <Button asChild>
                <Link href={`/clientes/${workspaces[0].slug}/calendario?y=${month === 12 ? year + 1 : year}&m=${month === 12 ? 1 : month + 1}`}>
                  <CalendarPlus /> Planificar mes
                </Link>
              </Button>
            )}
          </>
        }
      />

      {workspaces.length === 0 ? (
        <EmptyState title="Todavía no hay clientes">
          <Link href="/clientes/nuevo" className="text-accent underline">
            Sumá el primero
          </Link>{" "}
          con el asistente de alta.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((w) => {
            const mine = all.filter((i) => i.workspace_id === w.id);
            const thisWeek = mine.filter((i) => {
              const k = arDateKey(i.publish_at);
              return k >= week.start && k <= week.end && !["cancelado", "reemplazado"].includes(i.status);
            });
            const toReview = mine.filter((i) => i.status === "para_revisar");
            const changes = mine.filter((i) => i.status === "cambios_solicitados");
            const material = mine.filter((i) => i.client_material_request && !i.client_material_sent_at && i.status !== "publicado" && arDateKey(i.publish_at) >= today);
            const late = mine.filter((i) => getTimeState(i, now) === "atrasada");
            const invs = ((invoices ?? []) as Invoice[]).filter((i) => i.workspace_id === w.id);
            const overdue = invs.filter((i) => getInvoiceStatus(i, today) === "vencido");
            const soon = invs.filter((i) => ["por_vencer", "informado"].includes(getInvoiceStatus(i, today)));
            return (
              <Card key={w.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line"
                      style={{ background: w.brand.background }}
                    >
                      {w.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.logo_url} alt="" className="max-h-9 max-w-9 object-contain" />
                      ) : (
                        <span style={{ color: w.brand.primary }} className="font-display text-lg">
                          {w.name[0]}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <CardTitle>
                        <Link href={`/clientes/${w.slug}/calendario`} className="hover:underline">
                          {w.name}
                        </Link>
                      </CardTitle>
                      <p className="text-xs text-muted">
                        {thisWeek.length} piezas esta semana
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <Stat href={`/clientes/${w.slug}/calendario`} icon={<Eye />} n={toReview.length} label="esperan aprobación" tone="warn" />
                    <Stat href={`/clientes/${w.slug}/calendario`} icon={<MessageSquareWarning />} n={changes.length} label="cambios pedidos" tone="danger" />
                    <Stat href={`/clientes/${w.slug}/calendario`} icon={<Inbox />} n={material.length} label="material pendiente" tone="info" />
                    <Stat href={`/clientes/${w.slug}/calendario`} icon={<AlertTriangle />} n={late.length} label="atrasadas" tone="danger" />
                    <Stat href={`/clientes/${w.slug}/presupuesto`} icon={<Wallet />} n={soon.length} label="pagos por vencer / informados" tone="warn" />
                    <Stat href={`/clientes/${w.slug}/presupuesto`} icon={<Receipt />} n={overdue.length} label="pagos vencidos" tone="danger" />
                  </div>
                  {overdue.map((i) => (
                    <Link
                      key={i.id}
                      href={`/clientes/${w.slug}/presupuesto`}
                      className="flex items-center justify-between rounded-xl border border-danger/30 bg-danger/5 p-2 text-sm"
                    >
                      <span>
                        Cuota {new Date(i.period + "T12:00").toLocaleDateString("es-AR", { month: "long" })} ·{" "}
                        {formatMoney(i.amount)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-danger">{dueText(i.due_date, today)}</span>
                        <InvoiceBadge status="vencido" />
                      </span>
                    </Link>
                  ))}
                  {late.slice(0, 3).map((i) => (
                    <Link
                      key={i.id}
                      href={`/clientes/${w.slug}/pieza/${i.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 p-2 text-sm"
                    >
                      <span className="truncate">
                        {typeById[i.content_type_id]?.label} · {formatDateKeyLong(arDateKey(i.publish_at))} · {i.title || "Sin título"}
                      </span>
                      <Badge tone="danger">Atrasada</Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hoy y mañana</CardTitle>
            <p className="text-sm text-muted">Qué se publica, qué hay que grabar y qué hay que entregar.</p>
          </CardHeader>
          <CardContent>
            {todayTomorrow.length === 0 ? (
              <p className="text-sm text-muted">Nada programado para hoy ni mañana.</p>
            ) : (
              <ul className="space-y-2">
                {todayTomorrow.map((i) => {
                  const w = wsById[i.workspace_id];
                  const t = typeById[i.content_type_id];
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/clientes/${w?.slug}/pieza/${i.id}`}
                        className="flex items-center gap-3 rounded-xl border border-line p-2 text-sm hover:border-accent/50"
                      >
                        <span className="w-16 shrink-0 text-xs font-semibold text-muted">
                          {arDateKey(i.publish_at) === today ? "Hoy" : "Mañana"} {arTime(i.publish_at)}
                        </span>
                        <span
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase"
                          style={{ background: t?.color, color: t?.text_color }}
                        >
                          {t?.label}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-muted">{w?.name.split("·")[0].trim()} · </span>
                          {i.title || "Sin título"}
                        </span>
                        <StatusBadge status={i.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Material que tienen que mandar</CardTitle>
            <p className="text-sm text-muted">Vence hoy o mañana (o ya venció) y todavía no llegó.</p>
          </CardHeader>
          <CardContent>
            {materialDue.length === 0 ? (
              <p className="text-sm text-muted">Nada pendiente. 🙌</p>
            ) : (
              <ul className="space-y-2">
                {materialDue.map((i) => {
                  const w = wsById[i.workspace_id];
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/clientes/${w?.slug}/pieza/${i.id}`}
                        className="block rounded-xl border border-line p-2 text-sm hover:border-accent/50"
                      >
                        <span className="font-medium">{w?.name}</span> · {i.client_material_request}
                        <span className="block text-xs text-danger">
                          Fecha límite: {formatDateKeyLong(i.client_material_due!)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  href,
  icon,
  n,
  label,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  n: number;
  label: string;
  tone: "warn" | "danger" | "info";
}) {
  const color = n === 0 ? "text-muted" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-info";
  return (
    <Link href={href} className="rounded-xl border border-line p-2 hover:border-accent/40">
      <span className={`flex items-center gap-1.5 text-xl font-semibold [&_svg]:size-4 ${color}`}>
        {icon}
        {n}
      </span>
      <span className="text-xs leading-tight text-muted">{label}</span>
    </Link>
  );
}
