"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex gap-2">
      <Button size="lg" onClick={() => window.print()}>
        <Printer /> Guardar como PDF / imprimir
      </Button>
    </div>
  );
}
