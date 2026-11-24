import { requireWorkspace } from "@/lib/auth";
import { BudgetView, loadBudget } from "@/components/budget/budget-view";

export default async function AdminPresupuesto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const data = await loadBudget(supabase, w.id);
  return <BudgetView workspace={w} data={data} mode="admin" canReport={false} />;
}
