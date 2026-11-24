import { requireWorkspace } from "@/lib/auth";
import { BudgetView, loadBudget } from "@/components/budget/budget-view";
import { PrintButton } from "@/components/misc/print-button";
import { formatDateKeyLong, todayKey } from "@/lib/dates";

export const metadata = { title: "Presupuesto" };

export default async function PrintBudget({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workspace: w, supabase } = await requireWorkspace(slug);
  const data = await loadBudget(supabase, w.id);
  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-ink">
      <PrintButton />
      <header className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="font-display text-3xl font-semibold">Tana</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted">Studio</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold">Resumen de servicios y pagos</p>
          <p className="text-sm text-muted">
            {w.name} · {formatDateKeyLong(todayKey())}
          </p>
        </div>
        {w.logo_url && (
          <span className="flex h-14 w-20 items-center justify-center rounded-lg p-1" style={{ background: w.brand.background }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.logo_url} alt={w.name} className="max-h-12 max-w-full object-contain" />
          </span>
        )}
      </header>
      <BudgetView workspace={w} data={data} mode="client" canReport={false} />
    </div>
  );
}
