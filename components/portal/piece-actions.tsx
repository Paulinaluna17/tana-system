"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareWarning, Upload, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea } from "@/components/ui";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { approveItem, markMaterialSent, requestChanges } from "@/app/actions/content";
import { createClient } from "@/lib/supabase/client";
import type { ContentStatus } from "@/lib/types";

export function ClientPieceActions({
  itemId,
  workspaceId,
  status,
  canAct,
  revisionCount,
  includedRounds,
  needsMaterial,
}: {
  itemId: string;
  workspaceId: string;
  status: ContentStatus;
  canAct: boolean;
  revisionCount: number;
  includedRounds: number;
  needsMaterial: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [matNote, setMatNote] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!canAct) return null;
  const awaiting = status === "para_revisar" || status === "cambios_solicitados";
  const canRequest = !["publicado", "cancelado", "reemplazado"].includes(status);
  const nextRound = revisionCount + 1;

  const done = (msg: string) => (r: { error?: string } | undefined) => {
    if (r?.error) toast.error(r.error);
    else {
      toast.success(msg);
      router.refresh();
    }
  };

  const sendMaterial = async () => {
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tenés que entrar de nuevo");
      for (const f of Array.from(files ?? [])) {
        const path = `${workspaceId}/${itemId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("assets").upload(path, f, { upsert: false });
        if (error) throw new Error(`No se pudo subir ${f.name}: ${error.message}`);
        const { error: e2 } = await supabase.from("assets").insert({
          workspace_id: workspaceId,
          content_item_id: itemId,
          uploaded_by: user.id,
          storage_path: path,
          file_name: f.name,
          kind: "material",
        });
        if (e2) throw new Error(e2.message);
      }
      if (link.trim()) {
        const { error } = await supabase.from("assets").insert({
          workspace_id: workspaceId,
          content_item_id: itemId,
          uploaded_by: user.id,
          external_url: link.trim(),
          file_name: link.trim(),
          kind: "material",
        });
        if (error) throw new Error("Revisá el link");
      }
      const r = await markMaterialSent(itemId, matNote);
      done("¡Gracias! Le avisamos a Tana que mandaste el material.")(r);
      setFiles(null);
      setLink("");
      setMatNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Algo salió mal");
    } finally {
      setUploading(false);
    }
  };

  if (!awaiting && !needsMaterial && !canRequest) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center">
      {awaiting && (
        <Button
          size="lg"
          variant="success"
          disabled={pending}
          onClick={() => start(async () => done("¡Aprobada! Gracias 🙌")(await approveItem(itemId)))}
        >
          <CheckCircle2 /> Aprobar
        </Button>
      )}
      {canRequest && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" variant="secondary" disabled={pending}>
              <MessageSquareWarning /> Pedir cambios
            </Button>
          </DialogTrigger>
          <DialogContent title="¿Qué querés cambiar?" description="Contanos con detalle así Tana lo ajusta. Te avisamos cuando esté lista.">
            <Textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: Preferimos grabarlo con otro profe; cambiar la frase final por…"
              aria-label="Cambios que querés"
            />
            {nextRound > includedRounds && (
              <p className="mt-2 rounded-lg bg-warn/10 p-2 text-sm text-warn">
                Esta pieza ya tuvo {revisionCount} {revisionCount === 1 ? "ronda" : "rondas"} de cambios ({includedRounds} incluidas). Las rondas
                adicionales pueden tener costo.
              </p>
            )}
            <p className="mt-2 text-xs text-muted">
              Ronda {nextRound} de {includedRounds} incluidas.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  disabled={note.trim().length < 3}
                  onClick={() =>
                    start(async () => {
                      done("Listo, Tana ya recibió tu pedido.")(await requestChanges(itemId, note));
                      setNote("");
                    })
                  }
                >
                  Enviar pedido
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {needsMaterial && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" variant="secondary">
              <Upload /> Mandar material
            </Button>
          </DialogTrigger>
          <DialogContent title="Mandar material" description="Subí los archivos o pegá un link de Google Drive / WeTransfer.">
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-accent-ink"
                aria-label="Archivos"
              />
              <label className="block text-sm">
                <span className="mb-1 flex items-center gap-1 font-medium">
                  <Link2 className="size-4" /> o un link
                </span>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
              </label>
              <Textarea value={matNote} onChange={(e) => setMatNote(e.target.value)} placeholder="Comentario (opcional)" className="min-h-[60px]" />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={sendMaterial} disabled={uploading}>
                  <Upload /> {uploading ? "Subiendo…" : "Enviar"}
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {awaiting && <p className="text-xs text-muted sm:ml-auto">¿Dudas? Dejá un comentario abajo.</p>}
    </div>
  );
}
