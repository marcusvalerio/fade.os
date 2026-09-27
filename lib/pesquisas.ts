/**
 * Pesquisas in-app — vocabulário e validação do lado da interface. As
 * mesmas regras valem no banco (validar_resposta_pesquisa e as constraints
 * de public.pesquisa); aqui só para responder rápido no formulário.
 */

export const TIPOS_DE_PESQUISA = {
  nota: "Nota de 1 a 5",
  sim_nao: "Sim ou não",
  escolha: "Uma opção",
  multipla: "Várias opções",
  texto: "Texto livre",
} as const;
export type TipoDePesquisa = keyof typeof TIPOS_DE_PESQUISA;

export const PUBLICOS = {
  gestor: "Responsável e gerência",
  profissional: "Profissionais",
  cliente: "Clientes",
} as const;
export type Publico = keyof typeof PUBLICOS;

/** Funcionalidade relacionada — só módulos que existem no produto. */
export const FUNCIONALIDADES = {
  geral: "Produto em geral",
  inicio: "Início",
  agenda: "Agenda",
  agendamento_publico: "Página de agendamento",
  atendimento: "Atendimento",
  nova_venda: "Nova venda",
  caixa: "Caixa",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  estoque: "Estoque",
  clientes: "Clientes",
  equipe: "Equipe",
  configuracoes: "Configurações",
  onboarding: "Primeira configuração",
  conta_cliente: "Conta do cliente",
} as const;
export type Funcionalidade = keyof typeof FUNCIONALIDADES;

export const STATUS_DA_PESQUISA = {
  rascunho: "Rascunho",
  publicada: "Publicada",
  encerrada: "Encerrada",
} as const;
export type StatusDaPesquisa = keyof typeof STATUS_DA_PESQUISA;

export type Resposta = number | boolean | string | string[];

export type PesquisaPendente = {
  id: string;
  titulo: string;
  pergunta: string;
  tipo: TipoDePesquisa;
  opcoes: string[];
  permite_comentario: boolean;
  publico: Publico;
};

export const LIMITE_DO_TEXTO = 1000;

/** Mesmo critério do banco. Devolve o valor normalizado ou null. */
export function normalizarResposta(tipo: TipoDePesquisa, opcoes: readonly string[], valor: unknown): Resposta | null {
  switch (tipo) {
    case "nota":
      return typeof valor === "number" && Number.isInteger(valor) && valor >= 1 && valor <= 5 ? valor : null;
    case "sim_nao":
      return typeof valor === "boolean" ? valor : null;
    case "escolha":
      return typeof valor === "string" && opcoes.includes(valor) ? valor : null;
    case "multipla": {
      if (!Array.isArray(valor) || valor.length === 0) return null;
      if (!valor.every((v) => typeof v === "string" && opcoes.includes(v))) return null;
      return opcoes.filter((o) => valor.includes(o));
    }
    case "texto": {
      if (typeof valor !== "string") return null;
      const t = valor.trim();
      return t.length > 0 && valor.length <= LIMITE_DO_TEXTO ? t : null;
    }
  }
}

/** Opções digitadas pelo admin: sem vazias, sem repetidas (ignorando caixa). */
export function limparOpcoes(bruto: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const o of bruto) {
    const t = o.trim();
    const chave = t.toLocaleLowerCase("pt-BR");
    if (t && !vistas.has(chave)) {
      vistas.add(chave);
      saida.push(t);
    }
  }
  return saida;
}

export type RascunhoDePesquisa = {
  titulo: string;
  pergunta: string;
  tipo: TipoDePesquisa;
  opcoes: string[];
  publico: Publico[];
  publicarEm: string | null;
  encerrarEm: string | null;
};

/** Erros por campo antes de salvar — mesmas regras das constraints. */
export function errosDaPesquisa(p: RascunhoDePesquisa): Partial<Record<keyof RascunhoDePesquisa, string>> {
  const e: Partial<Record<keyof RascunhoDePesquisa, string>> = {};
  const titulo = p.titulo.trim();
  const pergunta = p.pergunta.trim();
  if (titulo.length < 3 || titulo.length > 80) e.titulo = "Use de 3 a 80 caracteres.";
  if (pergunta.length < 5 || pergunta.length > 240) e.pergunta = "Use de 5 a 240 caracteres.";
  if (p.tipo === "escolha" || p.tipo === "multipla") {
    const n = limparOpcoes(p.opcoes).length;
    if (n < 2 || n > 8) e.opcoes = "De 2 a 8 opções diferentes.";
  }
  if (p.publico.length === 0) e.publico = "Escolha pelo menos um público.";
  if (p.publicarEm && p.encerrarEm && new Date(p.encerrarEm) <= new Date(p.publicarEm)) {
    e.encerrarEm = "O encerramento precisa ser depois da publicação.";
  }
  return e;
}

/** Tradução dos códigos que as funções do banco levantam. */
export const MENSAGENS_DA_PESQUISA: Record<string, string> = {
  PESQUISA_INDISPONIVEL: "Esta pesquisa não está mais disponível.",
  PESQUISA_JA_RESPONDIDA: "Você já respondeu esta pesquisa. Obrigado!",
  RESPOSTA_INVALIDA: "Resposta inválida. Confira e tente de novo.",
  RESPOSTA_OBRIGATORIA: "Escolha uma resposta.",
  COMENTARIO_LONGO: "O comentário pode ter até 1000 caracteres.",
  PESQUISA_NAO_ENCONTRADA: "Pesquisa não encontrada.",
  PESQUISA_ENCERRADA: "Pesquisa encerrada não pode ser editada.",
  TRANSICAO_INVALIDA: "Essa mudança de status não é possível.",
  SO_RASCUNHO_PODE_SER_EXCLUIDO: "Só rascunhos podem ser excluídos. Encerre a pesquisa em vez disso.",
};
