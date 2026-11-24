"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Copy, KeyRound, Pencil, Plus, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  accessLink,
  deleteNamed,
  deleteSlot,
  inviteMember,
  removeMember,
  saveCatalogService,
  saveContentType,
  saveIdea,
  saveNamed,
  saveSlot,
  scheduleIdea,
  setMemberRole,
} from "@/app/actions/workspace";
import { weekdayLabel } from "@/lib/dates";
import type { ContentType, Pillar, Series, Service, TemplateSlot } from "@/lib/types";

export function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string; message?: string } | undefined>) =>
    start(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else {
        if (r?.message) toast.success(r.message);
        router.refresh();
      }
    });
  return { pending, run };
}

const RECURRENCE = [
  ["weekly", "Todas las semanas"],
  ["biweekly", "Cada 15 días"],
  ["monthly_first", "1° del mes (ese día)"],
  ["monthly_last", "Último del mes (ese día)"],
] as const;

export function SlotDialog({
  workspaceId,
  types,
  series,
  slot,
}: {
  workspaceId: string;
  types: ContentType[];
  series: Series[];
  slot?: TemplateSlot;
}) {
  const { run } = useRun();
  const [v, setV] = useState({
    content_type_id: slot?.content_type_id ?? types[0]?.id ?? "",
    weekday: slot?.weekday ?? 1,
    time: slot?.time?.slice(0, 5) ?? "19:00",
    recurrence: slot?.recurrence ?? "weekly",
    anchor_date: slot?.anchor_date ?? "",
    title_default: slot?.title_default ?? "",
    series_id: slot?.series_id ?? "",
    example: slot?.story_template?.example ?? "",
    objective: slot?.story_template?.objective ?? "",
    format: slot?.story_template?.format ?? "",
    active: slot?.active ?? true,
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={slot ? "ghost" : "secondary"} aria-label={slot ? "Editar" : undefined}>
          {slot ? <Pencil /> : <Plus />} {slot ? "" : "Agregar a la plantilla"}
        </Button>
      </DialogTrigger>
      <DialogContent title={slot ? "Editar publicación fija" : "Nueva publicación fija"} description="Se usa para “Generar mes desde plantilla”." className="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" htmlFor="st-type">
            <Select id="st-type" value={v.content_type_id} onChange={(e) => setV({ ...v, content_type_id: e.target.value })}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Día" htmlFor="st-day">
            <Select id="st-day" value={v.weekday} onChange={(e) => setV({ ...v, weekday: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {weekdayLabel(d)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hora" htmlFor="st-time">
            <Input id="st-time" type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
          </Field>
          <Field label="Frecuencia" htmlFor="st-rec">
            <Select id="st-rec" value={v.recurrence} onChange={(e) => setV({ ...v, recurrence: e.target.value as typeof v.recurrence })}>
              {RECURRENCE.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          {v.recurrence === "biweekly" && (
            <Field label="Una fecha en la que toca" htmlFor="st-anchor" className="col-span-2" hint="Desde esa fecha se cuenta cada 15 días.">
              <Input id="st-anchor" type="date" value={v.anchor_date ?? ""} onChange={(e) => setV({ ...v, anchor_date: e.target.value })} />
            </Field>
          )}
          <Field label="Título por defecto (opcional)" htmlFor="st-title" className="col-span-2">
            <Input id="st-title" value={v.title_default ?? ""} onChange={(e) => setV({ ...v, title_default: e.target.value })} placeholder="Ej.: Historia con caja de preguntas" />
          </Field>
          <Field label="Serie (opcional)" htmlFor="st-series" className="col-span-2">
            <Select id="st-series" value={v.series_id ?? ""} onChange={(e) => setV({ ...v, series_id: e.target.value })}>
              <option value="">—</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Objetivo (se precarga en cada pieza)" htmlFor="st-obj" className="col-span-2">
            <Textarea id="st-obj" className="min-h-[50px]" value={v.objective} onChange={(e) => setV({ ...v, objective: e.target.value })} />
          </Field>
          <Field label="Ejemplo" htmlFor="st-ex">
            <Input id="st-ex" value={v.example} onChange={(e) => setV({ ...v, example: e.target.value })} placeholder="¿Cuál es tu objetivo de esta semana?" />
          </Field>
          <Field label="Formato / sticker" htmlFor="st-fmt">
            <Input id="st-fmt" value={v.format} onChange={(e) => setV({ ...v, format: e.target.value })} placeholder="Sticker de encuesta" />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Activa
          </label>
        </div>
        <div className="mt-4 flex justify-between">
          {slot ? (
            <DialogClose asChild>
              <Button variant="ghost" className="text-danger" onClick={() => run(() => deleteSlot(slot.id))}>
                <Trash2 /> Quitar
              </Button>
            </DialogClose>
          ) : (
            <span />
          )}
          <DialogClose asChild>
            <Button
              onClick={() =>
                run(() =>
                  saveSlot({
                    id: slot?.id,
                    workspace_id: workspaceId,
                    content_type_id: v.content_type_id,
                    weekday: v.weekday,
                    time: v.time,
                    recurrence: v.recurrence,
                    anchor_date: v.recurrence === "biweekly" ? v.anchor_date || null : null,
                    title_default: v.title_default || null,
                    series_id: v.series_id || null,
                    story_template: Object.fromEntries(
                      Object.entries({ example: v.example, objective: v.objective, format: v.format }).filter(([, x]) => x),
                    ),
                    active: v.active,
                  }),
                )
              }
            >
              Guardar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TypeDialog({ workspaceId, type }: { workspaceId: string; type?: ContentType }) {
  const { run } = useRun();
  const [v, setV] = useState({
    label: type?.label ?? "",
    color: type?.color ?? "#64748b",
    text_color: type?.text_color ?? "#ffffff",
    description: type?.description ?? "",
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        {type ? (
          <button
            className="rounded-lg px-3 py-1.5 text-sm font-semibold uppercase"
            style={{ background: type.color, color: type.text_color, border: `1px solid ${type.text_color}33` }}
          >
            {type.label}
          </button>
        ) : (
          <Button size="sm" variant="ghost">
            <Plus /> Tipo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={type ? `Tipo: ${type.label}` : "Nuevo tipo de pieza"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" htmlFor="ty-l" className="col-span-2">
            <Input id="ty-l" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
          </Field>
          <Field label="Color" htmlFor="ty-c">
            <Input id="ty-c" type="color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} />
          </Field>
          <Field label="Color del texto" htmlFor="ty-t">
            <Input id="ty-t" type="color" value={v.text_color} onChange={(e) => setV({ ...v, text_color: e.target.value })} />
          </Field>
          <Field label="Descripción (para la guía del cliente)" htmlFor="ty-d" className="col-span-2">
            <Textarea id="ty-d" className="min-h-[60px]" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <div className="col-span-2 rounded-lg p-3 text-sm font-semibold uppercase" style={{ background: v.color, color: v.text_color }}>
            Vista previa · {v.label || "Tipo"}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button
              onClick={() =>
                run(() =>
                  saveContentType({
                    id: type?.id,
                    workspace_id: workspaceId,
                    key: type?.key ?? v.label,
                    label: v.label,
                    color: v.color,
                    text_color: v.text_color,
                    description: v.description || null,
                  }),
                )
              }
            >
              Guardar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NamedList({
  workspaceId,
  table,
  items,
  placeholder,
}: {
  workspaceId: string;
  table: "pillars" | "series";
  items: (Pillar | Series)[];
  placeholder: string;
}) {
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  const [extra, setExtra] = useState(table === "pillars" ? "#94a3b8" : "");
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => (
          <li key={it.id} className="inline-flex items-center gap-1.5 rounded-full border border-line py-1 pl-3 pr-1 text-sm">
            {"color" in it && <span className="size-2.5 rounded-full" style={{ background: it.color }} />}
            {it.name}
            <button className="rounded-full p-1 text-muted hover:bg-danger/10 hover:text-danger" onClick={() => run(() => deleteNamed(table, it.id))} aria-label={`Quitar ${it.name}`}>
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} />
        {table === "pillars" ? (
          <Input type="color" value={extra} onChange={(e) => setExtra(e.target.value)} className="w-14 p-1" aria-label="Color" />
        ) : (
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Descripción" />
        )}
        <Button
          size="md"
          variant="secondary"
          disabled={pending || !name.trim()}
          onClick={() => {
            run(() => saveNamed(table, { workspace_id: workspaceId, name, extra }));
            setName("");
          }}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export function DeleteButton({ table, id, label }: { table: "idea_bank" | "piece_templates"; id: string; label: string }) {
  const { run, pending } = useRun();
  return (
    <Button size="icon" variant="ghost" disabled={pending} onClick={() => run(() => deleteNamed(table, id))} aria-label={`Borrar ${label}`}>
      <Trash2 />
    </Button>
  );
}

export function IdeaForm({
  workspaceId,
  types,
  pillars,
}: {
  workspaceId: string;
  types: ContentType[];
  pillars: Pillar[];
}) {
  const { run, pending } = useRun();
  const [v, setV] = useState({ title: "", notes: "", pillar_id: "", content_type_id: "" });
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_auto]">
      <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Nueva idea…" aria-label="Idea" />
      <Select value={v.content_type_id} onChange={(e) => setV({ ...v, content_type_id: e.target.value })} aria-label="Tipo">
        <option value="">Tipo</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </Select>
      <Select value={v.pillar_id} onChange={(e) => setV({ ...v, pillar_id: e.target.value })} aria-label="Pilar">
        <option value="">Pilar</option>
        {pillars.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Button
        disabled={pending || !v.title.trim()}
        onClick={() => {
          run(() =>
            saveIdea({
              workspace_id: workspaceId,
              title: v.title,
              notes: v.notes || null,
              pillar_id: v.pillar_id || null,
              content_type_id: v.content_type_id || null,
            }),
          );
          setV({ title: "", notes: "", pillar_id: "", content_type_id: "" });
        }}
      >
        <Plus /> Agregar
      </Button>
      <Textarea
        className="min-h-[50px] sm:col-span-4"
        value={v.notes}
        onChange={(e) => setV({ ...v, notes: e.target.value })}
        placeholder="Notas (opcional)"
        aria-label="Notas"
      />
    </div>
  );
}

export function ScheduleIdeaDialog({ ideaId }: { ideaId: string }) {
  const { run } = useRun();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <CalendarPlus /> Pasar al calendario
        </Button>
      </DialogTrigger>
      <DialogContent title="¿Qué día va?">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" htmlFor="sd">
            <Input id="sd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora" htmlFor="sh">
            <Input id="sh" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button disabled={!date} onClick={() => run(() => scheduleIdea(ideaId, date, time))}>
              Agendar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InviteForm({ workspaceId }: { workspaceId: string }) {
  const { run, pending } = useRun();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"client_editor" | "client_viewer">("client_editor");
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_12rem_auto]">
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cliente.com" aria-label="Email" />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" aria-label="Nombre" />
      <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} aria-label="Rol">
        <option value="client_editor">Puede aprobar y pagar</option>
        <option value="client_viewer">Solo ver y comentar</option>
      </Select>
      <Button
        disabled={pending || !email}
        onClick={() => {
          run(() => inviteMember(workspaceId, email, name, role));
          setEmail("");
          setName("");
        }}
      >
        <Plus /> Dar acceso
      </Button>
    </div>
  );
}

export function MemberRow({
  workspaceId,
  userId,
  email,
  role,
}: {
  workspaceId: string;
  userId: string;
  email: string;
  role: "client_editor" | "client_viewer";
}) {
  const { run, pending } = useRun();
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="h-9 w-auto"
        value={role}
        onChange={(e) => run(() => setMemberRole(workspaceId, userId, e.target.value as typeof role))}
        aria-label="Rol"
      >
        <option value="client_editor">Puede aprobar y pagar</option>
        <option value="client_viewer">Solo ver y comentar</option>
      </Select>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          const r = await accessLink(email);
          if (r.error) toast.error(r.error);
          else setLink(r.url ?? null);
        }}
      >
        <KeyRound /> Link de acceso
      </Button>
      <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(() => removeMember(workspaceId, userId))}>
        <UserMinus /> Quitar
      </Button>
      {link && (
        <div className="flex w-full gap-2">
          <input readOnly value={link} className="h-9 flex-1 rounded-lg border border-line bg-bg px-2 text-xs" aria-label="Link de acceso" />
          <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Copiado (vale una sola vez)"))}>
            <Copy />
          </Button>
        </div>
      )}
    </div>
  );
}

export function CatalogServiceDialog({ service }: { service?: Service }) {
  const { run } = useRun();
  const [v, setV] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    includes: (service?.includes ?? []).join("\n"),
    excludes: (service?.excludes ?? []).join("\n"),
    default_price: String(service?.default_price ?? ""),
    billing: service?.billing ?? "mensual",
    active: service?.active ?? true,
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={service ? "ghost" : "primary"}>
          {service ? <Pencil /> : <Plus />} {service ? "Editar" : "Nuevo servicio"}
        </Button>
      </DialogTrigger>
      <DialogContent title={service ? "Editar servicio" : "Nuevo servicio del catálogo"} className="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" htmlFor="cs-n" className="col-span-2">
            <Input id="cs-n" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label="Descripción" htmlFor="cs-d" className="col-span-2">
            <Textarea id="cs-d" className="min-h-[60px]" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <Field label="Incluye (uno por línea)" htmlFor="cs-i">
            <Textarea id="cs-i" value={v.includes} onChange={(e) => setV({ ...v, includes: e.target.value })} />
          </Field>
          <Field label="No incluye (uno por línea)" htmlFor="cs-e">
            <Textarea id="cs-e" value={v.excludes} onChange={(e) => setV({ ...v, excludes: e.target.value })} />
          </Field>
          <Field label="Precio de referencia (ARS)" htmlFor="cs-p">
            <Input id="cs-p" type="number" min={0} value={v.default_price} onChange={(e) => setV({ ...v, default_price: e.target.value })} />
          </Field>
          <Field label="Modalidad" htmlFor="cs-b">
            <Select id="cs-b" value={v.billing} onChange={(e) => setV({ ...v, billing: e.target.value as typeof v.billing })}>
              <option value="mensual">Mensual</option>
              <option value="unico">Pago único</option>
              <option value="por_pieza">Por pieza</option>
            </Select>
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Se ofrece actualmente
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button
              onClick={() =>
                run(() =>
                  saveCatalogService({
                    id: service?.id,
                    name: v.name,
                    description: v.description || null,
                    includes: v.includes.split("\n"),
                    excludes: v.excludes.split("\n"),
                    default_price: Number(v.default_price || 0),
                    billing: v.billing,
                    active: v.active,
                  }),
                )
              }
            >
              Guardar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
