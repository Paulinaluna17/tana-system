"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { approveMonth } from "@/app/actions/content";

export function ApproveMonthButton({ monthId, label }: { monthId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={pending}>
          <CheckCheck /> Aprobar todo el mes
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`¿Aprobar todo ${label.toLowerCase()}?`}
        description="Se aprueban todas las piezas que estaban para revisar. Igual vas a poder comentar cualquier pieza después."
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              onClick={() =>
                start(async () => {
                  const r = await approveMonth(monthId);
                  if (r?.error) toast.error(r.error);
                  else {
                    toast.success("¡Mes aprobado! Gracias 🙌");
                    router.refresh();
                  }
                })
              }
            >
              <CheckCheck /> Sí, aprobar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
