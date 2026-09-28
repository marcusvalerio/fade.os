/**
 * Catálogo de notificações — espelho do que o banco decide.
 *
 * A fonte de verdade é a tabela notificacao_tipo (migration
 * 20260930100000_notificacoes_base.sql + 20260930110000_notificacoes_eventos.sql):
 * ela diz quem pode receber cada tipo, se é obrigatório, a prioridade e se vai
 * por push. Este arquivo só dá NOME e ORDEM às coisas na interface
 * (Configurações → Notificações, a central, o Admin). O teste
 * catalogo.test.ts confere que os dois lados não se separaram.
 *
 * Sem imports: roda no navegador, no servidor e no runner de testes.
 */

export type Categoria = "agenda" | "clientes" | "financeiro" | "estoque" | "equipe" | "produto" | "sistema";
export type Prioridade = "critical" | "important" | "normal" | "informational";
export type Publico = "gestor" | "profissional" | "cliente";
export type Canal = "in_app" | "push" | "email";

export const CATEGORIAS: { chave: Categoria; rotulo: string }[] = [
  { chave: "agenda", rotulo: "Agenda" },
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "financeiro", rotulo: "Financeiro" },
  { chave: "estoque", rotulo: "Estoque" },
  { chave: "equipe", rotulo: "Equipe" },
  { chave: "produto", rotulo: "Produto" },
  { chave: "sistema", rotulo: "Sistema" },
];

export const ROTULO_DA_CATEGORIA: Record<Categoria, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.chave, c.rotulo])
) as Record<Categoria, string>;

export const ROTULO_DA_PRIORIDADE: Record<Prioridade, string> = {
  critical: "Crítica",
  important: "Importante",
  normal: "Normal",
  informational: "Informativa",
};

/**
 * Linhas de Configurações → Notificações. Um interruptor pode cobrir vários
 * tipos ("Alterações de horário" = reagendado, confirmado, chegada).
 * `publicos` é só para escrever a descrição certa; quem decide se a linha
 * aparece é o banco (minhas_preferencias_notificacao).
 */
export type Preferencia = {
  chave: string;
  categoria: Categoria;
  rotulo: string;
  descricao: Partial<Record<Publico, string>> & { padrao: string };
  obrigatoria?: boolean;
};

export const PREFERENCIAS: Preferencia[] = [
  { chave: "agenda.novos", categoria: "agenda", rotulo: "Novos agendamentos", descricao: {
    padrao: "Quando alguém marca um horário.",
    gestor: "Quando um cliente marca pela página ou pela área dele.",
    profissional: "Quando entra um horário na sua agenda.",
  } },
  { chave: "agenda.alteracoes", categoria: "agenda", rotulo: "Alterações de horário", descricao: {
    padrao: "Reagendamentos e confirmações.",
    gestor: "Quando um cliente muda o próprio horário.",
    profissional: "Horário mudou, saiu da sua agenda ou o cliente chegou.",
    cliente: "Quando a barbearia confirma ou muda seu horário.",
  } },
  { chave: "agenda.cancelamentos", categoria: "agenda", rotulo: "Cancelamentos", descricao: {
    padrao: "Quando um horário é cancelado.",
    gestor: "Cancelamentos de clientes e faltas.",
    profissional: "Quando um horário da sua agenda é cancelado.",
    cliente: "Quando a barbearia cancela seu horário.",
  } },
  { chave: "agenda.lembretes", categoria: "agenda", rotulo: "Lembretes", descricao: { padrao: "Um aviso cerca de 2 horas antes do seu horário." } },
  { chave: "agenda.avaliacoes", categoria: "agenda", rotulo: "Pedido de avaliação", descricao: { padrao: "Depois do atendimento, um convite para contar como foi." } },

  { chave: "clientes.novos", categoria: "clientes", rotulo: "Novos clientes", descricao: { padrao: "Quando um cliente cria conta na página da barbearia." } },
  { chave: "clientes.avaliacoes", categoria: "clientes", rotulo: "Avaliações", descricao: {
    padrao: "Quando um cliente avalia o atendimento.",
    profissional: "Quando um cliente avalia um atendimento seu.",
  } },
  { chave: "clientes.importacoes", categoria: "clientes", rotulo: "Importações", descricao: { padrao: "Quando outra pessoa da gerência importa clientes." } },

  { chave: "financeiro.alertas", categoria: "financeiro", rotulo: "Alertas financeiros", descricao: { padrao: "Caixa fechado com falta ou sobra." } },
  { chave: "financeiro.fechamentos", categoria: "financeiro", rotulo: "Fechamento de caixa", descricao: { padrao: "Quando outra pessoa fecha o caixa sem diferença." } },

  { chave: "estoque.baixo", categoria: "estoque", rotulo: "Estoque baixo", descricao: { padrao: "Quando um item chega ao mínimo que você definiu." } },
  { chave: "estoque.sem_estoque", categoria: "estoque", rotulo: "Produtos sem estoque", descricao: { padrao: "Quando um item acaba." } },

  { chave: "equipe.comissoes", categoria: "equipe", rotulo: "Comissões", descricao: { padrao: "Quando suas comissões são pagas." } },
  { chave: "equipe.alteracoes", categoria: "equipe", rotulo: "Alterações de equipe", descricao: { padrao: "Profissional entrou, saiu ou foi desativado." } },
  { chave: "equipe.acessos", categoria: "equipe", rotulo: "Acessos", descricao: { padrao: "Quando alguém ganha, perde ou muda de acesso." } },

  { chave: "produto.pesquisas", categoria: "produto", rotulo: "Pesquisas", descricao: { padrao: "Perguntas rápidas sobre o que melhorar no CORTEX. No máximo duas por semana." } },
  { chave: "produto.novidades", categoria: "produto", rotulo: "Novidades", descricao: { padrao: "O que mudou no CORTEX e pode ajudar no seu dia." } },
  { chave: "produto.beta", categoria: "produto", rotulo: "Recursos beta", descricao: { padrao: "Convites para experimentar algo antes de todo mundo." } },

  { chave: "sistema.atualizacoes", categoria: "sistema", rotulo: "Atualizações importantes", descricao: { padrao: "Mudanças no CORTEX que afetam como você trabalha." } },
  { chave: "sistema.manutencao", categoria: "sistema", rotulo: "Manutenção e avisos essenciais", obrigatoria: true, descricao: { padrao: "Paradas programadas e avisos sobre a sua conta. Sempre ligado." } },
  { chave: "sistema.seguranca", categoria: "sistema", rotulo: "Segurança", obrigatoria: true, descricao: { padrao: "Mudanças no seu acesso. Sempre ligado." } },
];

