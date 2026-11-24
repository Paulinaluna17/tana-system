import { requireWorkspace } from "@/lib/auth";
import { loadCalendar, parseYearMonth } from "@/lib/data";
import { currentYearMonth, monthGrid, monthName } from "@/lib/dates";
import { monthProgress } from "@/lib/status";
import { CalendarView, MonthNav } from "@/components/calendar/calendar-view";
import { MonthActions } from "@/components/calendar/month-actions";
import { Badge, Progress } from "@/components/ui";

const MONTH_STATUS = {
  borrador: { label: "Borrador · el cliente no lo ve", tone: "muted" },
  enviado: { label: "Enviado al cliente", tone: "info" },
  aprobado: { label: "Aprobado por el cliente", tone: "ok" },
} as const;

export default async function CalendarioAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { slug } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const { year, month } = parseYearMonth(await searchParams, currentYearMonth());
  const data = await loadCalendar(supabase, w.id, year, month);
  const now = new Date();
  const weeks = monthGrid(year, month).map((wk) => wk.map((d) => d.key));
  const prog = monthProgress(data.items, weeks, now);
  const ms = MONTH_STATUS[data.month?.status ?? "borrador"];
  const label = monthName(year, month);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav basePath={`/clientes/${slug}/calendario`} year={year} month={month} label={label} todayYM={currentYearMonth()} />
          <Badge tone={ms.tone}>{ms.label}</Badge>
        </div>
        <MonthActions
          workspaceId={w.id}
          slug={slug}
          year={year}
          month={month}
          monthRow={data.month}
          monthLabel={label}
          appUrl={process.env.APP_URL ?? ""}
          whatsapp={w.whatsapp}
          hasItems={data.items.length > 0}
        />
      </div>

      {data.items.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <strong>{prog.published}</strong> de {prog.total} piezas publicadas · {prog.weeksDone} de {prog.weeksTotal} semanas
              cumplidas
            </span>
            {prog.late > 0 && <Badge tone="danger">{prog.late} atrasada{prog.late > 1 ? "s" : ""}</Badge>}
          </div>
          <Progress value={prog.pct} label="Avance del mes" />
        </div>
      )}

      {data.month?.intro && <p className="rounded-2xl bg-accent/5 p-3 text-sm">{data.month.intro}</p>}

      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-display text-lg">Todavía no hay piezas en {label.toLowerCase()}.</p>
          <p className="mt-1 text-sm text-muted">
            ¿Generamos el mes desde la plantilla? Usá <strong>Generar mes desde plantilla</strong> o <strong>Duplicar mes anterior</strong>.
            También podés hacer clic en el + de cualquier día.
          </p>
        </div>
      ) : null}

      <CalendarView
        mode="admin"
        workspaceId={w.id}
        year={year}
        month={month}
        nowISO={now.toISOString()}
        items={data.calItems}
        types={data.types}
        pillars={data.pillars}
        itemHref={`/clientes/${slug}/pieza/`}
        leadDays={w.approval_lead_days}
        calendarNote={w.calendar_note}
      />
    </div>
  );
}
