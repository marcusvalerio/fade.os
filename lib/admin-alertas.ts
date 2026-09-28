/**
 * Alertas internos do CORTEX ADMIN — regras fixas sobre dados reais
 * (banco e Sentry), sem "IA" nem previsão. Cada alerta diz o que foi visto,
 * de onde veio e para onde ir. Uma empresa gera no máximo um alerta: o mais
 * grave, com os outros sinais no detalhe.
 */

export type NivelDoAlerta = "critico" | "importante" | "atencao" | "info";
export const ORDEM_DOS_NIVEIS: NivelDoAlerta[] = ["critico", "importante", "atencao", "info"];
export const ROTULO_DO_NIVEL: Record<NivelDoAlerta, string> = {
  critico: "Crítico",
  importante: "Importante",
  atencao: "Atenção",
  info: "Informativo",
};

export type Alerta = {
  chave: string;
  nivel: NivelDoAlerta;
  titulo: string;
  detalhe: string;
  href: string;
  origem: "beta" | "erros" | "pesquisas" | "acessos";
};

type EmpresaParaAlerta = {
  id: string;
  name: string;
  status: string;
  estado: "ativa" | "esfriando" | "parada" | "sem_uso" | "configurando" | "suspensa";
  entrou_em: string;
  dias_sem_acesso: number | null;
  dias_sem_atividade: number | null;
  beta_expira_em: string | null;
  beta_status: string | null;
};

type PesquisaParaAlerta = { id: string; titulo: string; status: string; exibicoes: number; respostas: number };

type ErrosParaAlerta =
  | { estado: "nao_conectado" }
  | { estado: "indisponivel"; motivo: string }
  | { estado: "ok"; resumo: { abertos: number; novos24h: number; recorrentes: number } };

export const LIMITES = {
  diasParaConfiguracaoTravada: 3,
  diasSemAcesso: 7,
  diasDeInatividadeProlongada: 10,
  diasParaExpirar: 14,
  exibicoesMinimasDaPesquisa: 10,
  taxaBaixaDaPesquisa: 0.2,
} as const;

