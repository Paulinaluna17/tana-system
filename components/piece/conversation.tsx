"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Textarea } from "@/components/ui";
import { addComment } from "@/app/actions/content";
import { formatDateTimeShort } from "@/lib/dates";
import { cn, initials } from "@/lib/utils";

export interface CommentView {
  id: string;
  body: string;
  is_internal: boolean;
  kind: string;
  created_at: string;
  author_name: string;
  author_is_tana: boolean;
}

const KIND_LABEL: Record<string, string> = {
  change_request: "Pidió cambios",
  approval: "Aprobó",
  material: "Mandó material",
};

export function Conversation({
  itemId,
  comments,
  isAdmin,
  canComment,
}: {
  itemId: string;
  comments: CommentView[];
  isAdmin: boolean;
  canComment: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const r = await addComment(itemId, text, internal);
      if (r?.error) toast.error(r.error);
      else {
        setText("");
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay comentarios.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className={cn("flex gap-2", c.is_internal && "rounded-xl border border-dashed border-ink/30 bg-ink/[0.04] p-2")}>
              <span
                className={cn(
                  "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  c.author_is_tana ? "bg-accent text-accent-ink" : "bg-ink/10",
                )}
                aria-hidden
              >
                {initials(c.author_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  <strong className="text-ink">{c.author_name}</strong>
                  {c.author_is_tana && " · Tana"} · {formatDateTimeShort(c.created_at)}
                  {KIND_LABEL[c.kind] && <span className="ml-1 rounded bg-ink/5 px-1">{KIND_LABEL[c.kind]}</span>}
                  {c.is_internal && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-ink">
                      <Lock className="size-3" /> interno
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-line text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <div className="space-y-2">
          <Textarea
            aria-label="Escribí un comentario"
            placeholder={isAdmin ? "Escribile al cliente…" : "Escribí tu comentario o duda…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[70px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isAdmin ? (
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                <Lock className="size-3" /> Nota interna (el cliente no la ve)
              </label>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={submit} disabled={pending || !text.trim()}>
              <Send /> Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
