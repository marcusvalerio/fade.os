/**
 * Funil de aquisição do CORTEX — do que já existe até o que ainda depende da
 * coleta do site.
 *
 * Etapas do site (visitantes, interessados, cadastro iniciado) ficam `null`
 * enquanto a coleta não estiver ligada (PENDENTE — REQUER ACESSO AO
 * SUPABASE). As etapas do produto vêm de dados reais que o Admin já lê: os
 * pedidos de Beta, as empresas, o onboarding e o uso. A conversão só é
 * calculada entre duas etapas medidas — nunca contra um número inventado.
 */

export type EtapaDoFunil = {
  chave: string;
  rotulo: string;
  valor: number | null;
  /** Conversão a partir da etapa medida anterior, em %; null se não dá para calcular. */
  conversao: number | null;
  fonte: "site" | "produto";
};

export type EntradaDoFunil = {
  visitantes: number | null;
  interessados: number | null;
  cadastrosIniciados: number | null;
  pedidosBeta: number;
  aprovados: number;
  empresas: number;
  onboardingsConcluidos: number;
  primeiroUso: number;
  ativas: number;
};

export function montarFunil(e: EntradaDoFunil): EtapaDoFunil[] {
  const etapas: Omit<EtapaDoFunil, "conversao">[] = [
    { chave: "visitantes", rotulo: "Visitantes", valor: e.visitantes, fonte: "site" },
    { chave: "interessados", rotulo: "Visitantes interessados", valor: e.interessados, fonte: "site" },
    { chave: "cadastros_iniciados", rotulo: "Cadastros iniciados", valor: e.cadastrosIniciados, fonte: "site" },
    { chave: "pedidos_beta", rotulo: "Pedidos de Beta", valor: e.pedidosBeta, fonte: "produto" },
    { chave: "aprovados", rotulo: "Acessos liberados", valor: e.aprovados, fonte: "produto" },
    { chave: "empresas", rotulo: "Empresas criadas", valor: e.empresas, fonte: "produto" },
    { chave: "onboarding", rotulo: "Onboardings concluídos", valor: e.onboardingsConcluidos, fonte: "produto" },
    { chave: "primeiro_uso", rotulo: "Primeiro uso real", valor: e.primeiroUso, fonte: "produto" },
    { chave: "ativas", rotulo: "Empresas ativas", valor: e.ativas, fonte: "produto" },
  ];
  let anterior: number | null = null;
  return etapas.map((etapa) => {
    const conversao = etapa.valor !== null && anterior !== null && anterior > 0 ? Math.round((etapa.valor / anterior) * 1000) / 10 : null;
    if (etapa.valor !== null) anterior = etapa.valor;
    return { ...etapa, conversao };
  });
}

/** Razão em % com uma casa, ou null quando o denominador não existe. */
export function taxa(parte: number | null, todo: number | null): number | null {
  if (parte === null || todo === null || todo <= 0) return null;
  return Math.round((parte / todo) * 1000) / 10;
}

export const SEM_ATRIBUICAO = "Sem atribuição — anterior à coleta";
