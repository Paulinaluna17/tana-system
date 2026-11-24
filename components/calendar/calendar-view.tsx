"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CalendarDays, Columns3, List, LayoutGrid, Plus, ChevronLeft, ChevronRight, Check, Filter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  arDateKey,
  arTime,
  formatDateKeyLong,
  monthGrid,
  todayKey,
  weekOfMonth,
  weekOfMonthRaw,
  weekRange,
  formatDayMonth,
} from "@/lib/dates";
import { STATUS_META, STATUS_ORDER, getTimeState, isStruck, isUrgentApproval } from "@/lib/status";
import type { ContentStatus, ContentType, Pillar, ProductionOwner } from "@/lib/types";
import { LateBadge, StatusBadge, UpdatedBadge, UrgentBadge } from "@/components/status";
import { Button, Select } from "@/components/ui";
import { createItemAt, moveItem, setItemStatus } from "@/app/actions/content";

export interface CalItem {
  id: string;
  publish_at: string;
  status: ContentStatus;
  title: string;
  content_type_id: string;
  pillar_id: string | null;
  production_owner: ProductionOwner;
  series_name?: string | null;
  updated?: boolean;
}

type View = "mes" | "semana" | "lista" | "tablero";

export interface CalendarProps {
  mode: "admin" | "client";
  workspaceId: string;
  year: number;
  month: number;
  nowISO: string;
  items: CalItem[];
  types: ContentType[];
  pillars: Pillar[];
  itemHref: string; // ej. "/clientes/roma/pieza/"
  leadDays: number;
  calendarNote?: string | null;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarView(props: CalendarProps) {
  const { mode, items: initialItems, types, pillars, year, month } = props;
  const now = useMemo(() => new Date(props.nowISO), [props.nowISO]);
  const today = todayKey(now);
  const [items, setItems] = useState(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);

  const views: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: "mes", label: "Mes", icon: <LayoutGrid /> },
    { key: "semana", label: "Semana", icon: <Columns3 /> },
    { key: "lista", label: "Lista", icon: <List /> },
    ...(mode === "admin" ? [{ key: "tablero" as View, label: "Tablero", icon: <CalendarDays /> }] : []),
  ];
  const [view, setView] = useState<View>("mes");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`tana-view-${mode}`) as View | null;
      if (saved && views.some((v) => v.key === saved)) setView(saved);
      else if (window.innerWidth < 640) setView("lista");
    } catch {
      /* sin storage: queda la vista por defecto */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(`tana-view-${mode}`, v);
    } catch {
      /* ignorar */
    }
  };

  // Filtros
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPillar, setFPillar] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const filtered = items.filter(
    (i) =>
      (!fType || i.content_type_id === fType) &&
      (!fStatus || i.status === fStatus) &&
      (!fPillar || i.pillar_id === fPillar) &&
      (!fOwner || i.production_owner === fOwner),
  );
  const activeFilters = [fType, fStatus, fPillar, fOwner].filter(Boolean).length;

  const typeById = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);
  const byDay = useMemo(() => {
    const m: Record<string, CalItem[]> = {};
    for (const it of filtered) (m[arDateKey(it.publish_at)] ??= []).push(it);
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.publish_at.localeCompare(b.publish_at)));
    return m;
  }, [filtered]);

  // Drag & drop (solo Tana)
  const router = useRouter();
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const id = String(e.active.id);
    const target = String(e.over.id);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (target.startsWith("day:")) {
      const dateKey = target.slice(4);
      if (dateKey === arDateKey(item.publish_at)) return;
      const time = arTime(item.publish_at);
      const prev = items;
      setItems((list) =>
        list.map((i) => (i.id === id ? { ...i, publish_at: `${dateKey}T${time}:00-03:00` } : i)),
      );
      startTransition(async () => {
        const res = await moveItem(id, dateKey);
        if (res?.error) {
          setItems(prev);
          toast.error(res.error);
        } else {
          toast.success(`Movida al ${formatDateKeyLong(dateKey).toLowerCase()}`);
          router.refresh();
        }
      });
    } else if (target.startsWith("status:")) {
      const status = target.slice(7) as ContentStatus;
      if (status === item.status) return;
      const prev = items;
      setItems((list) => list.map((i) => (i.id === id ? { ...i, status } : i)));
      startTransition(async () => {
        const res = await setItemStatus(id, status);
        if (res?.error) {
          setItems(prev);
          toast.error(res.error);
        } else router.refresh();
      });
    }
  };

  const grid = monthGrid(year, month);
  const weeks = grid.map((w) => w.map((d) => d.key));

  const content = (
    <>
      {view === "mes" && (
        <MonthGrid {...props} grid={grid} byDay={byDay} typeById={typeById} today={today} now={now} />
      )}
      {view === "semana" && (
        <WeekView {...props} weeks={weeks} byDay={byDay} typeById={typeById} today={today} now={now} />
      )}
      {view === "lista" && <ListView {...props} weeks={weeks} byDay={byDay} typeById={typeById} today={today} now={now} />}
      {view === "tablero" && <Board {...props} items={filtered} typeById={typeById} now={now} />}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Vista del calendario">
          {views.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => changeView(v.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm [&_svg]:size-4",
                view === v.key ? "bg-accent text-accent-ink" : "text-muted hover:text-ink",
              )}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <Filter /> Filtros{activeFilters ? ` (${activeFilters})` : ""}
        </Button>
      </div>
      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-4 no-print">
          <Select aria-label="Tipo de pieza" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Estado" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUS_ORDER.filter((s) => mode === "admin" || !["idea", "en_redaccion"].includes(s)).map((s) => (
              <option key={s} value={s}>
                {mode === "admin" ? STATUS_META[s].label : STATUS_META[s].clientLabel}
              </option>
            ))}
          </Select>
          <Select aria-label="Pilar" value={fPillar} onChange={(e) => setFPillar(e.target.value)}>
            <option value="">Todos los pilares</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Quién produce" value={fOwner} onChange={(e) => setFOwner(e.target.value)}>
            <option value="">Produce: todos</option>
            <option value="tana">Produce Tana</option>
            <option value="cliente">Produce el cliente</option>
            <option value="mixto">Mixto</option>
          </Select>
        </div>
      )}

      <DndContext id="tana-calendar-dnd" sensors={sensors} onDragEnd={mode === "admin" ? onDragEnd : undefined}>
        {content}
      </DndContext>

      <Legend types={types} note={props.calendarNote} />
    </div>
  );
}

