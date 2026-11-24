"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, MessageCircle, Pencil, Plus, Receipt, Trash2, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  deleteWorkspaceService,
  generateInvoice,
  markInvoicePaid,
  reportPayment,
  saveInvoice,
  saveWorkspaceService,
  unmarkInvoicePaid,
  voidInvoice,
  type ServiceInput,
} from "@/app/actions/budget";
import { createClient } from "@/lib/supabase/client";
import type { InvoiceStatus } from "@/lib/status";
import type { Invoice, WorkspaceService } from "@/lib/types";
import { monthNameOnly } from "@/lib/dates";

function useRun() {
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

const METHODS = ["Transferencia", "Mercado Pago", "Efectivo", "Otro"];

export function ReportPaymentButton({ invoiceId, workspaceId }: { invoiceId: string; workspaceId: string }) {
  const { run } = useRun();
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!file) return toast.error("Adjuntá el comprobante");
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `${workspaceId}/${invoiceId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("receipts").upload(path, file);
      if (error) throw new Error("No se pudo subir el comprobante: " + error.message);
      run(() => reportPayment(invoiceId, path, method, note));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Algo salió mal");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Receipt /> Informar pago
        </Button>
      </DialogTrigger>
      <DialogContent title="Informar un pago" description="Subí el comprobante. Tana lo confirma y la cuota pasa a verde.">
        <div className="space-y-3">
          <Field label="Comprobante (imagen o PDF)" htmlFor="receipt">
            <input
              id="receipt"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-accent-ink"
            />
          </Field>
          <Field label="Medio de pago" htmlFor="method">
            <Select id="method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Comentario (opcional)" htmlFor="pnote">
            <Textarea id="pnote" className="min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={submit} disabled={busy || !file}>
              <Upload /> Enviar comprobante
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminInvoiceActions({
  invoice,
  status,
  whatsappHref,
}: {
  invoice: Invoice;
  status: InvoiceStatus;
  whatsappHref: string;
}) {
  const { pending, run } = useRun();
  const [method, setMethod] = useState(invoice.method ?? METHODS[0]);
  return (
    <>
      {!invoice.paid_at && status !== "anulada" && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="success" disabled={pending}>
              <CheckCircle2 /> {invoice.reported_at ? "Confirmar pago" : "Marcar pagado"}
            </Button>
          </DialogTrigger>
          <DialogContent title="Confirmar pago" description="La cuota pasa a verde y se le avisa al cliente.">
            <Field label="Medio de pago" htmlFor="m2">
              <Select id="m2" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <div className="mt-4 flex justify-end">
              <DialogClose asChild>
                <Button variant="success" onClick={() => run(() => markInvoicePaid(invoice.id, method))}>
                  Confirmar
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {invoice.paid_at && (
        <Button size="sm" variant="ghost" onClick={() => run(() => unmarkInvoicePaid(invoice.id))} disabled={pending}>
          <Undo2 /> Deshacer pago
        </Button>
      )}
      {!invoice.paid_at && status !== "anulada" && (
        <Button asChild size="sm" variant="secondary">
          <a href={whatsappHref} target="_blank" rel="noreferrer">
            <MessageCircle /> Recordatorio por WhatsApp
          </a>
        </Button>
      )}
      <InvoiceFormDialog workspaceId={invoice.workspace_id} invoice={invoice} />
      <Button size="sm" variant="ghost" onClick={() => run(() => voidInvoice(invoice.id, status !== "anulada"))} disabled={pending}>
        <Ban /> {status === "anulada" ? "Reactivar" : "Anular"}
      </Button>
    </>
  );
}

export function GenerateInvoiceButton({ workspaceId, year, month }: { workspaceId: string; year: number; month: number }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => generateInvoice(workspaceId, year, month))}>
      <Receipt /> Generar cuota de {monthNameOnly(month).toLowerCase()}
    </Button>
  );
}

export function InvoiceFormDialog({ workspaceId, invoice }: { workspaceId: string; invoice?: Invoice }) {
  const { run } = useRun();
  const [v, setV] = useState({
    period: invoice?.period ?? new Date().toISOString().slice(0, 8) + "01",
    description: invoice?.items.map((i) => i.name).join(" + ") ?? "",
    amount: String(invoice?.amount ?? ""),
    due_date: invoice?.due_date ?? "",
    payment_link: invoice?.payment_link ?? "",
    notes: invoice?.notes ?? "",
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={invoice ? "ghost" : "secondary"}>
          {invoice ? <Pencil /> : <Plus />} {invoice ? "Editar" : "Nueva cuota"}
        </Button>
      </DialogTrigger>
      <DialogContent title={invoice ? "Editar cuota" : "Nueva cuota"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Período (mes)" htmlFor="per">
            <Input id="per" type="month" value={v.period.slice(0, 7)} onChange={(e) => setV({ ...v, period: `${e.target.value}-01` })} />
          </Field>
          <Field label="Vence" htmlFor="due">
            <Input id="due" type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
          </Field>
          <Field label="Concepto" htmlFor="desc" className="col-span-2">
            <Input id="desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <Field label="Monto (ARS)" htmlFor="amt">
            <Input id="amt" type="number" min={0} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
          </Field>
          <Field label="Link de pago (opcional)" htmlFor="plink">
            <Input id="plink" value={v.payment_link} onChange={(e) => setV({ ...v, payment_link: e.target.value })} />
          </Field>
          <Field label="Notas" htmlFor="inotes" className="col-span-2">
            <Textarea id="inotes" className="min-h-[60px]" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button
              disabled={!v.amount || !v.due_date}
              onClick={() =>
                run(() =>
                  saveInvoice({
                    id: invoice?.id,
                    workspace_id: workspaceId,
                    period: v.period,
                    description: v.description,
                    amount: Number(v.amount),
                    due_date: v.due_date,
                    payment_link: v.payment_link || null,
                    notes: v.notes || null,
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

type CatalogItem = { id: string; name: string; description: string | null; includes: string[]; excludes: string[]; default_price: number; billing: string };

export function ServiceFormDialog({
  workspaceId,
  catalog,
  service,
}: {
  workspaceId: string;
  catalog: CatalogItem[];
  service?: WorkspaceService;
}) {
  const { run } = useRun();
  const empty: ServiceInput = {
    workspace_id: workspaceId,
    service_id: null,
    custom_name: "",
    description: "",
    includes: [],
    excludes: [],
    price: 0,
    currency: "ARS",
    billing: "mensual",
    status: "activo",
    start_date: null,
    end_date: null,
    due_day: 10,
    conditions: "",
  };
  const [v, setV] = useState<ServiceInput>(
    service
      ? {
          id: service.id,
          workspace_id: service.workspace_id,
          service_id: service.service_id,
          custom_name: service.custom_name ?? service.services?.name ?? "",
          description: service.description ?? "",
          includes: service.includes,
          excludes: service.excludes,
          price: Number(service.price),
          currency: service.currency,
          billing: service.billing,
          status: service.status,
          start_date: service.start_date,
          end_date: service.end_date,
          due_day: service.due_day,
          conditions: service.conditions ?? "",
        }
      : empty,
  );
  const pickCatalog = (id: string) => {
    const c = catalog.find((x) => x.id === id);
    if (!c) return setV({ ...v, service_id: null });
    setV({
      ...v,
      service_id: c.id,
      custom_name: c.name,
      description: c.description ?? "",
      includes: c.includes,
      excludes: c.excludes,
      price: Number(c.default_price),
      billing: c.billing as ServiceInput["billing"],
    });
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant={service ? "ghost" : "secondary"}>
          {service ? <Pencil /> : <Plus />} {service ? "Editar" : "Agregar servicio"}
        </Button>
      </DialogTrigger>
      <DialogContent title={service ? "Editar servicio" : "Agregar servicio"} className="max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          {!service && (
            <Field label="Desde el catálogo de Tana" htmlFor="cat" className="col-span-2">
              <Select id="cat" value={v.service_id ?? ""} onChange={(e) => pickCatalog(e.target.value)}>
                <option value="">— Servicio a medida —</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Nombre" htmlFor="sname" className="col-span-2">
            <Input id="sname" value={v.custom_name ?? ""} onChange={(e) => setV({ ...v, custom_name: e.target.value })} />
          </Field>
          <Field label="Descripción" htmlFor="sdesc" className="col-span-2">
            <Textarea id="sdesc" className="min-h-[60px]" value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <Field label="Qué incluye (uno por línea)" htmlFor="sinc">
            <Textarea id="sinc" value={v.includes.join("\n")} onChange={(e) => setV({ ...v, includes: e.target.value.split("\n") })} />
          </Field>
          <Field label="Qué NO incluye (uno por línea)" htmlFor="sexc">
            <Textarea id="sexc" value={v.excludes.join("\n")} onChange={(e) => setV({ ...v, excludes: e.target.value.split("\n") })} />
          </Field>
          <Field label="Precio (ARS)" htmlFor="sprice">
            <Input id="sprice" type="number" min={0} value={v.price} onChange={(e) => setV({ ...v, price: Number(e.target.value) })} />
          </Field>
          <Field label="Modalidad" htmlFor="sbill">
            <Select id="sbill" value={v.billing} onChange={(e) => setV({ ...v, billing: e.target.value as ServiceInput["billing"] })}>
              <option value="mensual">Mensual</option>
              <option value="unico">Pago único</option>
              <option value="por_pieza">Por pieza</option>
            </Select>
          </Field>
          <Field label="Estado" htmlFor="sstatus">
            <Select id="sstatus" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as ServiceInput["status"] })}>
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="inactivo">Inactivo</option>
              <option value="propuesto">Disponible para sumar</option>
            </Select>
          </Field>
          <Field label="Día de vencimiento (1–28)" htmlFor="sdue">
            <Input
              id="sdue"
              type="number"
              min={1}
              max={28}
              value={v.due_day ?? ""}
              onChange={(e) => setV({ ...v, due_day: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Inicio" htmlFor="sstart">
            <Input id="sstart" type="date" value={v.start_date ?? ""} onChange={(e) => setV({ ...v, start_date: e.target.value || null })} />
          </Field>
          <Field label="Fin (opcional)" htmlFor="send">
            <Input id="send" type="date" value={v.end_date ?? ""} onChange={(e) => setV({ ...v, end_date: e.target.value || null })} />
          </Field>
          <Field label="Condiciones (ajustes de precio, etc.)" htmlFor="scond" className="col-span-2">
            <Textarea id="scond" className="min-h-[60px]" value={v.conditions ?? ""} onChange={(e) => setV({ ...v, conditions: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          {service ? (
            <DialogClose asChild>
              <Button variant="ghost" className="text-danger" onClick={() => run(() => deleteWorkspaceService(service.id))}>
                <Trash2 /> Quitar
              </Button>
            </DialogClose>
          ) : (
            <span />
          )}
          <DialogClose asChild>
            <Button onClick={() => run(() => saveWorkspaceService(v))} disabled={!v.custom_name?.trim()}>
              Guardar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