const DIA = 24 * 3600 * 1000;
const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export function gerarAlertas(
  entrada: { empresas: EmpresaParaAlerta[]; betaPendentes: number; pesquisas: PesquisaParaAlerta[]; erros: ErrosParaAlerta },
  agora = Date.now()
): Alerta[] {
  const alertas: Alerta[] = [];
  const { erros } = entrada;

  if (erros.estado === "ok") {
    if (erros.resumo.novos24h > 0) {
      alertas.push({
        chave: "erros-novos",
        nivel: "critico",
        titulo: `${erros.resumo.novos24h} ${erros.resumo.novos24h === 1 ? "erro novo" : "erros novos"} em produção nas últimas 24 h`,
        detalhe: "Apareceram pela primeira vez. Veja rota, frequência e quem foi afetado.",
        href: "/admin/sistema#erros",
        origem: "erros",
      });
    }
    if (erros.resumo.recorrentes > 0) {
      alertas.push({
        chave: "erros-recorrentes",
        nivel: "atencao",
        titulo: `${erros.resumo.recorrentes} ${erros.resumo.recorrentes === 1 ? "erro se repetindo" : "erros se repetindo"} em produção`,
        detalhe: "Voltaram em dias diferentes ou aconteceram 5 vezes ou mais sem resolução.",
        href: "/admin/sistema#erros",
        origem: "erros",
      });
    }
  } else if (erros.estado === "indisponivel") {
    alertas.push({ chave: "erros-indisponivel", nivel: "atencao", titulo: "Leitura de erros indisponível", detalhe: erros.motivo, href: "/admin/sistema#erros", origem: "erros" });
  } else {
    alertas.push({
      chave: "erros-nao-conectado",
      nivel: "info",
      titulo: "Erros de produção não aparecem no Admin",
      detalhe: "O Sentry recebe os erros, mas a leitura aqui precisa do token SENTRY_API_TOKEN no servidor.",
      href: "/admin/sistema#erros",
      origem: "erros",
    });
  }

  if (entrada.betaPendentes > 0) {
    alertas.push({
      chave: "beta-pendentes",
      nivel: "importante",
      titulo: `${entrada.betaPendentes} ${entrada.betaPendentes === 1 ? "pedido de beta aguardando" : "pedidos de beta aguardando"}`,
      detalhe: "Quem pediu acesso está esperando a aprovação para começar.",
      href: "/admin/acessos",
      origem: "acessos",
    });
  }

  for (const e of entrada.empresas) {
    // Suspensa ou com beta revogado: a plataforma já decidiu, não há contato a fazer.
    if (e.status === "suspended" || e.estado === "suspensa" || e.beta_status === "revoked") continue;
    const sinais: { nivel: NivelDoAlerta; texto: string }[] = [];
    const desdeEntrada = Math.floor((agora - new Date(e.entrou_em).getTime()) / DIA);

    if (e.estado === "parada") sinais.push({ nivel: "importante", texto: `parou: nenhuma operação há ${dias(e.dias_sem_atividade ?? 0)}` });
    if (e.estado === "esfriando") sinais.push({ nivel: "atencao", texto: `esfriando: última operação há ${dias(e.dias_sem_atividade ?? 0)}` });
    if (e.estado === "sem_uso" && desdeEntrada >= LIMITES.diasParaConfiguracaoTravada)
      sinais.push({ nivel: "importante", texto: "concluiu a configuração e ainda não registrou nenhuma operação" });
    if (e.estado === "configurando" && desdeEntrada >= LIMITES.diasParaConfiguracaoTravada)
      sinais.push({ nivel: "atencao", texto: `configuração inicial parada há ${dias(desdeEntrada)}` });
    // 7 dias: atenção; 10 dias: inatividade prolongada. Só dashboard — nunca push.
    if (e.dias_sem_acesso !== null && e.dias_sem_acesso >= LIMITES.diasDeInatividadeProlongada)
      sinais.push({ nivel: "importante", texto: `inatividade prolongada: ninguém da equipe entra há ${dias(e.dias_sem_acesso)}` });
    else if (e.dias_sem_acesso !== null && e.dias_sem_acesso >= LIMITES.diasSemAcesso)
      sinais.push({ nivel: "atencao", texto: `ninguém da equipe entra há ${dias(e.dias_sem_acesso)}` });
    if (e.beta_status === "approved" && e.beta_expira_em) {
      const faltam = Math.ceil((new Date(e.beta_expira_em).getTime() - agora) / DIA);
      if (faltam >= 0 && faltam <= LIMITES.diasParaExpirar) sinais.push({ nivel: "info", texto: `beta termina em ${dias(faltam)}` });
    }

    if (sinais.length === 0) continue;
    sinais.sort((a, b) => ORDEM_DOS_NIVEIS.indexOf(a.nivel) - ORDEM_DOS_NIVEIS.indexOf(b.nivel));
    const [principal, ...outros] = sinais;
    alertas.push({
      chave: `empresa-${e.id}`,
      nivel: principal.nivel,
      titulo: `${e.name}: ${principal.texto}`,
      detalhe: outros.length ? `Também: ${outros.map((s) => s.texto).join("; ")}.` : "Vale um contato para entender o que travou.",
      href: `/admin/empresas/${e.id}`,
      origem: "beta",
    });
  }

  for (const p of entrada.pesquisas) {
    if (p.status !== "publicada" || p.exibicoes < LIMITES.exibicoesMinimasDaPesquisa) continue;
    const taxa = p.respostas / p.exibicoes;
    if (taxa < LIMITES.taxaBaixaDaPesquisa) {
      alertas.push({
        chave: `pesquisa-${p.id}`,
        nivel: "info",
        titulo: `Pesquisa “${p.titulo}” com pouca resposta`,
        detalhe: `${p.respostas} de ${p.exibicoes} pessoas responderam (${Math.round(taxa * 100)}%). Talvez a pergunta esteja longa ou fora de hora.`,
        href: `/admin/pesquisas/${p.id}`,
        origem: "pesquisas",
      });
    }
  }

  return alertas.sort((a, b) => ORDEM_DOS_NIVEIS.indexOf(a.nivel) - ORDEM_DOS_NIVEIS.indexOf(b.nivel));
}
