"use client";
import { useActionState, useState } from "react";
import { Mail, KeyRound } from "lucide-react";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";
import { sendMagicLink, signInWithPassword, type AuthState } from "@/app/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState<AuthState, FormData>(sendMagicLink, {});
  const [pwState, pwAction, pwPending] = useActionState<AuthState, FormData>(signInWithPassword, {});

  return (
    <Card>
      <CardContent className="space-y-4">
        {mode === "link" ? (
          linkState.ok ? (
            <div className="space-y-2 text-center" role="status">
              <Mail className="mx-auto size-8 text-accent" />
              <p className="font-medium">¡Listo! Revisá tu email</p>
              <p className="text-sm text-muted">{linkState.message}</p>
            </div>
          ) : (
            <form action={linkAction} className="space-y-3">
              <input type="hidden" name="next" value={next} />
              <Field label="Tu email" htmlFor="email">
                <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vos@ejemplo.com" />
              </Field>
              {linkState.error && <p className="text-sm text-danger">{linkState.error}</p>}
              <Button className="w-full" size="lg" disabled={linkPending}>
                <Mail /> {linkPending ? "Enviando…" : "Enviame el link para entrar"}
              </Button>
              <p className="text-center text-xs text-muted">Sin contraseña: te mandamos un link a tu email.</p>
            </form>
          )
        ) : (
          <form action={pwAction} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <Field label="Email" htmlFor="email-pw">
              <Input id="email-pw" name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Contraseña" htmlFor="password">
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </Field>
            {pwState.error && (
              <p className="text-sm text-danger" role="alert">
                {pwState.error}
              </p>
            )}
            <Button className="w-full" size="lg" disabled={pwPending}>
              <KeyRound /> {pwPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        )}
        <button
          type="button"
          className="w-full text-center text-xs text-muted underline-offset-2 hover:underline"
          onClick={() => setMode(mode === "link" ? "password" : "link")}
        >
          {mode === "link" ? "Equipo de Tana: entrar con contraseña" : "Volver a entrar con link por email"}
        </button>
      </CardContent>
    </Card>
  );
}