export const PREFERENCIA_POR_CHAVE = new Map(PREFERENCIAS.map((p) => [p.chave, p]));

export function descricaoDaPreferencia(p: Preferencia, publicos: Publico[]): string {
  // Quem tem um público só lê o texto dele; quem tem vários, o geral.
  if (publicos.length === 1) return p.descricao[publicos[0]] ?? p.descricao.padrao;
  return p.descricao.padrao;
}

/** Tipos que o Admin pode disparar como comunicado. */
export const TIPOS_COMUNICAVEIS: { chave: string; rotulo: string; categoria: Categoria; prioridadePadrao: Prioridade }[] = [
  { chave: "produto.novidade", rotulo: "Novidade do CORTEX", categoria: "produto", prioridadePadrao: "informational" },
  { chave: "produto.beta", rotulo: "Convite para recurso beta", categoria: "produto", prioridadePadrao: "informational" },
  { chave: "sistema.atualizacao", rotulo: "Atualização importante", categoria: "sistema", prioridadePadrao: "informational" },
  { chave: "sistema.manutencao", rotulo: "Manutenção / aviso essencial", categoria: "sistema", prioridadePadrao: "important" },
];

/** Papéis de destino de um comunicado (o que o Admin marca). */
export const PAPEIS_DE_DESTINO: { chave: "owner" | "admin" | "staff" | "cliente"; rotulo: string }[] = [
  { chave: "owner", rotulo: "Donos" },
  { chave: "admin", rotulo: "Administradores" },
  { chave: "staff", rotulo: "Profissionais" },
  { chave: "cliente", rotulo: "Clientes" },
];

/** Destino interno seguro: só caminho relativo do próprio CORTEX. */
export function destinoSeguro(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (!/^\/[A-Za-z0-9]/.test(u)) return null; // bloqueia "//site", "/\\site", "https:", "javascript:"
  if (u.length > 500 || /[\s\\]/.test(u)) return null;
  return u;
}

/** "Há 4 min", "Há 1 h", "Ontem", "12/09" — relativo ao agora. */
export function quandoRelativo(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const s = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 1000));
  if (s < 60) return "Agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `Há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24 && mesmoDia(d, agora)) return `Há ${h} h`;
  if (grupoDoDia(iso, agora) === "Ontem") return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);
}

function diaSP(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // YYYY-MM-DD
}
function mesmoDia(a: Date, b: Date) {
  return diaSP(a) === diaSP(b);
}

/** Agrupamento da central: Hoje, Ontem, Esta semana, Anteriores. */
export function grupoDoDia(iso: string, agora: Date = new Date()): "Hoje" | "Ontem" | "Esta semana" | "Anteriores" {
  const d = diaSP(new Date(iso));
  const hoje = diaSP(agora);
  if (d === hoje) return "Hoje";
  const dias = Math.round((Date.parse(hoje) - Date.parse(d)) / 86_400_000);
  if (dias === 1) return "Ontem";
  if (dias < 7) return "Esta semana";
  return "Anteriores";
}

/** Rótulo de acessibilidade do sino. */
export function rotuloDoSino(naoLidas: number): string {
  if (naoLidas <= 0) return "Notificações";
  if (naoLidas === 1) return "Notificações, 1 não lida";
  return `Notificações, ${naoLidas > 99 ? "mais de 99" : naoLidas} não lidas`;
}

export function textoDoBadge(naoLidas: number): string | null {
  if (naoLidas <= 0) return null;
  return naoLidas > 99 ? "99+" : String(naoLidas);
}