// ------------------------------------------------------------------
interface InnerProps extends CalendarProps {
  byDay: Record<string, CalItem[]>;
  typeById: Record<string, ContentType>;
  today: string;
  now: Date;
}

function Chip({
  item,
  type,
  href,
  now,
  draggable,
  compact,
}: {
  item: CalItem;
  type?: ContentType;
  href: string;
  now: Date;
  draggable: boolean;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !draggable,
  });
  // Es un link (abre la pieza) que además se puede arrastrar: no lo anunciamos como "botón".
  const { role: _role, ...dragAttrs } = attributes;
  void _role;
  const struck = isStruck(item, now);
  const late = getTimeState(item, now) === "atrasada";
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30 } : undefined;
  const inactive = item.status === "cancelado" || item.status === "reemplazado";
  return (
    <Link
      ref={setNodeRef}
      href={href}
      style={{ ...style, background: type?.color, color: type?.text_color, borderColor: late ? undefined : type?.color }}
      {...(draggable ? listeners : {})}
      {...(draggable ? dragAttrs : {})}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      title={`${type?.label ?? ""} · ${arTime(item.publish_at)} · ${item.title || "Sin título"} — ${STATUS_META[item.status].label}`}
      className={cn(
        "group relative block rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:brightness-95 focus-visible:ring-2",
        late && "border-2 border-danger ring-1 ring-danger/40",
        (struck || inactive) && "opacity-60",
        isDragging && "opacity-70 shadow-lg",
        draggable && "cursor-grab touch-none select-none active:cursor-grabbing [-webkit-user-drag:none]",
      )}
    >
      <span className="flex items-center gap-1 font-semibold uppercase tracking-wide">
        {struck && <Check className="size-3 shrink-0" aria-label="Publicada" />}
        <span className={cn(struck && "line-through")}>{type?.label}</span>
        <span className="ml-auto font-normal opacity-80">{arTime(item.publish_at)}</span>
      </span>
      {!compact && item.title && (
        <span className={cn("mt-0.5 line-clamp-2 normal-case", struck && "line-through")}>{item.title}</span>
      )}
      {late && (
        <span className="mt-0.5 inline-block rounded bg-danger px-1 text-[10px] font-semibold text-white">Atrasada</span>
      )}
      {item.updated && (
        <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-ink">
          Nuevo
        </span>
      )}
    </Link>
  );
}

