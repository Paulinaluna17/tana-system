"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { markNotificationsRead } from "@/app/actions/workspace";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}>
      <CheckCheck /> Marcar todo como leído
    </Button>
  );
}
