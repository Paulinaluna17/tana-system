"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";
import { updateMyProfile } from "@/app/actions/workspace";

export function ProfileForm({ initial }: { initial: { full_name: string; notify_email: boolean; weekly_digest: boolean } }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardContent className="space-y-4">
        <Field label="Nombre" htmlFor="pf-name">
          <Input id="pf-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.notify_email} onChange={(e) => setV({ ...v, notify_email: e.target.checked })} />
          Recibir avisos por email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.weekly_digest} onChange={(e) => setV({ ...v, weekly_digest: e.target.checked })} />
          Resumen semanal los lunes (“Esta semana en tu calendario”)
        </label>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateMyProfile(v);
              if (r?.error) toast.error(r.error);
              else toast.success("Guardado");
            })
          }
        >
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
