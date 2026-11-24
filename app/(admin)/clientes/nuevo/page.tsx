import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ClientWizard } from "@/components/admin/wizard";
import type { Service } from "@/lib/types";

export const metadata = { title: "Nuevo cliente" };

export default async function NuevoCliente() {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("active", true).order("name");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo cliente" subtitle="En 5 pasos queda listo para planificar y con su portal personalizado." />
      <ClientWizard catalog={(data ?? []) as Service[]} />
    </div>
  );
}
