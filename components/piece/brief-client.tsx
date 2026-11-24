"use client";
import { useState, useTransition } from "react";
import { Check, Copy, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { toggleShot } from "@/app/actions/content";
import type { ScriptBlock, ShotItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CopyButton({ text, label = "Copiar copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Copiado");
          setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Copiado" : label}
    </Button>
  );
}

export function ShotChecklist({
  itemId,
  shots,
  editable,
  large = false,
}: {
  itemId: string;
  shots: ShotItem[];
  editable: boolean;
  large?: boolean;
}) {
  const [state, setState] = useState(shots);
  const [, start] = useTransition();
  const done = state.filter((s) => s.done).length;
  return (
    <div>
      <p className={cn("mb-2 text-muted", large ? "text-base" : "text-xs")}>
        {done} de {state.length} tomas grabadas
      </p>
      <ul className="space-y-2">
        {state.map((s, i) => (
          <li key={i}>
            <label className={cn("flex items-start gap-3", editable && "cursor-pointer")}>
              <input
                type="checkbox"
                className={cn("mt-1 shrink-0 accent-[rgb(var(--accent))]", large ? "size-6" : "size-4")}
                checked={!!s.done}
                disabled={!editable}
                onChange={(e) => {
                  const val = e.target.checked;
                  setState((list) => list.map((x, k) => (k === i ? { ...x, done: val } : x)));
                  start(async () => {
                    const r = await toggleShot(itemId, i, val);
                    if (r?.error) {
                      toast.error(r.error);
                      setState((list) => list.map((x, k) => (k === i ? { ...x, done: !val } : x)));
                    }
                  });
                }}
              />
              <span className={cn(s.done && "text-muted line-through", large && "text-xl leading-snug")}>{s.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Modo grabación: pantalla completa, letra grande, guion y tomas tildables. */
export function RecordingMode({
  itemId,
  title,
  instructions,
  shots,
  script,
  canToggle,
}: {
  itemId: string;
  title: string;
  instructions: string | null;
  shots: ShotItem[];
  script: ScriptBlock[];
  canToggle: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!shots.length && !script.length && !instructions) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Maximize2 /> Modo grabación
      </Button>
      {open && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg p-5 text-ink" role="dialog" aria-modal="true" aria-label="Modo grabación">
          <div className="mx-auto max-w-2xl space-y-8 pb-16">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
              <Button variant="secondary" size="icon" onClick={() => setOpen(false)} aria-label="Cerrar modo grabación">
                <X />
              </Button>
            </div>
            {instructions && (
              <section>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-accent">Indicaciones</h3>
                <div className="space-y-2 whitespace-pre-line text-xl leading-relaxed">{instructions}</div>
              </section>
            )}
            {shots.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-accent">Tomas</h3>
                <ShotChecklist itemId={itemId} shots={shots} editable={canToggle} large />
              </section>
            )}
            {script.length > 0 && (
              <section className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-accent">Guion</h3>
                {script.map((b, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-sm font-semibold uppercase text-muted">
                      {b.section} {b.time && `· ${b.time}`}
                    </p>
                    {b.voice && <p className="whitespace-pre-line text-2xl leading-snug">{b.voice}</p>}
                    {b.on_screen && <p className="text-lg text-muted">En pantalla: {b.on_screen}</p>}
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
