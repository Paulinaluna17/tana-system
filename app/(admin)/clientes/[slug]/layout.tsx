import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { TabLink } from "@/components/shell/nav-link";
import { LiveRefresh } from "@/components/shell/live-refresh";

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace: w } = await requireWorkspace(slug);
  const base = `/clientes/${slug}`;
  const tabs = [
    ["calendario", "Calendario"],
    ["plantilla", "Plantilla e historias"],
    ["ideas", "Ideas"],
    ["presupuesto", "Presupuesto y pagos"],
    ["brand", "Marca y ajustes"],
    ["usuarios", "Usuarios"],
    ["actividad", "Actividad"],
  ];
  return (
    <div>
      <LiveRefresh workspaceId={w.id} />
      <div className="mb-4 flex flex-wrap items-center gap-3 no-print">
        <span
          className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-line"
          style={{ background: w.brand.background }}
        >
          {w.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.logo_url} alt="" className="max-h-10 max-w-10 object-contain" />
          ) : (
            <span className="font-display text-xl" style={{ color: w.brand.primary }}>
              {w.name[0]}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted">
            <Link href="/clientes" className="hover:underline">
              Clientes
            </Link>
          </p>
          <h1 className="font-display text-2xl font-semibold leading-tight">{w.name}</h1>
        </div>
        <Link
          href={`/portal/${slug}`}
          className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm hover:bg-ink/5"
        >
          <ExternalLink className="size-4" /> Ver como cliente
        </Link>
      </div>
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line no-print" aria-label="Secciones del cliente">
        {tabs.map(([k, label]) => (
          <TabLink key={k} href={`${base}/${k}`}>
            {label}
          </TabLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
