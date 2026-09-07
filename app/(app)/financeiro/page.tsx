import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { NewExpenseForm } from "./NewExpenseForm";
import Link from "next/link";

export default async function FinanceiroPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const supabase = await createClient();

  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(companyId))) {
    return (
      <div>
        <PageHeader title="Financeiro" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const { data: entries } = await supabase
    .from("financial_entry")
    .select("id, type, category, description, amount, entry_date, supplier")
    .eq("company_id", companyId)
    .order("entry_date", { ascending: false })
    .limit(80);

  const income = (entries ?? []).filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = (entries ?? []).filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas, compras e estornos — cada lançamento com origem e categoria."
        action={
          <Link href="/vendas" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
            Ver vendas
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-label uppercase text-muted">Receitas</p>
          <p className="text-section-title text-success mt-1 tabular-nums">{formatCurrency(income)}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-label uppercase text-muted">Despesas</p>
          <p className="text-section-title text-danger mt-1 tabular-nums">{formatCurrency(expense)}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-label uppercase text-muted">Resultado</p>
          <p className="text-section-title text-foreground mt-1 tabular-nums">
            {formatCurrency(income - expense)}
          </p>
        </div>
      </div>

      <NewExpenseForm companyId={companyId} />

      <section>
        <h2 className="text-section-title text-foreground mb-3">Lançamentos</h2>
        <Surface>
          {entries && entries.length > 0 ? (
            entries.map((entry) => (
              <SurfaceRow key={entry.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body-sm font-medium text-foreground">
                    {entry.category}
                    {entry.supplier ? ` · ${entry.supplier}` : ""}
                  </p>
                  <p className="text-caption text-muted mt-0.5">
                    {new Date(entry.entry_date).toLocaleDateString("pt-BR")}
                    {entry.description ? ` · ${entry.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={entry.type === "income" ? "success" : "danger"}>
                    {entry.type === "income" ? "receita" : "despesa"}
                  </Badge>
                  <span className="text-body-sm tabular-nums text-foreground">
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              </SurfaceRow>
            ))
          ) : (
            <EmptyState
              title="Nenhum lançamento ainda"
              description="Pagamentos de venda entram automaticamente aqui. Lance despesas manualmente acima."
            />
          )}
        </Surface>
      </section>
    </div>
  );
}
