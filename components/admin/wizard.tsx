"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, Field, Input, Select } from "@/components/ui";
import { BrandFields, BrandPreview, LogoUpload } from "./brand-form";
import { createWorkspace, type WizardInput } from "@/app/actions/workspace";
import { weekdayLabel } from "@/lib/dates";
import { BILLING_LABEL } from "@/lib/status";
import type { Brand, Service } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

const STEPS = ["Datos", "Identidad visual", "Modelo de trabajo", "Frecuencia", "Servicios y accesos"];

const TYPE_OPTIONS = [
  ["post", "Post"],
  ["carrusel", "Carrusel"],
  ["reel", "Reel"],
  ["historia", "Historia"],
  ["tiktok", "TikTok"],
];

export function ClientWizard({ catalog }: { catalog: Service[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [v, setV] = useState<WizardInput>({
    name: "",
    industry: "",
    city: "",
    contact_name: "",
    whatsapp: "",
    email: "",
    instagram: "",
    tiktok: "",
    website: "",
    logo_url: "",
    brand: {
      primary: "#7E1624",
      secondary: "#E6DDD6",
      background: "#F6F3EF",
      surface: "#FFFFFF",
      text: "#2B1D1F",
      muted: "#746567",
      font: "Inter",
      headingFont: "Inter",
      theme: "light",
    },
    production_mode: "tana",
    approval_lead_days: 3,
    revision_rounds: 2,
    material_deadline_day: 25,
    slots: [
      { type_key: "carrusel", weekday: 2, time: "18:00", recurrence: "weekly", anchor_date: null, title_default: null },
      { type_key: "reel", weekday: 4, time: "19:00", recurrence: "weekly", anchor_date: null, title_default: null },
      { type_key: "historia", weekday: 1, time: "10:00", recurrence: "weekly", anchor_date: null, title_default: "Historia con caja de preguntas", example: "" },
      { type_key: "historia", weekday: 5, time: "19:00", recurrence: "weekly", anchor_date: null, title_default: "Historia de cierre de semana", example: "" },
    ],
    services: [],
    invites: [],
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const canNext = step === 0 ? v.name.trim().length >= 2 : true;
  const updSlot = (i: number, patch: Partial<WizardInput["slots"][number]>) =>
    setV({ ...v, slots: v.slots.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const finish = () =>
    start(async () => {
      const r = await createWorkspace(v);
      if (r?.error) {
        toast.error(r.error);
        if (r.slug) router.push(`/clientes/${r.slug}/usuarios`);
        return;
      }
      toast.success("¡Cliente creado! Ahora podés generar su primer mes.");
      router.push(`/clientes/${r?.slug}/calendario`);
    });

  return (
    <div className="space-y-4">
      <ol className="flex gap-1 overflow-x-auto" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                "w-full rounded-xl border px-2 py-2 text-left text-xs",
                i === step ? "border-accent bg-accent/10 font-semibold" : i < step ? "border-line text-ink" : "border-line text-muted",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="block text-[10px] uppercase tracking-wide text-muted">Paso {i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre de la marca *" htmlFor="w-name" className="col-span-2">
                <Input id="w-name" autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
              </Field>
              <Field label="Rubro" htmlFor="w-ind">
                <Input id="w-ind" value={v.industry} onChange={(e) => setV({ ...v, industry: e.target.value })} />
              </Field>
              <Field label="Ciudad" htmlFor="w-city">
                <Input id="w-city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
              </Field>
              <Field label="Persona de contacto" htmlFor="w-contact">
                <Input id="w-contact" value={v.contact_name} onChange={(e) => setV({ ...v, contact_name: e.target.value })} />
              </Field>
              <Field label="WhatsApp" htmlFor="w-wa">
                <Input id="w-wa" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} placeholder="54 9 11 …" />
              </Field>
              <Field label="Email" htmlFor="w-email">
                <Input id="w-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
              </Field>
              <Field label="Web o tienda" htmlFor="w-web">
                <Input id="w-web" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} />
              </Field>
              <Field label="Instagram" htmlFor="w-ig">
                <Input id="w-ig" value={v.instagram} onChange={(e) => setV({ ...v, instagram: e.target.value })} placeholder="@usuario" />
              </Field>
              <Field label="TikTok" htmlFor="w-tt">
                <Input id="w-tt" value={v.tiktok} onChange={(e) => setV({ ...v, tiktok: e.target.value })} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <LogoUpload onUploaded={(url) => setV({ ...v, logo_url: url })} />
                <BrandFields brand={v.brand as Brand} onChange={(b) => setV({ ...v, brand: b })} />
              </div>
              <BrandPreview brand={v.brand as Brand} logo={v.logo_url || null} name={v.name} />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="¿Quién produce el contenido?" htmlFor="w-pm" className="col-span-2">
                <Select id="w-pm" value={v.production_mode} onChange={(e) => setV({ ...v, production_mode: e.target.value as WizardInput["production_mode"] })}>
                  <option value="tana">Tana (diseña / produce)</option>
                  <option value="cliente">El cliente graba con nuestras indicaciones</option>
                  <option value="mixto">Mixto</option>
                </Select>
              </Field>
              <Field label="Días de anticipación para aprobar" htmlFor="w-lead" hint="Si falta menos para publicar, se marca “Aprobación urgente”.">
                <Input id="w-lead" type="number" min={0} max={30} value={v.approval_lead_days} onChange={(e) => setV({ ...v, approval_lead_days: Number(e.target.value) })} />
              </Field>
              <Field label="Rondas de cambios incluidas por pieza" htmlFor="w-rr">
                <Input id="w-rr" type="number" min={0} max={10} value={v.revision_rounds} onChange={(e) => setV({ ...v, revision_rounds: Number(e.target.value) })} />
              </Field>
              <Field label="Día del mes límite para mandar material" htmlFor="w-md">
                <Input
                  id="w-md"
                  type="number"
                  min={1}
                  max={28}
                  value={v.material_deadline_day ?? ""}
                  onChange={(e) => setV({ ...v, material_deadline_day: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">Publicaciones fijas de cada semana. Después podés cambiarlas en “Plantilla e historias”.</p>
              {v.slots.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 sm:grid-cols-[8rem_8rem_6rem_10rem_1fr_auto]">
                  <Select aria-label="Tipo" value={s.type_key} onChange={(e) => updSlot(i, { type_key: e.target.value })}>
                    {TYPE_OPTIONS.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Select aria-label="Día" value={s.weekday} onChange={(e) => updSlot(i, { weekday: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {weekdayLabel(d)}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Hora" type="time" value={s.time} onChange={(e) => updSlot(i, { time: e.target.value })} />
                  <Select aria-label="Frecuencia" value={s.recurrence} onChange={(e) => updSlot(i, { recurrence: e.target.value as typeof s.recurrence })}>
                    <option value="weekly">Todas las semanas</option>
                    <option value="biweekly">Cada 15 días</option>
                    <option value="monthly_first">1° del mes</option>
                    <option value="monthly_last">Último del mes</option>
                  </Select>
                  {s.recurrence === "biweekly" ? (
                    <Input aria-label="Fecha en la que toca" type="date" value={s.anchor_date ?? ""} onChange={(e) => updSlot(i, { anchor_date: e.target.value })} />
                  ) : (
                    <Input aria-label="Título" value={s.title_default ?? ""} onChange={(e) => updSlot(i, { title_default: e.target.value })} placeholder="Título por defecto (opcional)" />
                  )}
                  <Button variant="ghost" size="icon" aria-label="Quitar" onClick={() => setV({ ...v, slots: v.slots.filter((_, k) => k !== i) })}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setV({ ...v, slots: [...v.slots, { type_key: "post", weekday: 1, time: "19:00", recurrence: "weekly", anchor_date: null, title_default: null }] })}
              >
                <Plus /> Agregar publicación fija
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold">Servicios</p>
                <ul className="space-y-2">
                  {catalog.map((c) => {
                    const sel = v.services.find((x) => x.service_id === c.id);
                    return (
                      <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
                        <span className="min-w-[12rem] flex-1 text-sm">
                          <strong>{c.name}</strong>
                          <span className="block text-xs text-muted">
                            {formatMoney(c.default_price)} {BILLING_LABEL[c.billing]}
                          </span>
                        </span>
                        <Select
                          className="h-9 w-auto"
                          aria-label={`Estado de ${c.name}`}
                          value={sel?.status ?? ""}
                          onChange={(e) => {
                            const st = e.target.value as "activo" | "propuesto" | "";
                            const rest = v.services.filter((x) => x.service_id !== c.id);
                            setV({
                              ...v,
                              services: st ? [...rest, { service_id: c.id, price: sel?.price ?? Number(c.default_price), status: st, due_day: sel?.due_day ?? 10 }] : rest,
                            });
                          }}
                        >
                          <option value="">No</option>
                          <option value="activo">Contratado</option>
                          <option value="propuesto">Ofrecer</option>
                        </Select>
                        {sel && (
                          <>
                            <Input
                              className="h-9 w-28"
                              type="number"
                              aria-label="Precio"
                              value={sel.price}
                              onChange={(e) => setV({ ...v, services: v.services.map((x) => (x.service_id === c.id ? { ...x, price: Number(e.target.value) } : x)) })}
                            />
                            {c.billing === "mensual" && (
                              <Input
                                className="h-9 w-24"
                                type="number"
                                min={1}
                                max={28}
                                aria-label="Día de vencimiento"
                                title="Día de vencimiento"
                                value={sel.due_day ?? ""}
                                onChange={(e) =>
                                  setV({ ...v, services: v.services.map((x) => (x.service_id === c.id ? { ...x, due_day: e.target.value ? Number(e.target.value) : null } : x)) })
                                }
                              />
                            )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Personas del cliente con acceso</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@cliente.com" aria-label="Email" />
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nombre" aria-label="Nombre" />
                  <Button
                    variant="secondary"
                    disabled={!/^\S+@\S+\.\S+$/.test(inviteEmail)}
                    onClick={() => {
                      setV({ ...v, invites: [...v.invites, { email: inviteEmail.trim(), name: inviteName.trim() }] });
                      setInviteEmail("");
                      setInviteName("");
                    }}
                  >
                    <Plus /> Sumar
                  </Button>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {v.invites.map((i, k) => (
                    <li key={k} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-1">
                      {i.name ? `${i.name} · ` : ""}
                      {i.email}
                      <button className="text-muted hover:text-danger" onClick={() => setV({ ...v, invites: v.invites.filter((_, j) => j !== k) })} aria-label="Quitar">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft /> Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
            Siguiente <ArrowRight />
          </Button>
        ) : (
          <Button onClick={finish} disabled={pending}>
            <Check /> {pending ? "Creando…" : "Crear cliente"}
          </Button>
        )}
      </div>
    </div>
  );
}
