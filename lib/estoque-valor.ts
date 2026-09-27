/**
 * Quanto vale o que está na prateleira — só com o que está cadastrado.
 * Item sem custo não entra na soma (e é contado à parte, para a tela dizer
 * que o valor está incompleto em vez de fingir que é exato). Saldo negativo
 * ou zero não vale nada.
 */
export type ItemDeEstoque = {
  current_stock: number | string;
  minimum_stock: number | string;
  cost_price: number | string | null;
  sale_price?: number | string | null;
};

export type ValorDoEstoque = {
  custoTotal: number;
  vendaTotal: number;
  semCusto: number;
  abaixoDoMinimo: number;
  zerados: number;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

export function valorDoEstoque(itens: ItemDeEstoque[]): ValorDoEstoque {
  let custoTotal = 0;
  let vendaTotal = 0;
  let semCusto = 0;
  let abaixoDoMinimo = 0;
  let zerados = 0;
  for (const i of itens) {
    const qtd = Number(i.current_stock);
    if (qtd <= 0) zerados++;
    if (qtd <= Number(i.minimum_stock)) abaixoDoMinimo++;
    if (qtd <= 0) continue;
    const custo = i.cost_price == null ? null : Number(i.cost_price);
    if (custo == null || !(custo > 0)) semCusto++;
    else custoTotal += qtd * custo;
    if (i.sale_price != null && Number(i.sale_price) > 0) vendaTotal += qtd * Number(i.sale_price);
  }
  return { custoTotal: centavos(custoTotal), vendaTotal: centavos(vendaTotal), semCusto, abaixoDoMinimo, zerados };
}
