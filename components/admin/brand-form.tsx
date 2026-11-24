"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input, Select, Textarea } from "@/components/ui";
import { archiveWorkspace, updateWorkspace, uploadLogo, type WorkspaceUpdate } from "@/app/actions/workspace";
import { FONT_OPTIONS, brandCssVars, googleFontsHref } from "@/lib/brand";
import { contrastRatio } from "@/lib/utils";
import type { Brand, Workspace } from "@/lib/types";

export function BrandPreview({ brand, logo, name }: { brand: Brand; logo: string | null; name: string }) {
  const ratio = contrastRatio(brand.text, brand.background);
  return (
    <div className="space-y-2">
      { }
      <link rel="stylesheet" href={googleFontsHref(brand)} />
      <div style={brandCssVars(brand)} data-theme={brand.theme} className="overflow-hidden rounded-2xl border border-line">
        <div className="flex items-center gap-3 border-b border-line bg-bg p-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-9 w-auto max-w-[6rem] object-contain" />
          ) : (
            <span className="font-display text-lg font-semibold text-ink">{name || "Marca"}</span>
          )}
        </div>
        <div className="space-y-2 bg-bg p-4 text-ink">
          <p className="font-display text-2xl font-semibold">¡Hola! Así se ve tu portal</p>
          <p className="text-sm text-muted">Texto secundario de ejemplo.</p>
          <div className="rounded-xl border border-line bg-surface p-3 text-sm">Tarjeta con información de una pieza.</div>
          <span className="inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-ink">Aprobar</span>
        </div>
      </div>
      <p className={`text-xs ${ratio < 4.5 ? "text-danger" : "text-muted"}`}>
        Contraste texto/fondo: {ratio.toFixed(1)}:1 {ratio < 4.5 ? "— bajo, puede costar leer (mínimo recomendado 4.5:1)" : "✓"}
      </p>
    </div>
  );
}

export function BrandFields({ brand, onChange }: { brand: Brand; onChange: (b: Brand) => void }) {
  const color = (k: keyof Brand, label: string) => (
    <Field label={label} htmlFor={`c-${k}`}>
      <div className="flex gap-2">
        <Input id={`c-${k}`} type="color" className="w-12 p-1" value={String(brand[k] ?? "#000000")} onChange={(e) => onChange({ ...brand, [k]: e.target.value })} />
        <Input aria-label={`${label} (hex)`} value={String(brand[k] ?? "")} onChange={(e) => onChange({ ...brand, [k]: e.target.value })} />
      </div>
    </Field>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {color("primary", "Color principal")}
      {color("secondary", "Color secundario")}
      {color("background", "Fondo")}
      {color("surface", "Tarjetas")}
      {color("text", "Texto")}
      {color("muted", "Texto secundario")}
      <Field label="Tipografía de textos" htmlFor="font">
        <Select id="font" value={brand.font} onChange={(e) => onChange({ ...brand, font: e.target.value })}>
          {FONT_OPTIONS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Select>
      </Field>
      <Field label="Tipografía de títulos" htmlFor="hfont">
        <Select id="hfont" value={brand.headingFont} onChange={(e) => onChange({ ...brand, headingFont: e.target.value })}>
          {FONT_OPTIONS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Select>
      </Field>
      <Field label="Tema" htmlFor="theme">
        <Select id="theme" value={brand.theme} onChange={(e) => onChange({ ...brand, theme: e.target.value as Brand["theme"] })}>
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </Select>
      </Field>
    </div>
  );
}

export function LogoUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-ink/5">
      <Upload className="size-4" /> {busy ? "Subiendo…" : "Subir logo"}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          const fd = new FormData();
          fd.append("file", f);
          const r = await uploadLogo(fd);
          setBusy(false);
          if (r.error) toast.error(r.error);
          else if (r.url) onUploaded(r.url);
        }}
      />
    </label>
  );
}

