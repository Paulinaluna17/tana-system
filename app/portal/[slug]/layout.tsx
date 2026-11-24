import Link from "next/link";
import { CalendarDays, Home, LogOut, Receipt, Sparkles, BookOpen, ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { brandCssVars, googleFontsHref } from "@/lib/brand";
import { NavLink } from "@/components/shell/nav-link";
import { NotificationBell } from "@/components/shell/bell";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { signOut } from "@/app/actions/auth";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug === "roma" ? "Roma" : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace: w, role, session } = await requireWorkspace(slug);
  const base = `/portal/${slug}`;
  return (
    <div style={brandCssVars(w.brand)} data-theme={w.brand.theme} className="min-h-screen bg-bg text-ink">
      { }
      <link rel="stylesheet" href={googleFontsHref(w.brand)} />
      <LiveRefresh workspaceId={w.id} />
      {role === "admin" && (
        <div className="bg-ink px-4 py-1.5 text-center text-xs text-bg no-print">
          Estás viendo el portal como lo ve el cliente.{" "}
          <Link href={`/clientes/${slug}/calendario`} className="inline-flex items-center gap-1 underline">
            <ArrowLeft className="size-3" /> Volver al panel de Tana
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur no-print">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <Link href={base} className="flex shrink-0 items-center gap-2" aria-label={`Inicio de ${w.name}`}>
            {w.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.logo_url} alt={w.name} className="h-10 w-auto max-w-[7rem] object-contain" />
            ) : (
              <span className="font-display text-xl font-semibold">{w.name}</span>
            )}
          </Link>
          <span className="flex-1" />
          <NotificationBell href={`/notificaciones?ws=${slug}`} />
          {session && (
            <form action={signOut}>
              <button className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-ink/5" aria-label="Salir">
                <LogOut className="size-5" />
              </button>
            </form>
          )}
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Secciones">
          <NavLink href={base} exact>
            <Home /> Inicio
          </NavLink>
          <NavLink href={`${base}/calendario`}>
            <CalendarDays /> Calendario
          </NavLink>
          <NavLink href={`${base}/presupuesto`}>
            <Receipt /> Presupuesto
          </NavLink>
          <NavLink href={`${base}/novedades`}>
            <Sparkles /> Novedades
          </NavLink>
          <NavLink href={`${base}/guia`}>
            <BookOpen /> Cómo leerlo
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="pb-8 text-center text-xs text-muted no-print">Hecho por Tana Studio</footer>
    </div>
  );
}
