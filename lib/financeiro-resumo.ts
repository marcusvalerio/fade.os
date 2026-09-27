/**
 * O resumo do Financeiro sobre TODOS os lançamentos do período — as mesmas
 * definições de get_dashboard_metrics:
 *
 *   entradas  = todo pagamento que entrou, inclusive os depois estornados
 *   estornos  = devoluções de pagamento (vendas canceladas)
 *   despesas  = saídas de verdade (compras, contas)
 *   resultado = entradas − estornos − despesas
 */
export type Lancamento = { type: string; category: string; amount: number | string };

const ROTULOS: Record<string, string> = {
  venda: "Atendimentos",
  venda_pdv: "Vendas no balcão",
  estorno: "Estornos (vendas canceladas)",
};

export function rotuloDaCategoria(categoria: string): string {
  return ROTULOS[categoria] ?? categoria;
}

export type ResumoFinanceiro = {
  entradas: number;
  estornos: number;
  despesas: number;
  receitaLiquida: number;
  resultado: number;
  origens: { categoria: string; rotulo: string; total: number; qtd: number }[];
  destinos: { categoria: string; rotulo: string; total: number; qtd: number }[];
};

const centavos = (n: number) => Math.round(n * 100) / 100;

export function resumoFinanceiro(lancamentos: Lancamento[]): ResumoFinanceiro {
  let entradas = 0;
  let estornos = 0;
  let despesas = 0;
  const origens = new Map<string, { total: number; qtd: number }>();
  const destinos = new Map<string, { total: number; qtd: number }>();
  for (const l of lancamentos) {
    const v = Number(l.amount);
    if (l.type === "income") {
      entradas += v;
      const o = origens.get(l.category) ?? { total: 0, qtd: 0 };
      origens.set(l.category, { total: o.total + v, qtd: o.qtd + 1 });
    } else if (l.type === "expense") {
      if (l.category === "estorno") estornos += v;
      else despesas += v;
      const d = destinos.get(l.category) ?? { total: 0, qtd: 0 };
      destinos.set(l.category, { total: d.total + v, qtd: d.qtd + 1 });
    }
  }
  const lista = (m: Map<string, { total: number; qtd: number }>) =>
    [...m.entries()]
      .map(([categoria, x]) => ({ categoria, rotulo: rotuloDaCategoria(categoria), total: centavos(x.total), qtd: x.qtd }))
      .sort((a, b) => b.total - a.total);
  const receitaLiquida = centavos(entradas - estornos);
  return {
    entradas: centavos(entradas),
    estornos: centavos(estornos),
    despesas: centavos(despesas),
    receitaLiquida,
    resultado: centavos(receitaLiquida - despesas),
    origens: lista(origens),
    destinos: lista(destinos),
  };
}
