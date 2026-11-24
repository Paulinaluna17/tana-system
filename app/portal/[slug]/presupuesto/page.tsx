import { requireWorkspace } from "@/lib/auth";
import { BudgetView, loadBudget } from "@/components/budget/budget-view";

export default async function PortalPresupuesto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase, role } = await requireWorkspace(slug);
  const data = await loadBudget(supabase, w.id);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">Presupuesto y pagos</h1>
        <p className="text-sm text-muted">Qué servicios tenés contratados, qué incluyen y cuándo toca pagar.</p>
      </div>
      <BudgetView workspace={w} data={data} mode="client" canReport={role === "client_editor" || role === "admin"} />
    </div>
  );
}
