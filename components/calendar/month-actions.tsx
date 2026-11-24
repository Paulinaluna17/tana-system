"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Printer, Send, Sparkles, CopyPlus, Link2Off, RefreshCw, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Textarea } from "@/components/ui";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import {
  duplicatePrevMonth,
  generateMonth,
  rotateShareToken,
  saveMonthIntro,
  sendMonth,
  setMonthStatus,
} from "@/app/actions/content";
import type { Month } from "@/lib/types";
import { whatsappLink } from "@/lib/utils";

export function MonthActions({
  workspaceId,
  slug,
  year,
  month,
  monthRow,
  monthLabel,
  appUrl,
  whatsapp,
  hasItems,
}: {
  workspaceId: string;
  slug: string;
  year: number;
  month: number;
  monthRow: Month | null;
  monthLabel: string;
  appUrl: string;
  whatsapp: string | null;
  hasItems: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [withContent, setWithContent] = useState(true);
  const [promote, setPromote] = useState(true);
  const [intro, setIntro] = useState(monthRow?.intro ?? "");

  const run = (fn: () => Promise<{ error?: string; message?: string } | undefined>) =>
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        if (res?.message) toast.success(res.message);
        router.refresh();
      }
    });

  const shareUrl = monthRow?.share_token ? `${appUrl}/compartir/${monthRow.share_token}` : null;
  const portalUrl = `${appUrl}/portal/${slug}/calendario?y=${year}&m=${month}`;

  return (
    <div className="flex flex-wrap gap-2 no-print">
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => generateMonth(workspaceId, year, month))}>
        <Sparkles /> Generar mes desde plantilla
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">
            <CopyPlus /> Duplicar mes anterior
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Duplicar el mes anterior"
          description="Copia las piezas del mes anterior en el mismo día de la semana (ej.: 2° martes → 2° martes)."
        >
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={withContent} onChange={(e) => setWithContent(e.target.checked)} className="mt-1" />
            <span>
              Copiar también el contenido de las <strong>secciones recurrentes</strong> (historias de plantilla y series como
              “Testimonios reales”). El resto se copia vacío.
            </span>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => run(() => duplicatePrevMonth(workspaceId, year, month, withContent))}>Duplicar</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" disabled={!hasItems}>
            <Send /> {monthRow?.status === "borrador" || !monthRow ? "Enviar al cliente" : "Reenviar aviso"}
          </Button>
        </DialogTrigger>
        <DialogContent title={`Enviar ${monthLabel} al cliente`} description="El cliente recibe un aviso y ya puede ver el calendario en su portal.">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Mensaje del mes (opcional)</span>
              <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Objetivos del mes, foco, fechas especiales…" />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} className="mt-1" />
              <span>
                Pasar las piezas <strong>En redacción</strong> a <strong>Para que revises</strong>. (Las que están en “Idea” siguen
                ocultas.)
              </span>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                onClick={() =>
                  run(async () => {
                    if (monthRow && intro !== (monthRow.intro ?? "")) await saveMonthIntro(monthRow.id, intro);
                    const r = await sendMonth(workspaceId, year, month, promote);
                    if (!monthRow && intro && !r?.error) router.refresh();
                    return r;
                  })
                }
              >
                <Send /> Enviar
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {monthRow && monthRow.status !== "borrador" && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm">
              <Link2 /> Compartir
            </Button>
          </DialogTrigger>
          <DialogContent title="Compartir el calendario" description="Para mandar por WhatsApp o mail.">
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1 font-medium">Portal del cliente (con usuario)</p>
                <div className="flex gap-2">
                  <input readOnly value={portalUrl} className="h-9 flex-1 rounded-lg border border-line bg-bg px-2 text-xs" aria-label="Link al portal" />
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(portalUrl).then(() => toast.success("Copiado"))}>
                    <Copy />
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium">Link público de solo lectura (sin usuario)</p>
                {shareUrl ? (
                  <>
                    <div className="flex gap-2">
                      <input readOnly value={shareUrl} className="h-9 flex-1 rounded-lg border border-line bg-bg px-2 text-xs" aria-label="Link público" />
                      <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("Copiado"))}>
                        <Copy />
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a
                          href={whatsappLink(whatsapp, `¡Hola! Ya está el calendario de contenidos de ${monthLabel} 🗓️ Lo podés ver acá: ${shareUrl}`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle /> Mandar por WhatsApp
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(() => rotateShareToken(monthRow.id, false))}>
                        <RefreshCw /> Generar link nuevo
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(() => rotateShareToken(monthRow.id, true))}>
                        <Link2Off /> Desactivar
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => run(() => rotateShareToken(monthRow.id, false))}>
                    <Link2 /> Crear link público
                  </Button>
                )}
              </div>
              {monthRow.status === "aprobado" ? (
                <Button size="sm" variant="ghost" onClick={() => run(() => setMonthStatus(monthRow.id, "enviado"))}>
                  Reabrir mes para revisión
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => run(() => setMonthStatus(monthRow.id, "borrador"))}>
                  Volver a borrador (el cliente deja de verlo)
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Button asChild variant="secondary" size="sm">
        <a href={`/imprimir/${slug}/${year}/${month}`} target="_blank" rel="noreferrer">
          <Printer /> PDF
        </a>
      </Button>
    </div>
  );
}
