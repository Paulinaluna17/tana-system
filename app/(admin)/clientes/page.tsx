import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import type { Workspace } from "@/lib/types";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("workspaces").select("*").order("archived_at", { nullsFirst: true }).order("name");
  const list = (data ?? []) as Workspace[];
  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cada cliente tiene su calendario, su presupuesto y su portal con su propia identidad."
        actions={
          <Button asChild>
            <Link href="/clientes/nuevo">
              <Plus /> Nuevo cliente
            </Link>
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="Todavía no hay clientes">Usá “Nuevo cliente” para sumar el primero.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <Link key={w.id} href={`/clientes/${w.slug}/calendario`} className="group">
              <Card className="overflow-hidden transition group-hover:border-accent/50">
                <div className="flex h-28 items-center justify-center" style={{ background: w.brand.background }}>
                  {w.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.logo_url} alt={`Logo de ${w.name}`} className="max-h-20 max-w-[70%] object-contain" />
                  ) : (
                    <span className="font-display text-3xl" style={{ color: w.brand.primary }}>
                      {w.name}
                    </span>
                  )}
                </div>
                <CardContent className="space-y-1">
                  <p className="font-display text-lg font-semibold">{w.name}</p>
                  <p className="text-sm text-muted">{[w.industry, w.city].filter(Boolean).join(" · ")}</p>
                  {w.archived_at && <p className="text-xs text-warn">Archivado</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
