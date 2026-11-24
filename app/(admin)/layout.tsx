import Link from "next/link";
import { Home, Users, Briefcase, LogOut, UserCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { NavLink } from "@/components/shell/nav-link";
import { NotificationBell } from "@/components/shell/bell";
import { signOut } from "@/app/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link href="/inicio" className="mr-2 flex shrink-0 items-center" aria-label="Tana Studio · Inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/tana-logo.png" alt="Tana Studio" className="h-9 w-auto" />
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Principal">
            <NavLink href="/inicio">
              <Home /> <span className="hidden sm:inline">Inicio</span>
            </NavLink>
            <NavLink href="/clientes">
              <Users /> <span className="hidden sm:inline">Clientes</span>
            </NavLink>
            <NavLink href="/servicios">
              <Briefcase /> <span className="hidden sm:inline">Servicios</span>
            </NavLink>
          </nav>
          <NotificationBell />
          <Link href="/perfil" className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-ink/5" aria-label={`Perfil de ${s.profile.full_name ?? s.email}`}>
            <UserCircle className="size-5" />
          </Link>
          <form action={signOut}>
            <button className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-ink/5" aria-label="Salir">
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
