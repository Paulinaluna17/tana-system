import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function NotificationBell({ href = "/notificaciones" }: { href?: string }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const n = count ?? 0;
  return (
    <Link
      href={href}
      className="relative inline-flex size-10 items-center justify-center rounded-xl hover:bg-ink/5"
      aria-label={n ? `Notificaciones: ${n} sin leer` : "Notificaciones"}
    >
      <Bell className="size-5" />
      {n > 0 && (
        <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
