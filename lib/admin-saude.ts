/**
 * Saúde da plataforma — adoção. Regras fixas sobre dados reais, só para o
 * DASHBOARD: nada aqui vira notificação (uma barbearia ficar 7 ou 10 dias
 * sem entrar é informação, não uma ação urgente do Admin).
 *
 * Sem imports: roda no servidor e no runner de testes.
 */

export const LIMITES_DE_ADOCAO = {
  /** ninguém da equipe entra há 7 dias: atenção */
  diasSemAcessoAtencao: 7,
  /** 10 dias: inatividade prolongada */
  diasSemAcessoProlongado: 10,
  /** queda relevante: semana anterior com pelo menos isto de movimento… */
  movimentoMinimoParaQueda: 5,
  /** …e a semana atual com no máximo esta fração dela */
  fracaoDeQueda: 0.5,
} as const;

type EmpresaParaAdocao = {
  id: string;
  name: string;
  status: string;
  estado: "ativa" | "esfriando" | "parada" | "sem_uso" | "configurando" | "suspensa";
  origem: "convite_beta" | "cadastro_direto";
  beta_status: string | null;
  dias_sem_acesso: number | null;
  ultimo_acesso: string | null;
};

type Movimento = { id: string; agendamentos_periodo: number; atendimentos_periodo: number };

export type EmpresaResumida = { id: string; name: string; detalhe: string };

export type NivelDeInatividade = "ok" | "atencao" | "prolongada" | "nunca_entrou";

export function nivelDeInatividade(diasSemAcesso: number | null, ultimoAcesso: string | null): NivelDeInatividade {
  if (!ultimoAcesso || diasSemAcesso === null) return "nunca_entrou";
  if (diasSemAcesso >= LIMITES_DE_ADOCAO.diasSemAcessoProlongado) return "prolongada";
  if (diasSemAcesso >= LIMITES_DE_ADOCAO.diasSemAcessoAtencao) return "atencao";
  return "ok";
}

export type Adocao = {
  total: number;
  ativas: EmpresaResumida[];
  semAcesso7: EmpresaResumida[];
  semAcesso10: EmpresaResumida[];
  betaSemUso: EmpresaResumida[];
  pararam: EmpresaResumida[];
  onboardingPendente: EmpresaResumida[];
  quedaDeUso: EmpresaResumida[];
};

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
const mov = (m: Movimento | undefined) => (m ? m.agendamentos_periodo + m.atendimentos_periodo : 0);

/**
 * @param empresas   admin_beta_empresas (estado, acesso, origem)
 * @param semana     admin_company_activity(7)  — últimos 7 dias
 * @param quinzena   admin_company_activity(14) — últimos 14 dias (a semana anterior é a diferença)
 */
export function calcularAdocao(empresas: EmpresaParaAdocao[], semana: Movimento[], quinzena: Movimento[]): Adocao {
  const s = new Map(semana.map((m) => [m.id, m]));
  const q = new Map(quinzena.map((m) => [m.id, m]));
  const vivas = empresas.filter((e) => e.status !== "suspended" && e.estado !== "suspensa" && e.beta_status !== "revoked");
  const a: Adocao = { total: vivas.length, ativas: [], semAcesso7: [], semAcesso10: [], betaSemUso: [], pararam: [], onboardingPendente: [], quedaDeUso: [] };

  for (const e of vivas) {
    const r = (detalhe: string): EmpresaResumida => ({ id: e.id, name: e.name, detalhe });
    if (e.estado === "ativa") a.ativas.push(r("operou nos últimos 7 dias"));

    const nivel = nivelDeInatividade(e.dias_sem_acesso, e.ultimo_acesso);
    if (nivel === "prolongada") a.semAcesso10.push(r(`ninguém entra há ${dias(e.dias_sem_acesso!)}`));
    else if (nivel === "atencao") a.semAcesso7.push(r(`ninguém entra há ${dias(e.dias_sem_acesso!)}`));

    if (e.origem === "convite_beta" && e.estado === "sem_uso") a.betaSemUso.push(r("recebeu o Beta e ainda não registrou operação"));
    if (e.estado === "parada") a.pararam.push(r("usou e parou de operar"));
    if (e.estado === "configurando") a.onboardingPendente.push(r("configuração inicial não concluída"));

    const atual = mov(s.get(e.id));
    const anterior = Math.max(0, mov(q.get(e.id)) - atual);
    if (anterior >= LIMITES_DE_ADOCAO.movimentoMinimoParaQueda && atual <= anterior * LIMITES_DE_ADOCAO.fracaoDeQueda) {
      a.quedaDeUso.push(r(`${atual} registros nesta semana contra ${anterior} na anterior`));
    }
  }
  return a;
}

// ---------------------------------------------------------------------------
// Funil do Beta: pedido → aprovação → utilização → abandono → feedback
// ---------------------------------------------------------------------------

export type EtapaDoFunil = { chave: string; rotulo: string; valor: number; detalhe: string };

export function funilDoBeta(
  solicitacoes: Partial<Record<"pending" | "approved" | "rejected" | "revoked", number>>,
  empresas: { origem: string; estado: string; pesquisas_respondidas: number; beta_status: string | null }[]
): EtapaDoFunil[] {
  const doBeta = empresas.filter((e) => e.origem === "convite_beta" && e.beta_status !== "revoked");
  const usaram = doBeta.filter((e) => e.estado === "ativa" || e.estado === "esfriando" || e.estado === "parada");
  const pararam = doBeta.filter((e) => e.estado === "parada");
  const responderam = doBeta.filter((e) => e.pesquisas_respondidas > 0);
  const pedidos = (solicitacoes.pending ?? 0) + (solicitacoes.approved ?? 0) + (solicitacoes.rejected ?? 0) + (solicitacoes.revoked ?? 0);
  return [
    { chave: "pedidos", rotulo: "Pedidos", valor: pedidos, detalhe: `${solicitacoes.pending ?? 0} aguardando · ${solicitacoes.rejected ?? 0} recusados` },
    { chave: "aprovadas", rotulo: "Receberam o Beta", valor: doBeta.length, detalhe: `${solicitacoes.revoked ?? 0} revogados` },
    { chave: "usaram", rotulo: "Utilizaram", valor: usaram.length, detalhe: `${doBeta.length - usaram.length} ainda não utilizaram` },
    { chave: "pararam", rotulo: "Pararam", valor: pararam.length, detalhe: "usaram e pararam de operar" },
    { chave: "feedback", rotulo: "Deram feedback", valor: responderam.length, detalhe: "responderam ao menos uma pesquisa" },
  ];
}
