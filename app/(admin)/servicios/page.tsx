import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Badge } from "@/components/ui";
import { CatalogServiceDialog } from "@/components/admin/settings-client";
import { BILLING_LABEL } from "@/lib/status";
import type { Service } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Servicios" };

export default async function Servicios() {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").order("active", { ascending: false }).order("name");
  const list = (data ?? []) as Service[];
  return (
    <div>
      <PageHeader
        title="Catálogo de servicios"
        subtitle="Lo que ofrece Tana. Al sumarlo a un cliente podés ajustar precio, qué incluye y condiciones."
        actions={<CatalogServiceDialog />}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <Card key={s.id} className={s.active ? "" : "opacity-60"}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{s.name}</CardTitle>
                {!s.active && <Badge tone="muted">No se ofrece</Badge>}
              </div>
              <p className="font-semibold">
                {formatMoney(s.default_price)} <span className="text-sm font-normal text-muted">{BILLING_LABEL[s.billing]}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {s.description && <p>{s.description}</p>}
              <ul className="space-y-1">
                {s.includes.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {x}
                  </li>
                ))}
                {s.excludes.map((x) => (
                  <li key={x} className="flex gap-2 text-muted">
                    <X className="mt-0.5 size-4 shrink-0" /> {x}
                  </li>
                ))}
              </ul>
              <CatalogServiceDialog service={s} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
