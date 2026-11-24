import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Inbox,
  Lightbulb,
  MessageSquareWarning,
  PenLine,
  Replace,
  Rocket,
  Scissors,
  Sparkles,
  Video,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { INVOICE_META, SERVICE_STATUS_META, STATUS_META, type InvoiceStatus } from "@/lib/status";
import type { ContentStatus } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  Lightbulb,
  PenLine,
  Eye,
  MessageSquareWarning,
  CheckCircle2,
  Video,
  Inbox,
  Scissors,
  Rocket,
  BadgeCheck,
  Ban,
  Replace,
  Clock,
  AlertTriangle,
  Circle,
  XCircle,
};

export function StatusBadge({ status, client = false }: { status: ContentStatus; client?: boolean }) {
  const m = STATUS_META[status];
  const Icon = ICONS[m.icon] ?? Circle;
  return (
    <Badge tone={m.tone} title={m.help}>
      <Icon aria-hidden /> {client ? m.clientLabel : m.label}
    </Badge>
  );
}

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  const m = INVOICE_META[status];
  const Icon = ICONS[m.icon] ?? Circle;
  return (
    <Badge tone={m.tone} title={m.help} className="text-[13px]">
      <Icon aria-hidden /> {m.label}
    </Badge>
  );
}

export function ServiceStatusBadge({ status }: { status: string }) {
  const m = SERVICE_STATUS_META[status];
  return (
    <Badge tone={m.tone} title={m.help}>
      {status === "activo" ? <CheckCircle2 aria-hidden /> : status === "propuesto" ? <Sparkles aria-hidden /> : <Circle aria-hidden />}
      {m.label}
    </Badge>
  );
}

export function UpdatedBadge() {
  return (
    <Badge tone="accent" title="Tana cambió esta pieza hace poco">
      <Sparkles aria-hidden /> Actualizado
    </Badge>
  );
}

export function LateBadge() {
  return (
    <Badge tone="danger" title="La fecha ya pasó y la pieza no está publicada">
      <AlertTriangle aria-hidden /> Atrasada
    </Badge>
  );
}

export function UrgentBadge() {
  return (
    <Badge tone="warn" title="Faltan pocos días para publicarse y todavía no está aprobada">
      <Clock aria-hidden /> Aprobación urgente
    </Badge>
  );
}