export function BrandForm({ workspace: w }: { workspace: Workspace }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<WorkspaceUpdate>({
    name: w.name,
    industry: w.industry,
    city: w.city,
    contact_name: w.contact_name,
    whatsapp: w.whatsapp,
    email: w.email,
    website: w.website,
    socials: w.socials ?? {},
    logo_url: w.logo_url,
    brand: { muted: w.brand.muted ?? "#6b7280", ...w.brand },
    production_mode: w.production_mode,
    approval_lead_days: w.approval_lead_days,
    revision_rounds: w.revision_rounds,
    material_deadline_day: w.material_deadline_day,
    how_to_read_md: w.how_to_read_md,
    calendar_note: w.calendar_note,
    brand_book: w.brand_book ?? {},
  });
  const bb = v.brand_book;
  const save = () =>
    start(async () => {
      const r = await updateWorkspace(w.id, v);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Guardado");
        router.refresh();
      }
    });
  const lines = (a?: string[]) => (a ?? []).join("\n");
  const split = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Nombre" htmlFor="n" className="col-span-2">
              <Input id="n" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field label="Rubro" htmlFor="ind">
              <Input id="ind" value={v.industry ?? ""} onChange={(e) => setV({ ...v, industry: e.target.value })} />
            </Field>
            <Field label="Ciudad" htmlFor="city">
              <Input id="city" value={v.city ?? ""} onChange={(e) => setV({ ...v, city: e.target.value })} />
            </Field>
            <Field label="Contacto" htmlFor="cn">
              <Input id="cn" value={v.contact_name ?? ""} onChange={(e) => setV({ ...v, contact_name: e.target.value })} />
            </Field>
            <Field label="WhatsApp (con código de país)" htmlFor="wa">
              <Input id="wa" value={v.whatsapp ?? ""} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} placeholder="5492346…" />
            </Field>
            <Field label="Email" htmlFor="em">
              <Input id="em" value={v.email ?? ""} onChange={(e) => setV({ ...v, email: e.target.value })} />
            </Field>
            <Field label="Web / tienda" htmlFor="web">
              <Input id="web" value={v.website ?? ""} onChange={(e) => setV({ ...v, website: e.target.value })} />
            </Field>
            <Field label="Instagram" htmlFor="ig">
              <Input id="ig" value={v.socials.instagram ?? ""} onChange={(e) => setV({ ...v, socials: { ...v.socials, instagram: e.target.value } })} />
            </Field>
            <Field label="TikTok" htmlFor="tt">
              <Input id="tt" value={v.socials.tiktok ?? ""} onChange={(e) => setV({ ...v, socials: { ...v.socials, tiktok: e.target.value } })} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Identidad visual del portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <LogoUpload onUploaded={(url) => setV({ ...v, logo_url: url })} />
              {v.logo_url && (
                <button className="text-xs text-muted underline" onClick={() => setV({ ...v, logo_url: null })}>
                  Quitar logo
                </button>
              )}
            </div>
            <BrandFields brand={v.brand as Brand} onChange={(b) => setV({ ...v, brand: b })} />
            <BrandPreview brand={v.brand as Brand} logo={v.logo_url} name={v.name} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="¿Quién produce?" htmlFor="pm">
            <Select id="pm" value={v.production_mode} onChange={(e) => setV({ ...v, production_mode: e.target.value as WorkspaceUpdate["production_mode"] })}>
              <option value="tana">Tana</option>
              <option value="cliente">El cliente (graba)</option>
              <option value="mixto">Mixto</option>
            </Select>
          </Field>
          <Field label="Días de anticipación para aprobar" htmlFor="lead">
            <Input id="lead" type="number" min={0} max={30} value={v.approval_lead_days} onChange={(e) => setV({ ...v, approval_lead_days: Number(e.target.value) })} />
          </Field>
          <Field label="Rondas de cambios incluidas" htmlFor="rr">
            <Input id="rr" type="number" min={0} max={10} value={v.revision_rounds} onChange={(e) => setV({ ...v, revision_rounds: Number(e.target.value) })} />
          </Field>
          <Field label="Día límite para mandar material" htmlFor="md">
            <Input
              id="md"
              type="number"
              min={1}
              max={28}
              value={v.material_deadline_day ?? ""}
              onChange={(e) => setV({ ...v, material_deadline_day: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Brand book</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Tono de voz" htmlFor="tone">
              <Textarea id="tone" className="min-h-[60px]" value={bb.tone ?? ""} onChange={(e) => setV({ ...v, brand_book: { ...bb, tone: e.target.value } })} />
            </Field>
            <Field label="Público" htmlFor="aud">
              <Textarea id="aud" className="min-h-[60px]" value={bb.audience ?? ""} onChange={(e) => setV({ ...v, brand_book: { ...bb, audience: e.target.value } })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Palabras a usar (una por línea)" htmlFor="use">
                <Textarea id="use" value={lines(bb.use_words)} onChange={(e) => setV({ ...v, brand_book: { ...bb, use_words: split(e.target.value) } })} />
              </Field>
              <Field label="Palabras a evitar" htmlFor="avoid">
                <Textarea id="avoid" value={lines(bb.avoid_words)} onChange={(e) => setV({ ...v, brand_book: { ...bb, avoid_words: split(e.target.value) } })} />
              </Field>
            </div>
            <Field label="Hashtags de marca" htmlFor="hash">
              <Input id="hash" value={bb.hashtags ?? ""} onChange={(e) => setV({ ...v, brand_book: { ...bb, hashtags: e.target.value } })} />
            </Field>
            <Field label="Links útiles (uno por línea)" htmlFor="links">
              <Textarea id="links" className="min-h-[60px]" value={lines(bb.links)} onChange={(e) => setV({ ...v, brand_book: { ...bb, links: split(e.target.value) } })} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>“Cómo leer este calendario”</CardTitle>
            <p className="text-sm text-muted">
              Lo ve el cliente en su portal. Formato simple: <code>### Título</code>, <code>- viñeta</code>, <code>**negrita**</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea className="min-h-[260px] font-mono text-xs" value={v.how_to_read_md ?? ""} onChange={(e) => setV({ ...v, how_to_read_md: e.target.value })} aria-label="Cómo leer este calendario" />
            <Field label="Nota al pie del calendario" htmlFor="note">
              <Input id="note" value={v.calendar_note ?? ""} onChange={(e) => setV({ ...v, calendar_note: e.target.value })} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <Button
          variant="ghost"
          onClick={() =>
            start(async () => {
              const r = await archiveWorkspace(w.id, !w.archived_at);
              if (r?.error) toast.error(r.error);
              else {
                toast.success(r?.message ?? "");
                router.refresh();
              }
            })
          }
        >
          <Archive /> {w.archived_at ? "Reactivar cliente" : "Archivar cliente"}
        </Button>
        <Button onClick={save} disabled={pending}>
          <Save /> {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
