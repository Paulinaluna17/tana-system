"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Lock,
  Plus,
  Replace,
  Save,
  Trash2,
  Wand2,
  BookmarkPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { formatLong, weekOfMonth } from "@/lib/dates";
import type { ContentType, Pillar, Series } from "@/lib/types";
import {
  applyPieceTemplate,
  deleteItem,
  duplicateItem,
  replaceItem,
  saveItemAsTemplate,
  updateItem,
  type ItemInput,
} from "@/app/actions/content";
import { cn } from "@/lib/utils";

const NETWORKS = ["instagram", "tiktok", "facebook", "linkedin", "youtube"];
const RATIOS = ["", "9:16", "4:5", "1:1", "16:9"];

export function PieceEditor({
  id,
  initial,
  types,
  pillars,
  series,
  templates,
  revisionInfo,
}: {
  id: string;
  initial: ItemInput;
  types: ContentType[];
  pillars: Pillar[];
  series: Series[];
  templates: { id: string; name: string }[];
  revisionInfo: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<ItemInput>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [tplName, setTplName] = useState("");

  useEffect(() => {
    setV(initial);
    setDirty(false);
  }, [initial]);

  const set = <K extends keyof ItemInput>(k: K, val: ItemInput[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setDirty(true);
  };
  const setFmt = (k: keyof ItemInput["format"], val: string) => set("format", { ...v.format, [k]: val });

  const save = () =>
    start(async () => {
      const res = await updateItem(id, v);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Guardado. El cliente ya ve los cambios.");
        setDirty(false);
        router.refresh();
      }
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  });

  const run = (fn: () => Promise<{ error?: string; message?: string } | undefined>) =>
    start(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else if (r?.message) toast.success(r.message);
      router.refresh();
    });

  const type = types.find((t) => t.id === v.content_type_id);
  const isVideo = ["reel", "tiktok", "historia"].includes(type?.key ?? "");
  const isCarousel = ["carrusel", "post"].includes(type?.key ?? "");
  const captionLen = (v.caption ?? "").length;
  const when = `${v.date}T${v.time}:00-03:00`;

  return (
    <div className="space-y-4">
      {/* Barra superior fija */}
      <div className="sticky top-[57px] z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <span className="text-sm text-muted">
          {formatLong(when)} · Semana {weekOfMonth(v.date)}
        </span>
        <span className="flex-1" />
        {dirty && <span className="text-xs text-warn">Cambios sin guardar</span>}
        <Button onClick={save} disabled={pending} size="sm">
          <Save /> {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Encabezado</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Tipo de pieza" htmlFor="type" className="col-span-2 sm:col-span-1">
              <Select id="type" value={v.content_type_id} onChange={(e) => set("content_type_id", e.target.value)}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estado" htmlFor="status" className="col-span-2 sm:col-span-1" hint={STATUS_META[v.status].help}>
              <Select id="status" value={v.status} onChange={(e) => set("status", e.target.value as ItemInput["status"])}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha" htmlFor="date">
              <Input id="date" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Hora" htmlFor="time">
              <Input id="time" type="time" value={v.time} onChange={(e) => set("time", e.target.value)} />
            </Field>
            <Field label="Pilar de contenido" htmlFor="pillar">
              <Select id="pillar" value={v.pillar_id ?? ""} onChange={(e) => set("pillar_id", e.target.value || null)}>
                <option value="">—</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Serie / sección" htmlFor="series">
              <Select id="series" value={v.series_id ?? ""} onChange={(e) => set("series_id", e.target.value || null)}>
                <option value="">—</option>
                {series.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="¿Quién produce?" htmlFor="owner">
              <Select
                id="owner"
                value={v.production_owner}
                onChange={(e) => set("production_owner", e.target.value as ItemInput["production_owner"])}
              >
                <option value="tana">Tana</option>
                <option value="cliente">El cliente</option>
                <option value="mixto">Mixto</option>
              </Select>
            </Field>
            <Field label="Persona responsable" htmlFor="person">
              <Input id="person" value={v.production_person ?? ""} onChange={(e) => set("production_person", e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Label2>Redes</Label2>
              <div className="flex flex-wrap gap-2">
                {NETWORKS.map((n) => (
                  <label key={n} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={v.networks.includes(n)}
                      onChange={(e) =>
                        set("networks", e.target.checked ? [...v.networks, n] : v.networks.filter((x) => x !== n))
                      }
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>
            <label className="col-span-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={v.is_visible_to_client}
                onChange={(e) => set("is_visible_to_client", e.target.checked)}
              />
              <span>
                Mostrarla al cliente aunque el mes esté en borrador <span className="text-muted">(las “Idea” y “En redacción” nunca se muestran)</span>
              </span>
            </label>
            <p className="col-span-2 text-xs text-muted">{revisionInfo}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estrategia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Tema / idea" htmlFor="title">
              <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej.: Roma, ahora desde donde estés" />
            </Field>
            <Field label="Objetivo de la pieza" htmlFor="objective">
              <Textarea id="objective" value={v.objective ?? ""} onChange={(e) => set("objective", e.target.value)} />
            </Field>
            <Field label="Público / a quién le habla (opcional)" htmlFor="audience">
              <Textarea id="audience" className="min-h-[60px]" value={v.audience ?? ""} onChange={(e) => set("audience", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formato y especificaciones</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="Formato" htmlFor="ratio">
            <Select id="ratio" value={v.format.ratio ?? ""} onChange={(e) => setFmt("ratio", e.target.value)}>
              {RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r === "" ? "—" : r === "9:16" ? "Vertical 9:16" : r === "4:5" ? "Vertical 4:5" : r === "1:1" ? "Cuadrado 1:1" : "Horizontal 16:9"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duración" htmlFor="duration">
            <Input id="duration" value={v.format.duration ?? ""} onChange={(e) => setFmt("duration", e.target.value)} placeholder="30–45 s" />
          </Field>
          <Field label="Cantidad de placas" htmlFor="slidesn">
            <Input id="slidesn" value={String(v.format.slides ?? "")} onChange={(e) => setFmt("slides", e.target.value)} />
          </Field>
          <Field label="Música / audio" htmlFor="audio">
            <Input id="audio" value={v.format.audio ?? ""} onChange={(e) => setFmt("audio", e.target.value)} />
          </Field>
          <Field label="Texto en pantalla" htmlFor="ost">
            <Input id="ost" value={v.format.on_screen_text ?? ""} onChange={(e) => setFmt("on_screen_text", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indicaciones de grabación / producción</CardTitle>
          <p className="text-sm text-muted">Una indicación por línea, empezando con “- ”: lugar, luz, encuadre, plano, micrófonos, vestuario, qué no hacer.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            aria-label="Indicaciones de grabación"
            className="min-h-[130px]"
            value={v.recording_instructions ?? ""}
            onChange={(e) => set("recording_instructions", e.target.value)}
            placeholder={"- Grabá con el celular en vertical, a la altura de los ojos.\n- Ponete de frente a la luz."}
          />
          <ListEditor
            label="Shot list (tomas)"
            hint="El cliente puede tildarlas a medida que graba."
            items={v.shot_list}
            onChange={(items) => set("shot_list", items)}
            empty={{ text: "", done: false }}
            render={(it, upd) => (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="Toma grabada"
                  checked={!!it.done}
                  onChange={(e) => upd({ ...it, done: e.target.checked })}
                />
                <Input value={it.text} onChange={(e) => upd({ ...it, text: e.target.value })} placeholder="Descripción de la toma" />
              </div>
            )}
          />
          {(isVideo || v.script.length > 0) && (
            <ListEditor
              label="Guion"
              hint="Bloques: Gancho (0–3 s) · Desarrollo · Cierre / CTA."
              items={v.script}
              onChange={(items) => set("script", items)}
              empty={{ section: v.script.length === 0 ? "Gancho" : "Desarrollo", time: "", voice: "", on_screen: "" }}
              render={(b, upd) => (
                <div className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[10rem_6rem_1fr_1fr]">
                  <Input aria-label="Sección" value={b.section} onChange={(e) => upd({ ...b, section: e.target.value })} placeholder="Sección" />
                  <Input aria-label="Tiempo" value={b.time ?? ""} onChange={(e) => upd({ ...b, time: e.target.value })} placeholder="0–3 s" />
                  <Textarea
                    aria-label="Qué se dice"
                    className="min-h-[60px]"
                    value={b.voice ?? ""}
                    onChange={(e) => upd({ ...b, voice: e.target.value })}
                    placeholder="Qué se dice"
                  />
                  <Textarea
                    aria-label="Texto en pantalla"
                    className="min-h-[60px]"
                    value={b.on_screen ?? ""}
                    onChange={(e) => upd({ ...b, on_screen: e.target.value })}
                    placeholder="Texto en pantalla"
                  />
                </div>
              )}
            />
          )}
          {(isCarousel || v.slides.length > 0) && (
            <ListEditor
              label="Placa por placa"
              items={v.slides}
              onChange={(items) => set("slides", items)}
              empty={{ text: "" }}
              render={(s, upd, i) => (
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-14 shrink-0 text-xs font-semibold text-muted">Placa {i + 1}</span>
                  <Textarea className="min-h-[52px]" value={s.text} onChange={(e) => upd({ text: e.target.value })} />
                </div>
              )}
            />
          )}
          {!isVideo && v.script.length === 0 && (
            <Button variant="ghost" size="sm" onClick={() => set("script", [{ section: "Gancho", time: "", voice: "", on_screen: "" }])}>
              <Plus /> Agregar guion
            </Button>
          )}
          {!isCarousel && v.slides.length === 0 && (
            <Button variant="ghost" size="sm" onClick={() => set("slides", [{ text: "" }])}>
              <Plus /> Agregar placas
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Copy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={`Copy / texto sugerido · ${captionLen}/2200`} htmlFor="caption">
              <Textarea id="caption" className="min-h-[140px]" value={v.caption ?? ""} onChange={(e) => set("caption", e.target.value)} />
            </Field>
            <Field label="CTA (un solo llamado a la acción)" htmlFor="cta">
              <Input id="cta" value={v.cta ?? ""} onChange={(e) => set("cta", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Hashtags" htmlFor="hashtags">
                <Input id="hashtags" value={v.hashtags ?? ""} onChange={(e) => set("hashtags", e.target.value)} />
              </Field>
              <Field label="Menciones" htmlFor="mentions">
                <Input id="mentions" value={v.mentions ?? ""} onChange={(e) => set("mentions", e.target.value)} />
              </Field>
              <Field label="Ubicación" htmlFor="location">
                <Input id="location" value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Material y referencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Material que tiene que mandar el cliente" htmlFor="matreq">
              <Textarea id="matreq" className="min-h-[60px]" value={v.client_material_request ?? ""} onChange={(e) => set("client_material_request", e.target.value)} />
            </Field>
            <Field label="Fecha límite del material" htmlFor="matdue">
              <Input id="matdue" type="date" value={v.client_material_due ?? ""} onChange={(e) => set("client_material_due", e.target.value || null)} />
            </Field>
            <ListEditor
              label="Referencias / inspiración (links)"
              items={v.references}
              onChange={(items) => set("references", items)}
              empty={{ label: "", url: "https://" }}
              render={(r, upd) => (
                <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                  <Input aria-label="Nombre" value={r.label ?? ""} onChange={(e) => upd({ ...r, label: e.target.value })} placeholder="Nombre" />
                  <Input aria-label="URL" value={r.url} onChange={(e) => upd({ ...r, url: e.target.value })} placeholder="https://…" />
                </div>
              )}
            />
            <Field label="Entregable final (link al diseño o video terminado)" htmlFor="final">
              <Input id="final" value={v.final_asset_url ?? ""} onChange={(e) => set("final_asset_url", e.target.value)} placeholder="https://drive.google.com/…" />
            </Field>
            <Field label="Link al posteo publicado" htmlFor="pub">
              <Input id="pub" value={v.published_url ?? ""} onChange={(e) => set("published_url", e.target.value)} placeholder="https://instagram.com/p/…" />
            </Field>
            {v.status === "publicado" && (
              <div className="grid grid-cols-3 gap-2">
                {(["reach", "saves", "comments"] as const).map((k) => (
                  <Field key={k} label={k === "reach" ? "Alcance" : k === "saves" ? "Guardados" : "Comentarios"} htmlFor={`m-${k}`}>
                    <Input
                      id={`m-${k}`}
                      type="number"
                      min={0}
                      value={v.metrics[k] ?? ""}
                      onChange={(e) => set("metrics", { ...v.metrics, [k]: e.target.value === "" ? undefined : Number(e.target.value) })}
                    />
                  </Field>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aclaraciones</CardTitle>
            <p className="text-sm text-muted">Visible para el cliente.</p>
          </CardHeader>
          <CardContent>
            <Textarea aria-label="Aclaraciones" value={v.clarifications ?? ""} onChange={(e) => set("clarifications", e.target.value)} />
          </CardContent>
        </Card>
        <Card className="border-dashed border-ink/30 bg-ink/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" /> Notas internas
            </CardTitle>
            <p className="text-sm text-muted">Solo las ve Tana. El cliente nunca las ve.</p>
          </CardHeader>
          <CardContent>
            <Textarea aria-label="Notas internas" className="bg-transparent" value={v.internal_notes ?? ""} onChange={(e) => set("internal_notes", e.target.value)} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button onClick={save} disabled={pending}>
          <Save /> Guardar
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => run(() => duplicateItem(id))}>
          <CopyPlus /> Duplicar
        </Button>
        <ConfirmButton
          icon={<Replace />}
          label="Cambiar por otra pieza"
          title="¿Cambiar esta pieza por otra?"
          description="Esta queda en el historial como “Reemplazada” y se crea una nueva en la misma fecha. El cliente la verá con la etiqueta “Actualizado”."
          onConfirm={() => run(() => replaceItem(id))}
        />
        {templates.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Wand2 /> Usar plantilla
              </Button>
            </DialogTrigger>
            <DialogContent title="Aplicar una plantilla de pieza" description="Completa los campos con la plantilla (reemplaza lo que haya).">
              <div className="space-y-2">
                {templates.map((t) => (
                  <DialogClose asChild key={t.id}>
                    <Button variant="secondary" className="w-full justify-start" onClick={() => run(() => applyPieceTemplate(id, t.id))}>
                      {t.name}
                    </Button>
                  </DialogClose>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost">
              <BookmarkPlus /> Guardar como plantilla
            </Button>
          </DialogTrigger>
          <DialogContent title="Guardar como plantilla" description="Para reutilizar esta estructura en otras piezas.">
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Ej.: Reel con guion a cámara" />
            <div className="mt-3 flex justify-end">
              <DialogClose asChild>
                <Button onClick={() => run(() => saveItemAsTemplate(id, tplName))} disabled={!tplName.trim()}>
                  Guardar
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
        <span className="flex-1" />
        <ConfirmButton
          icon={<Trash2 />}
          label="Eliminar"
          variant="danger"
          title="¿Eliminar esta pieza?"
          description="Se borra con sus comentarios e historial. Si el cliente pidió cambiarla, mejor usá “Cambiar por otra pieza”."
          onConfirm={() => run(() => deleteItem(id))}
        />
      </div>
    </div>
  );
}

function Label2({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

function ListEditor<T>({
  label,
  hint,
  items,
  onChange,
  empty,
  render,
}: {
  label: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, update: (n: T) => void, index: number) => React.ReactNode;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div>
      <Label2>{label}</Label2>
      {hint && <p className="-mt-0.5 mb-2 text-xs text-muted">{hint}</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="min-w-0 flex-1">{render(it, (n) => onChange(items.map((x, k) => (k === i ? n : x))), i)}</div>
            <div className="flex flex-col">
              <button type="button" className="rounded p-1 text-muted hover:bg-ink/5" onClick={() => move(i, -1)} aria-label="Subir">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" className="rounded p-1 text-muted hover:bg-ink/5" onClick={() => move(i, 1)} aria-label="Bajar">
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            <button
              type="button"
              className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
              onClick={() => onChange(items.filter((_, k) => k !== i))}
              aria-label="Quitar"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => onChange([...items, structuredClone(empty)])}>
        <Plus /> Agregar
      </Button>
    </div>
  );
}

function ConfirmButton({
  icon,
  label,
  title,
  description,
  onConfirm,
  variant = "secondary",
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "secondary" | "danger";
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant === "danger" ? "ghost" : "secondary"} className={cn(variant === "danger" && "text-danger hover:bg-danger/10")}>
          {icon} {label}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm}>
              Confirmar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
