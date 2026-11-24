import Link from "next/link";
import { BookOpen, CalendarDays, CheckCircle2, Eye, Inbox, Sparkles, Video, Wallet } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { addDaysKey, arDateKey, arTime, arToUtc, formatDateKeyLong, monthName, todayKey, weekRange, currentYearMonth } from "@/lib/dates";
import { dueText, getInvoiceStatus, isStruck, isUrgentApproval, showUpdatedBadge } from "@/lib/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { InvoiceBadge, StatusBadge, UpdatedBadge, UrgentBadge } from "@/components/status";
import { ApproveMonthButton } from "@/components/portal/approve-month";
import type { ContentItem, ContentType, Invoice, Month } from "@/lib/types";
import { cn, formatMoney, plural } from "@/lib/utils";

export default async function PortalHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase, session, role } = await requireWorkspace(slug);
  const base = `/portal/${slug}`;
  const today = todayKey();
  const now = new Date();
  const week = weekRange(today);
  const from = arToUtc(addDaysKey(today, -14)).toISOString();
  const to = arToUtc(addDaysKey(today, 60)).toISOString();
  const canAct = role === "admin" || role === "client_editor";

  const [{ data: items }, { data: types }, { data: invoices }, { data: months }, { data: views }, { data: membership }] =
    await Promise.all([
      supabase.from("content_items").select("*").eq("workspace_id", w.id).gte("publish_at", from).lt("publish_at", to).order("publish_at"),
      supabase.from("content_types").select("*").eq("workspace_id", w.id),
      supabase.from("invoices").select("*").eq("workspace_id", w.id).is("paid_at", null).is("status_override", null).order("due_date"),
      supabase.from("months").select("*").eq("workspace_id", w.id).eq("status", "enviado").order("year").order("month"),
      supabase.from("item_views").select("content_item_id, seen_at").eq("user_id", session.userId),
      supabase.from("memberships").select("last_seen_at").eq("workspace_id", w.id).eq("user_id", session.userId).maybeSingle(),
    ]);
  const all = ((items ?? []) as ContentItem[]).filter((i) => !["idea", "en_redaccion", "cancelado", "reemplazado"].includes(i.status));
  const typeById = Object.fromEntries(((types ?? []) as ContentType[]).map((t) => [t.id, t]));
  const seen = Object.fromEntries((views ?? []).map((v) => [v.content_item_id, v.seen_at]));

  const toReview = all.filter((i) => i.status === "para_revisar");
  const material = all.filter((i) => i.client_material_request && !i.client_material_sent_at && i.status !== "publicado");
  const toShoot = all.filter(
    (i) =>
      i.production_owner !== "tana" &&
      i.status !== "publicado" &&
      i.shot_list?.some((s) => !s.done) &&
      arDateKey(i.publish_at) <= addDaysKey(today, 10),
  );
  const pay = ((invoices ?? []) as Invoice[]).filter((i) => ["por_vencer", "vencido"].includes(getInvoiceStatus(i, today)));
  const monthsToApprove = (months ?? []) as Month[];
  const pendingCount = toReview.length + material.length + toShoot.length + pay.length + monthsToApprove.length;
  const thisWeek = all.filter((i) => {
    const k = arDateKey(i.publish_at);
    return k >= week.start && k <= week.end;
  });
  const lastSeen = membership?.last_seen_at;
  const { count: newsCount } = await supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", w.id)
    .gt("created_at", lastSeen ?? "1970-01-01")
    .neq("actor_id", session.userId);
  const ym = currentYearMonth();
  const firstName = (session.profile.full_name ?? "").split("(")[0].trim();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{formatDateKeyLong(today)}</p>
        <h1 className="font-display text-3xl font-semibold leading-tight">
          {role === "admin" ? w.name : `¡Hola${firstName ? `, ${firstName}` : ""}!`}
        </h1>
        {(newsCount ?? 0) > 0 && (
          <Link href={`${base}/novedades`} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-sm text-ink">
            <Sparkles className="size-4 text-accent" /> {plural(newsCount ?? 0, "novedad", "novedades")} desde tu última visita
          </Link>
        )}
      </div>

      <Card className="border-2 border-accent/50">
        <CardHeader>
          <CardTitle className="text-xl">Pendiente de vos</CardTitle>
          <p className="text-sm text-muted">
            {pendingCount === 0 ? "¡Estás al día! No tenés nada pendiente. 🙌" : "Lo que necesitamos que hagas, en orden de importancia."}
          </p>
        </CardHeader>
        {pendingCount > 0 && (
          <CardContent className="space-y-4">
            {monthsToApprove.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-2xl bg-accent/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <strong>Calendario de {monthName(m.year, m.month).toLowerCase()}</strong> listo para revisar.
                </p>
                <div className="flex gap-2">
                  <Link href={`${base}/calendario?y=${m.year}&m=${m.month}`} className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm">
                    Ver calendario
                  </Link>
                  {canAct && <ApproveMonthButton monthId={m.id} label={monthName(m.year, m.month)} />}
                </div>
              </div>
            ))}
            <PendingGroup icon={<Eye />} title="Piezas para revisar y aprobar" items={toReview.length}>
              {toReview.map((i) => (
                <ItemRow key={i.id} href={`${base}/pieza/${i.id}`} item={i} type={typeById[i.content_type_id]}>
                  {isUrgentApproval(i, w.approval_lead_days, now) && <UrgentBadge />}
                  {showUpdatedBadge(i, seen[i.id], now) && <UpdatedBadge />}
                </ItemRow>
              ))}
            </PendingGroup>
            <PendingGroup icon={<Inbox />} title="Material que tenés que mandar" items={material.length}>
              {material.map((i) => (
                <ItemRow key={i.id} href={`${base}/pieza/${i.id}`} item={i} type={typeById[i.content_type_id]} subtitle={i.client_material_request!}>
                  {i.client_material_due && (
                    <span className={cn("text-xs font-semibold", i.client_material_due <= today ? "text-danger" : "text-warn")}>
                      Hasta el {formatDateKeyLong(i.client_material_due).toLowerCase()}
                    </span>
                  )}
                </ItemRow>
              ))}
            </PendingGroup>
            <PendingGroup icon={<Video />} title="Para grabar estos días" items={toShoot.length}>
              {toShoot.map((i) => (
                <ItemRow
                  key={i.id}
                  href={`${base}/pieza/${i.id}`}
                  item={i}
                  type={typeById[i.content_type_id]}
                  subtitle={`${i.shot_list.filter((s) => s.done).length} de ${i.shot_list.length} tomas grabadas`}
                />
              ))}
            </PendingGroup>
            <PendingGroup icon={<Wallet />} title="Pagos" items={pay.length}>
              {pay.map((i) => (
                <Link
                  key={i.id}
                  href={`${base}/presupuesto`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 hover:border-accent/60"
                >
                  <span>
                    Cuota de {monthName(Number(i.period.slice(0, 4)), Number(i.period.slice(5, 7))).toLowerCase()} ·{" "}
                    <strong>{formatMoney(i.amount)}</strong>
                    <span className="block text-xs text-muted">{dueText(i.due_date, today)}</span>
                  </span>
                  <InvoiceBadge status={getInvoiceStatus(i, today)} />
                </Link>
              ))}
            </PendingGroup>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Esta semana</CardTitle>
          <p className="text-sm text-muted">Lo que se publica y lo que hay que grabar, día por día.</p>
        </CardHeader>
        <CardContent>
          {thisWeek.length === 0 ? (
            <p className="text-sm text-muted">No hay publicaciones esta semana.</p>
          ) : (
            <ol className="space-y-4">
              {week.days.map((d) => {
                const list = thisWeek.filter((i) => arDateKey(i.publish_at) === d);
                if (!list.length) return null;
                return (
                  <li key={d}>
                    <p className={cn("mb-1.5 text-sm font-semibold", d === today ? "text-accent" : d < today ? "text-muted" : "")}>
                      {formatDateKeyLong(d)} {d === today && "· Hoy"}
                    </p>
                    <ul className="space-y-2">
                      {list.map((i) => (
                        <ItemRow key={i.id} href={`${base}/pieza/${i.id}`} item={i} type={typeById[i.content_type_id]} now={now} />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`${base}/calendario?y=${ym.year}&m=${ym.month}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-accent/60">
          <CalendarDays className="size-6 text-accent" />
          <span>
            <strong className="block">Calendario completo</strong>
            <span className="text-sm text-muted">Todo el mes, con lo publicado tachado.</span>
          </span>
        </Link>
        <Link href={`${base}/guia`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-accent/60">
          <BookOpen className="size-6 text-accent" />
          <span>
            <strong className="block">Cómo leer este calendario</strong>
            <span className="text-sm text-muted">Colores, estados y frecuencia semanal.</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

function PendingGroup({ icon, title, items, children }: { icon: React.ReactNode; title: string; items: number; children: React.ReactNode }) {
  if (!items) return null;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-accent">
        {icon} {title} <span className="rounded-full bg-accent px-2 text-xs text-accent-ink">{items}</span>
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function ItemRow({
  href,
  item,
  type,
  subtitle,
  children,
  now,
}: {
  href: string;
  item: ContentItem;
  type?: ContentType;
  subtitle?: string;
  children?: React.ReactNode;
  now?: Date;
}) {
  const struck = now ? isStruck(item, now) : false;
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 rounded-xl border border-line p-3 transition hover:border-accent/60">
        <span
          className="mt-0.5 w-[4.6rem] shrink-0 rounded-md px-1.5 py-1 text-center text-[11px] font-bold uppercase"
          style={{ background: type?.color, color: type?.text_color, border: `1px solid ${type?.text_color}33` }}
        >
          {type?.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-medium", struck && "text-muted line-through")}>
            {struck && <CheckCircle2 className="mr-1 inline size-4 text-ok" />}
            {item.title || type?.label}
          </span>
          <span className="block text-xs text-muted">
            {formatDateKeyLong(arDateKey(item.publish_at))} · {arTime(item.publish_at)} hs
          </span>
          {subtitle && <span className="mt-0.5 block text-sm">{subtitle}</span>}
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <StatusBadge status={item.status} client />
            {children}
          </span>
        </span>
      </Link>
    </li>
  );
}