function DayCell({
  dateKey,
  inMonth,
  children,
  today,
  admin,
  workspaceId,
  weekNum,
}: {
  dateKey: string;
  inMonth: boolean;
  children: React.ReactNode;
  today: string;
  admin: boolean;
  workspaceId: string;
  weekNum?: number;
}) {
  const { setNodeRef, isOver } = useDroppableSafe(`day:${dateKey}`, admin);
  const [pending, startTransition] = useTransition();
  const isToday = dateKey === today;
  const past = dateKey < today;
  const day = Number(dateKey.slice(8));
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex min-h-[92px] flex-col gap-1 rounded-xl border p-1.5 sm:min-h-[118px]",
        inMonth ? "border-line bg-surface" : "border-transparent bg-ink/[0.03]",
        past && inMonth && "bg-ink/[0.025]",
        isToday && "border-accent ring-2 ring-accent/40",
        isOver && "border-accent bg-accent/5",
      )}
      aria-label={formatDateKeyLong(dateKey)}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
            !inMonth && "text-muted/50",
            past && inMonth && "text-muted",
            isToday && "bg-accent text-accent-ink",
          )}
        >
          {day}
        </span>
        {isToday && <span className="text-[10px] font-semibold uppercase text-accent">Hoy</span>}
        {weekNum && <span className="sr-only">Semana {weekNum}</span>}
        {admin && inMonth && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await createItemAt(workspaceId, dateKey);
                if (res?.error) toast.error(res.error);
              })
            }
            className="rounded-md p-0.5 text-muted opacity-0 hover:bg-ink/5 hover:text-ink focus:opacity-100 group-hover:opacity-100"
            aria-label={`Crear pieza el ${formatDateKeyLong(dateKey)}`}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <div className={cn("flex flex-col gap-1", past && inMonth && "opacity-90")}>{children}</div>
    </div>
  );
}

/** useDroppable solo dentro de DndContext (admin). */
function useDroppableSafe(id: string, enabled: boolean) {
  return useDroppable({ id, disabled: !enabled });
}

