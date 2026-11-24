import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession, homeFor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeShort } from "@/lib/dates";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui";
import { MarkAllRead } from "@/components/misc/notif-actions";
import type { NotificationRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notificaciones" };

export default async function Notificaciones({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const s = await requireSession();
  const { ws } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as NotificationRow[];
  const back = ws && s.memberships.some((m) => m.slug === ws) ? `/portal/${ws}` : homeFor(s);
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <PageHeader title="Notificaciones" actions={rows.some((r) => !r.read_at) ? <MarkAllRead /> : undefined} />
      {rows.length === 0 ? (
        <EmptyState title="No tenés notificaciones" />
      ) : (
        <Card>
          <CardContent className="p-2 sm:p-2">
            <ul className="divide-y divide-line">
              {rows.map((n) => {
                const link = !s.isAdmin && n.link?.startsWith("/clientes") ? null : n.link;
                const body = (
                  <div className={cn("rounded-xl p-3", !n.read_at && "bg-accent/5")}>
                    <p className="text-sm font-medium">
                      {!n.read_at && <span className="mr-1.5 inline-block size-2 rounded-full bg-accent" aria-label="Sin leer" />}
                      {n.title}
                    </p>
                    {n.body && <p className="text-sm text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted">{formatDateTimeShort(n.created_at)}</p>
                  </div>
                );
                return <li key={n.id}>{link ? <Link href={link} className="block hover:bg-ink/[0.03]">{body}</Link> : body}</li>;
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
