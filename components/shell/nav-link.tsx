"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  exact = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition [&_svg]:size-4",
        active ? "bg-accent text-accent-ink" : "text-muted hover:bg-ink/5 hover:text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
        active ? "border-accent font-semibold text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