function MonthGrid(p: InnerProps & { grid: { key: string; inMonth: boolean }[][] }) {
  const admin = p.mode === "admin";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="mb-1 grid grid-cols-[2.2rem_repeat(7,minmax(0,1fr))] gap-1">
          <span />
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {p.grid.map((week) => {
            const wk = week.find((d) => d.inMonth && Number(d.key.slice(8)) >= 1);
            const isCurrent = week.some((d) => d.key === p.today);
            const raw = wk ? weekOfMonthRaw(wk.key) : 0;
            const wn = raw >= 1 ? raw : undefined;
            return (
              <div key={week[0].key} className="grid grid-cols-[2.2rem_repeat(7,minmax(0,1fr))] gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-lg text-[10px] font-semibold uppercase text-muted [writing-mode:vertical-rl] rotate-180",
                    isCurrent && "bg-accent/10 text-accent",
                  )}
                  title={isCurrent ? "Semana actual" : undefined}
                >
                  {wn ? `Sem ${wn}` : ""}
                </div>
                {week.map((d) => (
                  <DayCell
                    key={d.key}
                    dateKey={d.key}
                    inMonth={d.inMonth}
                    today={p.today}
                    admin={admin}
                    workspaceId={p.workspaceId}
                    weekNum={wn}
                  >
                    {(p.byDay[d.key] ?? []).map((it) => (
                      <Chip
                        key={it.id}
                        item={it}
                        type={p.typeById[it.content_type_id]}
                        href={`${p.itemHref}${it.id}`}
                        now={p.now}
                        draggable={admin}
                        compact={p.typeById[it.content_type_id]?.key === "historia"}
                      />
                    ))}
                  </DayCell>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekView(p: InnerProps & { weeks: string[][] }) {
  const monthWeeks = p.weeks.filter((w) => w.some((d) => Number(d.slice(5, 7)) === p.month));
  const initial = Math.max(
    0,
    monthWeeks.findIndex((w) => w.includes(p.today)),
  );
  const [idx, setIdx] = useState(initial);
  const days = monthWeeks[idx] ?? weekRange(`${p.year}-${String(p.month).padStart(2, "0")}-01`).days;
  const admin = p.mode === "admin";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Semana anterior">
          <ChevronLeft />
        </Button>
        <p className="text-sm font-medium">
          Semana {weekOfMonth(days.find((d) => Number(d.slice(5, 7)) === p.month) ?? days[0])} · {formatDayMonth(days[0])} al{" "}
          {formatDayMonth(days[6])}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.min(monthWeeks.length - 1, i + 1))}
          disabled={idx >= monthWeeks.length - 1}
          aria-label="Semana siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-7">
        {days.map((d, i) => (
          <DayCell key={d} dateKey={d} inMonth today={p.today} admin={admin} workspaceId={p.workspaceId}>
            <p className="text-[11px] font-semibold uppercase text-muted sm:hidden">{WEEKDAYS[i]}</p>
            {(p.byDay[d] ?? []).map((it) => (
              <WeekCard key={it.id} item={it} p={p} admin={admin} />
            ))}
          </DayCell>
        ))}
      </div>
    </div>
  );
}

function WeekCard({ item, p, admin }: { item: CalItem; p: InnerProps; admin: boolean }) {
  const t = p.typeById[item.content_type_id];
  return (
    <div className="space-y-1">
      <Chip item={item} type={t} href={`${p.itemHref}${item.id}`} now={p.now} draggable={admin} />
      <div className="px-0.5">
        <StatusBadge status={item.status} client={!admin} />
      </div>
    </div>
  );
}

function ListView(p: InnerProps & { weeks: string[][] }) {
  const admin = p.mode === "admin";
  const monthWeeks = p.weeks.filter((w) => w.some((d) => Number(d.slice(5, 7)) === p.month));
  const hasAny = Object.keys(p.byDay).length > 0;
  if (!hasAny)
    return (
      <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
        No hay piezas para mostrar con estos filtros.
      </p>
    );
  return (
    <div className="space-y-5">
      {monthWeeks.map((w) => {
        const inMonth = w.filter((d) => Number(d.slice(5, 7)) === p.month);
        const dayItems = inMonth.filter((d) => p.byDay[d]?.length);
        if (!dayItems.length) return null;
        const isCurrent = w.includes(p.today);
        return (
          <section key={w[0]} aria-label={`Semana ${weekOfMonth(inMonth[0])}`}>
            <h3
              className={cn(
                "mb-2 flex items-center gap-2 text-sm font-semibold",
                isCurrent ? "text-accent" : "text-muted",
              )}
            >
              Semana {weekOfMonth(inMonth[0])} · {formatDayMonth(inMonth[0])} al {formatDayMonth(inMonth[inMonth.length - 1])}
              {isCurrent && <span className="rounded-full bg-accent/10 px-2 text-xs">Esta semana</span>}
            </h3>
            <ul className="space-y-2">
              {dayItems.flatMap((d) =>
                p.byDay[d].map((it) => {
                  const t = p.typeById[it.content_type_id];
                  const struck = isStruck(it, p.now);
                  const late = getTimeState(it, p.now) === "atrasada";
                  const urgent = isUrgentApproval(it, p.leadDays, p.now);
                  return (
                    <li key={it.id}>
                      <Link
                        href={`${p.itemHref}${it.id}`}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-accent/50",
                          d === p.today && "ring-2 ring-accent/40",
                          late && "border-danger/50",
                        )}
                      >
                        <span
                          className="mt-0.5 w-20 shrink-0 rounded-lg px-2 py-1 text-center text-[11px] font-semibold uppercase"
                          style={{ background: t?.color, color: t?.text_color, border: `1px solid ${t?.text_color}22` }}
                        >
                          {t?.label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-xs text-muted", struck && "line-through")}>
                            {formatDateKeyLong(d)} · {arTime(it.publish_at)} hs
                            {d === p.today && <strong className="ml-1 text-accent">· Hoy</strong>}
                          </span>
                          <span className={cn("block font-medium", struck && "text-muted line-through")}>
                            {struck && <Check className="mr-1 inline size-4 text-ok" aria-label="Publicada" />}
                            {it.title || "Sin título"}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            <StatusBadge status={it.status} client={!admin} />
                            {late && <LateBadge />}
                            {urgent && <UrgentBadge />}
                            {it.updated && <UpdatedBadge />}
                            {it.series_name && (
                              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{it.series_name}</span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                }),
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Board(p: CalendarProps & { typeById: Record<string, ContentType>; now: Date }) {
  const cols = STATUS_ORDER.filter((s) => s !== "reemplazado");
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {cols.map((s) => (
        <BoardColumn key={s} status={s}>
          {p.items
            .filter((i) => i.status === s)
            .sort((a, b) => a.publish_at.localeCompare(b.publish_at))
            .map((it) => (
              <Chip
                key={it.id}
                item={it}
                type={p.typeById[it.content_type_id]}
                href={`${p.itemHref}${it.id}`}
                now={p.now}
                draggable
              />
            ))}
        </BoardColumn>
      ))}
    </div>
  );
}

function BoardColumn({ status, children }: { status: ContentStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` });
  const m = STATUS_META[status];
  return (
    <div
      ref={setNodeRef}
      className={cn("flex w-56 shrink-0 flex-col gap-1.5 rounded-2xl border border-line bg-surface p-2", isOver && "border-accent bg-accent/5")}
    >
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted" title={m.help}>
        {m.label}
      </p>
      {children}
    </div>
  );
}

function Legend({ types, note }: { types: ContentType[]; note?: string | null }) {
  const used = types.filter((t) => !["tiktok", "otro"].includes(t.key));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      {used.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-line" style={{ background: t.color }} /> {t.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3 text-ok" /> <span className="line-through">Tachado</span> = ya publicado
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-3 rounded border-2 border-danger" /> Atrasada
      </span>
      {note && <span className="basis-full italic">{note}</span>}
    </div>
  );
}

export function MonthNav({
  basePath,
  year,
  month,
  label,
  todayYM,
}: {
  basePath: string;
  year: number;
  month: number;
  label: string;
  todayYM: { year: number; month: number };
}) {
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const isCurrent = todayYM.year === year && todayYM.month === month;
  return (
    <div className="flex items-center gap-1">
      <Link className="rounded-lg p-2 hover:bg-ink/5" href={`${basePath}?y=${prev.y}&m=${prev.m}`} aria-label="Mes anterior">
        <ChevronLeft className="size-5" />
      </Link>
      <span className="min-w-[9.5rem] text-center font-display text-xl font-semibold">{label}</span>
      <Link className="rounded-lg p-2 hover:bg-ink/5" href={`${basePath}?y=${next.y}&m=${next.m}`} aria-label="Mes siguiente">
        <ChevronRight className="size-5" />
      </Link>
      {!isCurrent && (
        <Link className="ml-1 rounded-lg border border-line px-2 py-1 text-xs hover:bg-ink/5" href={`${basePath}?y=${todayYM.year}&m=${todayYM.month}`}>
          Ir a hoy
        </Link>
      )}
    </div>
  );
}

