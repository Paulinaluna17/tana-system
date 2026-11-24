"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/** Cambiar la contraseña propia (sirve para entrar sin depender del mail). */
export function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = pw.length >= 8 && pw === pw2;
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <p className="text-sm text-muted">Mínimo 8 caracteres. Después podés entrar con “entrar con contraseña”.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Nueva contraseña" htmlFor="pw1">
          <Input id="pw1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Repetila" htmlFor="pw2">
          <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        {pw2 && pw !== pw2 && <p className="text-sm text-danger">Las contraseñas no coinciden.</p>}
        <Button
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            const { error } = await createClient().auth.updateUser({ password: pw });
            setBusy(false);
            if (error) toast.error(error.message);
            else {
              toast.success("Contraseña actualizada");
              setPw("");
              setPw2("");
            }
          }}
        >
          <KeyRound /> Guardar contraseña
        </Button>
      </CardContent>
    </Card>
  );
}
