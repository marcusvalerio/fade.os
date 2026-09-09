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

  const [{ data: entries }, { data: transfers }] = await Promise.all([
    supabase
      .from("financial_entry")
      .select("id, type, category, description, amount, entry_date, supplier")
      .eq("company_id", companyId)
      .order("entry_date", { ascending: false })
      .limit(80),
    // Sangria e suprimento não são receita nem despesa: é dinheiro trocando
    // de lugar (gaveta ↔ cofre/banco). Somá-los ao resultado inflaria as duas
    // colunas. Ficam num bloco próprio, visíveis sem contaminar a conta.
    supabase
      .from("cash_movement")
      .select("id, type, amount, reason, created_at")
      .eq("company_id", companyId)
      .in("type", ["sangria", "suprimento"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Definições, alinhadas com get_dashboard_metrics (a fonte do Dashboard e
  // dos KPIs), para que a mesma palavra não signifique duas coisas:
  //
  //   entradas  = todo pagamento que entrou, inclusive os depois estornados
  //   estornos  = devoluções de pagamento (vendas canceladas)
  //   despesas  = saídas de verdade (compras, contas)
  //   resultado = entradas − estornos − despesas
  //
  // "entradas − estornos" é exatamente o `receita_recebida` da RPC: só
  // pagamentos que continuam confirmados. Antes, este bloco chamava as
  // entradas brutas de "Receitas", e uma venda cancelada seguia contada como
  // receita realizada enquanto o estorno aparecia escondido entre as
  // despesas.
  const rows = entries ?? [];
  const entradas = rows.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const estornos = rows
    .filter((e) => e.type === "expense" && e.category === "estorno")
    .reduce((s, e) => s + Number(e.amount), 0);
  const despesas = rows
    .filter((e) => e.type === "expense" && e.category !== "estorno")
    .reduce((s, e) => s + Number(e.amount), 0);
  const receitaLiquida = entradas - estornos;
  const resultado = receitaLiquida - despesas;
  const movimentacoes = transfers ?? [];

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

      {/* Três colunas em 390px deixam ~110px por card, e "R$ 1.350,00" não
          cabe — o valor era cortado. Empilha no celular e volta a três a
          partir de sm. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-label uppercase text-muted">Receita recebida</p>
          <p className="text-section-title text-success mt-1 tabular-nums">
            {formatCurrency(receitaLiquida)}
          </p>
          <p className="text-caption text-muted mt-1 tabular-nums">
            {formatCurrency(entradas)} recebidos
            {estornos > 0 ? ` − ${formatCurrency(estornos)} estornados` : ""}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-label uppercase text-muted">Despesas</p>
          <p className="text-section-title text-danger mt-1 tabular-nums">
            {formatCurrency(despesas)}
          </p>
          <p className="text-caption text-muted mt-1">sem contar estornos</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-label uppercase text-muted">Resultado</p>
          <p className="text-section-title text-foreground mt-1 tabular-nums">
            {formatCurrency(resultado)}
          </p>
          <p className="text-caption text-muted mt-1">recebido − despesas</p>
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
                  <Badge
                    tone={
                      entry.type === "income"
                        ? "success"
                        : entry.category === "estorno"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {entry.type === "income"
                      ? "entrada"
                      : entry.category === "estorno"
                        ? "estorno"
                        : "despesa"}
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

      {movimentacoes.length > 0 && (
        <section>
          <h2 className="text-section-title text-foreground mb-1">Movimentações de caixa</h2>
          <p className="text-body-sm text-muted mb-3">
            Sangrias e suprimentos movem dinheiro entre a gaveta e o cofre — não entram no
            resultado acima.
          </p>
          <Surface>
            {movimentacoes.map((movement) => (
              <SurfaceRow key={movement.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body-sm font-medium text-foreground">
                    {movement.type === "sangria" ? "Sangria" : "Suprimento"}
                  </p>
                  <p className="text-caption text-muted mt-0.5">
                    {new Date(movement.created_at).toLocaleDateString("pt-BR")}
                    {movement.reason ? ` · ${movement.reason}` : ""}
                  </p>
                </div>
                <span className="text-body-sm tabular-nums text-foreground">
                  {movement.type === "sangria" ? "−" : "+"}
                  {formatCurrency(movement.amount)}
                </span>
              </SurfaceRow>
            ))}
          </Surface>
        </section>
      )}
    </div>
  );
}
