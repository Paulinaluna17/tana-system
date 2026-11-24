import { requireWorkspace } from "@/lib/auth";
import { loadCalendar, parseYearMonth } from "@/lib/data";
import { currentYearMonth, monthGrid, monthName } from "@/lib/dates";
import { monthProgress } from "@/lib/status";
import { CalendarView, MonthNav } from "@/components/calendar/calendar-view";
import { ApproveMonthButton } from "@/components/portal/approve-month";
import { Badge, Progress } from "@/components/ui";

export default async function PortalCalendario({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { slug } = await params;
  const { workspace: w, supabase, session, role } = await requireWorkspace(slug);
  const { year, month } = parseYearMonth(await searchParams, currentYearMonth());
  const data = await loadCalendar(supabase, w.id, year, month, session.userId);
  // El cliente nunca ve borradores (también lo garantiza la base con RLS).
  const visible = role === "admin" ? data.calItems.filter((i) => !["idea", "en_redaccion"].includes(i.status)) : data.calItems;
  const visibleFull = data.items.filter((i) => visible.some((v) => v.id === i.id));
  const now = new Date();
  const weeks = monthGrid(year, month).map((wk) => wk.map((d) => d.key));
  const prog = monthProgress(visibleFull, weeks, now);
  const label = monthName(year, month);
  const canAct = role === "admin" || role === "client_editor";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav basePath={`/portal/${slug}/calendario`} year={year} month={month} label={label} todayYM={currentYearMonth()} />
        <div className="flex items-center gap-2">
          {data.month?.status === "aprobado" && <Badge tone="ok">Mes aprobado</Badge>}
          {data.month?.status === "enviado" && canAct && <ApproveMonthButton monthId={data.month.id} label={label} />}
        </div>
      </div>
      {data.month?.intro && <p className="rounded-2xl bg-accent/10 p-3 text-sm">{data.month.intro}</p>}
      {visible.length > 0 ? (
        <>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <p className="mb-2 text-sm">
              <strong>{prog.published}</strong> de {prog.total} piezas publicadas · {prog.weeksDone} de {prog.weeksTotal} semanas
              cumplidas
            </p>
            <Progress value={prog.pct} label="Avance del mes" />
          </div>
          <CalendarView
            mode="client"
            workspaceId={w.id}
            year={year}
            month={month}
            nowISO={now.toISOString()}
            items={visible}
            types={data.types}
            pillars={data.pillars}
            itemHref={`/portal/${slug}/pieza/`}
            leadDays={w.approval_lead_days}
            calendarNote={w.calendar_note}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-display text-xl">Todavía no está el calendario de {label.toLowerCase()}</p>
          <p className="mt-1 text-sm text-muted">Te avisamos apenas Tana lo publique.</p>
        </div>
      )}
    </div>
  );
}
