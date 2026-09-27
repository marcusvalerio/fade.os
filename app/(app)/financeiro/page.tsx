import { createClient } from "@/lib/supabase/server";
import { formatBusinessDate, formatBusinessDayLabel } from "@/lib/time";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { NewExpenseForm } from "./NewExpenseForm";
import Link from "next/link";
import { AcessoRestrito } from "@/components/ui/acesso-restrito";
import { resumoFinanceiro, rotuloDaCategoria } from "@/lib/financeiro-resumo";
import { limitesDoMes, mesValido, rotuloDoMes } from "@/lib/mes";
import { businessToday } from "@/lib/time";
import { cn } from "@/lib/cn";

const LANCAMENTOS_CURTOS = 25;

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; todos?: string }>;
}) {
  const sp = await searchParams;
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const supabase = await createClient();
  const hoje = businessToday();
  const mes = mesValido(sp.mes, hoje);
  const { de, ate, anterior, seguinte } = limitesDoMes(mes);
  const noMesAtual = mes === hoje.slice(0, 7);
  const primeiroDia = `${mes}-01`;
  const ultimoDiaExclusivo = `${seguinte}-01`;
  const hrefMes = (m: string | null) => (m && m !== hoje.slice(0, 7) ? `/financeiro?mes=${m}` : "/financeiro");

  await requireAuthenticatedUser();
  if (!(await isCompanyManager(companyId))) {
    return (
      <div>
        <PageHeader eyebrow="Negócio" title="Financeiro" />
        <AcessoRestrito />
      </div>
    );
  }

  // Todos os lançamentos do mês, página a página — o resumo não pode ser
  // "os últimos N": antes somava os 80 mais recentes e chamava de período.
  const entries: { id: string; type: string; category: string; description: string | null; amount: number; entry_date: string; supplier: string | null }[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await supabase
      .from("financial_entry")
      .select("id, type, category, description, amount, entry_date, supplier")
      .eq("company_id", companyId)
      .gte("entry_date", primeiroDia)
      .lt("entry_date", ultimoDiaExclusivo)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(i, i + 999);
    entries.push(...((data ?? []) as typeof entries));
    if (!data || data.length < 1000) break;
  }

  // Sangria e suprimento não são receita nem despesa: é dinheiro trocando
  // de lugar (gaveta ↔ cofre/banco). Somá-los ao resultado inflaria as duas
  // colunas. Ficam num bloco próprio, visíveis sem contaminar a conta.
  const { data: transfers } = await supabase
    .from("cash_movement")
    .select("id, type, amount, reason, created_at")
    .eq("company_id", companyId)
    .in("type", ["sangria", "suprimento"])
    .gte("created_at", de.toISOString())
    .lt("created_at", ate.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  const r = resumoFinanceiro(entries);
  const { entradas, estornos, despesas, receitaLiquida, resultado } = r;
  const movimentacoes = transfers ?? [];
  const mostrarTodos = sp.todos === "1";
  const visiveis = mostrarTodos ? entries : entries.slice(0, LANCAMENTOS_CURTOS);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Negócio"
        title="Financeiro"
        description="Como está o negócio — não a gaveta. Para o dinheiro físico, veja o Caixa."
        action={
          <Link href="/vendas" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Ver vendas
          </Link>
        }
      />

      <nav aria-label="Mês" className="flex items-center gap-2 -mt-2">
        <Link href={hrefMes(anterior)} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Mês anterior">
          ←
        </Link>
        <p className="font-subtitle text-body text-foreground min-w-40 text-center">{rotuloDoMes(mes)}</p>
        {!noMesAtual ? (
          <Link href={hrefMes(seguinte)} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Mês seguinte">
            →
          </Link>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </nav>

      {/* 1. A resposta: resultado do mês; embaixo, a conta que chega nele. */}
      <section aria-labelledby="resultado" className="painel p-5 sm:p-6">
        <p id="resultado" className="font-subtitle text-caption uppercase tracking-label text-muted">
          Resultado de {rotuloDoMes(mes).toLowerCase()}
        </p>
        <p className={cn("text-metric-sm sm:text-metric font-heading numero mt-1.5", resultado >= 0 ? "text-foreground" : "text-danger-ink")}>
          {formatCurrency(resultado)}
        </p>
        <dl className="mt-5 pt-5 border-t border-border grid grid-cols-3 gap-4">
          <div>
            <dt className="font-subtitle text-caption text-muted">Entrou</dt>
            <dd className="numero text-section-title text-foreground mt-0.5">{formatCurrency(receitaLiquida)}</dd>
            <dd className="text-micro text-muted mt-0.5 numero">
              {formatCurrency(entradas)} recebidos{estornos > 0 ? ` − ${formatCurrency(estornos)} estornados` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-subtitle text-caption text-muted">Saiu</dt>
            <dd className="numero text-section-title text-foreground mt-0.5">{formatCurrency(despesas)}</dd>
            <dd className="text-micro text-muted mt-0.5">despesas lançadas</dd>
          </div>
          <div>
            <dt className="font-subtitle text-caption text-muted">Lançamentos</dt>
            <dd className="numero text-section-title text-foreground mt-0.5">{entries.length}</dd>
            <dd className="text-micro text-muted mt-0.5">no mês</dd>
          </div>
        </dl>
      </section>

      {/* 2. De onde veio e para onde foi — a leitura rápida antes do detalhe. */}
      {(r.origens.length > 0 || r.destinos.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { titulo: "De onde veio", itens: r.origens, total: entradas },
            { titulo: "Para onde foi", itens: r.destinos, total: estornos + despesas },
          ].map((bloco) => (
            <section key={bloco.titulo} className="painel p-4 sm:p-5" aria-label={bloco.titulo}>
              <p className="font-subtitle text-caption text-muted">{bloco.titulo}</p>
              {bloco.itens.length === 0 ? (
                <p className="text-body-sm text-muted mt-2">Nada no mês.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {bloco.itens.map((i) => (
                    <li key={i.categoria}>
                      <div className="flex items-baseline justify-between gap-3 text-body-sm">
                        <span className="text-foreground truncate">{i.rotulo}</span>
                        <span className="numero text-foreground shrink-0">{formatCurrency(i.total)}</span>
                      </div>
                      <div className="mt-1 h-1 bg-surface-muted rounded-full overflow-hidden" aria-hidden="true">
                        <div className="h-full bg-brand-blue" style={{ width: `${bloco.total > 0 ? Math.max(2, (i.total / bloco.total) * 100) : 0}%` }} />
                      </div>
                      <p className="text-micro text-muted mt-0.5">
                        {i.qtd} {i.qtd === 1 ? "lançamento" : "lançamentos"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <NewExpenseForm companyId={companyId} hoje={hoje} />

      {/* 3. O detalhe — linha a linha. */}
      <section aria-labelledby="lancamentos" id="lancamentos-sec">
        <h2 id="lancamentos" className="text-section-title text-foreground mb-3">
          Lançamentos
        </h2>
        <Surface>
          {visiveis.length > 0 ? (
            visiveis.map((entry) => (
              <SurfaceRow key={entry.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-foreground truncate">
                    {rotuloDaCategoria(entry.category)}
                    {entry.supplier ? ` · ${entry.supplier}` : ""}
                  </p>
                  <p className="text-caption text-muted mt-0.5 truncate">
                    {formatBusinessDayLabel(String(entry.entry_date).slice(0, 10), { day: "2-digit", month: "short" })}
                    {entry.description ? ` · ${entry.description}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "numero text-body-sm shrink-0",
                    entry.type === "income" ? "text-success-ink" : entry.category === "estorno" ? "text-warning-ink" : "text-foreground"
                  )}
                >
                  {entry.type === "income" ? "+" : "−"}
                  {formatCurrency(entry.amount)}
                </span>
              </SurfaceRow>
            ))
          ) : (
            <Vazio
              titulo={noMesAtual ? "Nenhum lançamento este mês" : "Nenhum lançamento neste mês"}
              descricao="O que você recebe entra aqui sozinho, a cada pagamento. Despesas são as únicas que se lançam à mão."
              acao={
                noMesAtual ? (
                  <Link href="/pdv" className={buttonClasses({ variant: "secondary" })}>
                    Registrar uma venda
                  </Link>
                ) : undefined
              }
            />
          )}
        </Surface>
        {!mostrarTodos && entries.length > LANCAMENTOS_CURTOS && (
          <Link
            href={`${hrefMes(mes)}${hrefMes(mes).includes("?") ? "&" : "?"}todos=1#lancamentos-sec`}
            className={buttonClasses({ variant: "ghost", size: "sm", className: "mt-2" })}
          >
            Ver todos os {entries.length} lançamentos
          </Link>
        )}
      </section>

      {movimentacoes.length > 0 && (
        <section>
          <h2 className="text-section-title text-foreground mb-1">Movimentações de caixa no mês</h2>
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
                    {formatBusinessDate(movement.created_at, { dateStyle: "short" })}
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
