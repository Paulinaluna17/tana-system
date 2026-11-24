"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Escucha cambios en tiempo real (Supabase Realtime, respeta RLS) y refresca la pantalla.
 * Así el cliente ve al instante lo que Tana cambia (y viceversa).
 */
export function LiveRefresh({ workspaceId, tables = ["content_items", "comments", "invoices"] }: { workspaceId?: string; tables?: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-${workspaceId ?? "all"}-${Math.random().toString(36).slice(2)}`);
    const onChange = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}) },
        onChange,
      );
    }
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, onChange);
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router, workspaceId, tables]);
  return null;
}
