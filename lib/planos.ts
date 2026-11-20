/**
 * Planos do CORTEX — um lugar só para nomes, preços e o que cada um inclui.
 *
 * Venda direta (nov/2026): o site não fala mais em "beta". O beta continua só
 * por convite (avaliadores, com prazo), e o que ele mostra dentro do produto
 * segue em `lib/beta.ts`.
 *
 * Valores em estudo. Anual = paga 10 meses, usa 12 ("2 meses grátis").
 * Ainda não existe checkout: os botões levam ao formulário de contato até a
 * cobrança pelo Stripe existir. Itens listados = só o que o produto faz hoje
 * (docs/landing-promessas.md).
 */

export type PlanoId = "basic" | "studio" | "pro";

export type Plano = {
  id: PlanoId;
  nome: string;
  selo: string;
  para: string;
  mensal: number;
  /** Total cobrado no ano (10 × o mensal). */
  anual: number;
  itens: string[];
  /** STUDIO aparece no claro na landing, para se destacar. */
  claro?: boolean;
  /** PRO ganha o contorno azul. */
  destaque?: boolean;
};

const BASE = [
  "Agenda e página de agendamento da barbearia",
  "Atendimento, vendas no balcão e caixa",
  "Clientes, histórico e clientes para chamar",
  "Celular do barbeiro e avisos no aparelho",
];

export const PLANOS: Plano[] = [
  {
    id: "basic",
    nome: "BASIC",
    selo: "Para começar",
    para: "Barbearia pequena organizando o dia a dia.",
    mensal: 89,
    anual: 890,
    itens: [...BASE, "Até 2 profissionais"],
  },
  {
    id: "studio",
    nome: "STUDIO",
    selo: "Estrutura própria",
    para: "Quem atende no próprio espaço e quer controle de verdade.",
    mensal: 139,
    anual: 1390,
    itens: [...BASE, "Financeiro: despesas, resultado e meta", "Estoque com baixa automática", "Até 2 contas"],
    claro: true,
  },
  {
    id: "pro",
    nome: "PRO",
    selo: "Mais completo",
    para: "Barbearia com equipe, comissão e mais de uma unidade.",
    mensal: 179,
    anual: 1790,
    itens: [
      "Tudo do STUDIO",
      "Comissões calculadas no fechamento",
      "Equipe, papéis e permissões",
      "Profissionais ilimitados",
      "Mais de uma unidade",
    ],
    destaque: true,
  },
];

/** Preço por mês no plano anual, arredondado (R$ 890 → 74, R$ 1.390 → 116). */
export function mensalNoAnual(p: Plano): number {
  return Math.round(p.anual / 12);
}

export const MENOR_MENSAL_NO_ANUAL = Math.min(...PLANOS.map(mensalNoAnual));
