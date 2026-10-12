import { createClient } from "@/lib/supabase/server";
import type { PontoSemanal } from "@/app/admin/SerieSemanal";
import type { TipoDePesquisa, Funcionalidade, Publico, StatusDaPesquisa } from "@/lib/pesquisas";

/**
 * Leituras do CORTEX ADMIN. Cada uma chama uma função SECURITY DEFINER que
 * confere is_platform_admin no próprio banco (FORBIDDEN para qualquer outro)
 * — a proteção não depende desta camada nem do layout.
 */

export type VisaoDaPlataforma = {
  dias: number;
  empresas: number;
  empresas_ativas: number;
  empresas_suspensas: number;
  empresas_novas: number;
  empresas_com_movimento: number;
  empresas_sem_onboarding: number;
  usuarios: number;
  usuarios_ativos: number;
  usuarios_novos: number;
  profissionais: number;
  clientes: number;
  contas_de_cliente: number;
  agendamentos: number;
  agendamentos_periodo: number;
  atendimentos_periodo: number;
  vendas_periodo: number;
  receita_periodo: number;
  receita_total: number;
  beta_pendentes: number;
  serie: PontoSemanal[];
};

export type AtividadeDaEmpresa = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
  onboarding_completed: boolean;
  usuarios: number;
  profissionais: number;
  clientes: number;
  agendamentos_periodo: number;
  atendimentos_periodo: number;
  receita_periodo: number;
  receita_total: number;
  ultima_atividade: string | null;
  modulos_usados: number;
};

export type UsoDoModulo = { modulo: string; empresas: number; registros: number; ultima: string | null };

export type UsuarioDetalhado = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  providers: string[];
  ultimo_metodo: string | null;
  empresas: { id: string; nome: string; papel: string }[];
  cliente_em: number;
  is_platform_admin: boolean;
  banido: boolean;
};

export type EventoDeAuditoria = {
  origem: "plataforma" | "empresa";
  acao: string;
  entidade: string;
  empresa: string | null;
  ator: string | null;
  motivo: string | null;
  criado_em: string;
};

const n = (v: unknown) => Number(v ?? 0);

export async function visaoDaPlataforma(dias = 30): Promise<VisaoDaPlataforma | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_overview", { p_days: dias });
  if (error || !data) return null;
  return data as VisaoDaPlataforma;
}

export async function atividadeDasEmpresas(dias = 30): Promise<AtividadeDaEmpresa[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_company_activity", { p_days: dias });
  if (error) return null;
  return ((data ?? []) as AtividadeDaEmpresa[]).map((e) => ({
    ...e,
    name: e.name.trim(),
    usuarios: n(e.usuarios),
    profissionais: n(e.profissionais),
    clientes: n(e.clientes),
    agendamentos_periodo: n(e.agendamentos_periodo),
    atendimentos_periodo: n(e.atendimentos_periodo),
    receita_periodo: n(e.receita_periodo),
    receita_total: n(e.receita_total),
  }));
}

export async function usoDosModulos(dias = 30): Promise<UsoDoModulo[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_module_usage", { p_days: dias });
  if (error) return null;
  return ((data ?? []) as UsoDoModulo[]).map((m) => ({ ...m, empresas: n(m.empresas), registros: n(m.registros) }));
}

export async function usuariosDetalhados(): Promise<UsuarioDetalhado[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users_detailed");
  if (error) return null;
  return (data ?? []) as UsuarioDetalhado[];
}

export async function feedDeAuditoria(limite = 150): Promise<EventoDeAuditoria[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_audit_feed", { p_limit: limite });
  if (error) return null;
  return (data ?? []) as EventoDeAuditoria[];
}

/** "há 3 dias", "há 2 h", "agora" — relativo e curto, como num console. */
export function haQuanto(iso: string | null, agora = Date.now()): string {
  if (!iso) return "nunca";
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 60) return `há ${d} dias`;
  return `há ${Math.round(d / 30)} meses`;
}

export const ROTULO_DA_ACAO: Record<string, string> = {
  platform_admin_granted: "Admin de plataforma concedido",
  pilot_created: "Piloto criado",
  pilot_closed: "Piloto encerrado",
  pilot_cancelled: "Piloto cancelado",
  pilot_snapshot_refreshed: "Retrato do piloto atualizado",
  platform_admin_revoked: "Admin de plataforma revogado",
  platform_admin_bootstrap: "Primeiro admin de plataforma",
  beta_request_created: "Pedido de Beta recebido",
  beta_request_approved: "Beta aprovado",
  beta_request_rejected: "Beta recusado",
  beta_request_revoked: "Beta revogado",
  beta_request_approval_undone: "Aprovação de Beta desfeita",
  beta_access_temporary_password_regenerated: "Senha temporária do Beta refeita",
  company_suspended: "Empresa suspensa",
  client_reschedule_appointment: "Cliente reagendou pelo link",
  survey_created: "Pesquisa criada",
  survey_updated: "Pesquisa editada",
  survey_published: "Pesquisa publicada",
  survey_notification_created: "Pesquisa enviada como notificação",
  notification_campaign_saved: "Comunicado salvo",
  notification_campaign_scheduled: "Comunicado agendado",
  notification_campaign_sent: "Comunicado enviado",
  notification_campaign_cancelled: "Comunicado cancelado",
  survey_closed: "Pesquisa encerrada",
  survey_deleted: "Rascunho de pesquisa excluído",
  company_reactivated: "Empresa reativada",
  create_pdv_sale: "Venda de balcão",
  close_attendance: "Atendimento fechado",
  adjust_stock: "Ajuste de estoque",
  close_cash_session: "Caixa fechado",
  cancel_sale: "Venda cancelada",
  regenerate_authorization_code: "Código de autorização trocado",
  mark_commission_paid: "Comissão paga",
  update_price: "Preço alterado",
  reschedule_appointment: "Horário reagendado",
};

export const ROTULO_DO_METODO: Record<string, string> = {
  password: "e-mail e senha",
  oauth: "Google",
  otp: "link por e-mail",
  recovery: "recuperação de senha",
  magiclink: "link mágico",
  "email/signup": "confirmação de cadastro",
  token_refresh: "renovação de sessão",
};

// ---------------------------------------------------------------------------
// Pesquisas e beta
// ---------------------------------------------------------------------------

export type PesquisaNoAdmin = {
  id: string;
  titulo: string;
  pergunta: string;
  tipo: TipoDePesquisa;
  opcoes: string[];
  permite_comentario: boolean;
  funcionalidade: Funcionalidade;
  publico: Publico[];
  status: StatusDaPesquisa;
  publicar_em: string | null;
  encerrar_em: string | null;
  criada_em: string;
  publicada_em: string | null;
  encerrada_em: string | null;
  exibicoes: number;
  respostas: number;
  dispensas: number;
  ultima_resposta: string | null;
};

export type ResultadoDaPesquisa = {
  /** receberam o aviso (notificação) */
  enviados: number;
  /** viram a pesquisa (cartão ou página) */
  exibicoes: number;
  /** começaram a responder */
  iniciados: number;
  respostas: number;
  dispensas: number;
  empresas: number;
  media: number | null;
  por_publico: Partial<Record<Publico, { enviados: number; exibicoes: number; iniciados: number; respostas: number }>>;
  distribuicao: { valor: string | number | boolean; total: number; por_publico: Partial<Record<Publico, number>> }[];
  comentarios: {
    texto: string;
    complemento: string | null;
    valor: string | number | boolean | string[] | null;
    publico: Publico;
    empresa: string | null;
    em: string;
  }[];
};

export async function pesquisasDoAdmin(): Promise<PesquisaNoAdmin[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_listar_pesquisas");
  if (error) return null;
  return ((data ?? []) as PesquisaNoAdmin[]).map((p) => ({
    ...p,
    exibicoes: n(p.exibicoes),
    respostas: n(p.respostas),
    dispensas: n(p.dispensas),
  }));
}

export async function resultadoDaPesquisa(id: string): Promise<ResultadoDaPesquisa | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_resultado_pesquisa", { p_id: id });
  if (error || !data) return null;
  const r = data as ResultadoDaPesquisa;
  return { ...r, media: r.media === null ? null : Number(r.media) };
}

export type EstadoNoBeta = "ativa" | "esfriando" | "parada" | "sem_uso" | "configurando" | "suspensa";

export type EmpresaNoBeta = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  onboarding_completed: boolean;
  entrou_em: string;
  origem: "convite_beta" | "cadastro_direto";
  beta_status: string | null;
  beta_expira_em: string | null;
  ultimo_acesso: string | null;
  dias_sem_acesso: number | null;
  ultima_atividade: string | null;
  dias_sem_atividade: number | null;
  modulos_usados: number;
  agendamentos_periodo: number;
  atendimentos_periodo: number;
  pesquisas_respondidas: number;
  comentarios: number;
  ultima_resposta: string | null;
  usuarios: number;
  estado: EstadoNoBeta;
};

export async function empresasNoBeta(dias = 30): Promise<EmpresaNoBeta[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_beta_empresas", { p_days: dias });
  if (error) return null;
  return ((data ?? []) as EmpresaNoBeta[]).map((e) => ({
    ...e,
    name: e.name.trim(),
    agendamentos_periodo: n(e.agendamentos_periodo),
    atendimentos_periodo: n(e.atendimentos_periodo),
    pesquisas_respondidas: n(e.pesquisas_respondidas),
    comentarios: n(e.comentarios),
    usuarios: n(e.usuarios),
  }));
}

// ---------------------------------------------------------------------------
// Pulso por janela e matriz de uso
// ---------------------------------------------------------------------------

export type JanelaDoPulso = "hoje" | "7d" | "30d";

export type MedidasDoPulso = {
  empresas_com_movimento: number;
  agendamentos: number;
  atendimentos: number;
  vendas: number;
  receita: number;
  empresas_novas: number;
  contas_de_cliente_novas: number;
  clientes_novos: number;
  pesquisas_respondidas: number;
  pedidos_beta: number;
};

export type PontoDiarioDaPlataforma = {
  dia: string;
  agendamentos: number;
  atendimentos: number;
  receita: number;
  empresas_com_movimento: number;
};

export type PulsoDaPlataforma = {
  janela: JanelaDoPulso;
  inicio: string;
  inicio_anterior: string;
  fim_anterior: string;
  atual: MedidasDoPulso;
  anterior: MedidasDoPulso;
  usuarios_que_entraram: number;
  beta_pendentes: number;
  serie: PontoDiarioDaPlataforma[];
};

const medidas = (m: MedidasDoPulso): MedidasDoPulso =>
  Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, n(v)])) as MedidasDoPulso;

export async function pulsoDaPlataforma(janela: JanelaDoPulso): Promise<PulsoDaPlataforma | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_pulso_da_plataforma", { p_janela: janela });
  if (error || !data) return null;
  const p = data as PulsoDaPlataforma;
  return {
    ...p,
    atual: medidas(p.atual),
    anterior: medidas(p.anterior),
    usuarios_que_entraram: n(p.usuarios_que_entraram),
    beta_pendentes: n(p.beta_pendentes),
    serie: (p.serie ?? []).map((d) => ({ ...d, agendamentos: n(d.agendamentos), atendimentos: n(d.atendimentos), receita: n(d.receita), empresas_com_movimento: n(d.empresas_com_movimento) })),
  };
}

export const MODULOS_DA_MATRIZ = [
  "Agenda",
  "Reagendamento",
  "Atendimento",
  "Nova venda (balcão)",
  "Caixa",
  "Estoque (manual)",
  "Financeiro (manual)",
  "Comissões pagas",
  "Clientes cadastrados",
  "Conta do cliente",
  "Avaliações",
] as const;

export type LinhaDaMatriz = {
  company_id: string;
  name: string;
  status: "active" | "suspended";
  onboarding_completed: boolean;
  criada_em: string;
  uso: Partial<Record<(typeof MODULOS_DA_MATRIZ)[number], number>>;
};

export async function matrizDeUso(dias = 30): Promise<LinhaDaMatriz[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_matriz_de_uso", { p_days: dias });
  if (error) return null;
  return ((data ?? []) as LinhaDaMatriz[]).map((l) => ({ ...l, name: l.name.trim() }));
}

export type ComunicadoNoAdmin = {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  prioridade: "critical" | "important" | "normal" | "informational";
  url: string | null;
  papeis: ("owner" | "admin" | "staff" | "cliente")[];
  empresas: string[] | null;
  pesquisa_id: string | null;
  pesquisa_titulo: string | null;
  enviar_em: string | null;
  status: "rascunho" | "agendado" | "enviando" | "enviado" | "cancelado";
  criado_em: string;
  enviado_em: string | null;
  destinatarios: number;
  limitados: number;
  ignorados: number;
  lidas: number;
  abertas: number;
  push_enviados: number;
};

export async function comunicadosDoAdmin(): Promise<ComunicadoNoAdmin[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_listar_comunicados");
  if (error) return null;
  return ((data ?? []) as ComunicadoNoAdmin[]).map((c) => ({
    ...c,
    lidas: Number(c.lidas),
    abertas: Number(c.abertas),
    push_enviados: Number(c.push_enviados),
  }));
}

// ---------------------------------------------------------------------------
// Saúde: notificações/push, jobs, funil do Beta, investigação da empresa
// ---------------------------------------------------------------------------

export type JobDaPlataforma = {
  nome: string;
  agenda: string;
  ativo: boolean;
  ultima_execucao: string | null;
  ultimo_status: string | null;
  duracao_ms: number | null;
  falhas_24h: number;
  execucoes_24h: number;
};

export type SaudeDasNotificacoes = {
  criadas_24h: number;
  abertas_24h: number;
  push_24h: Partial<Record<"enviada" | "falhou" | "token_invalido" | "pendente" | "enviando" | "sem_dispositivo", number>>;
  push_presas: number;
  aparelhos_ativos: number;
  pessoas_com_push: number;
  despertar_configurado: boolean;
  vault_url?: boolean;
  vault_segredo?: boolean;
  realtime_notificacao?: boolean;
  ultimo_envio_push?: string | null;
  ultima_falha_push?: { em: string | null; status: string; erro: string | null } | null;
  meu_push?: { ativo: boolean; aparelhos: number; ultimo_envio: string | null };
  despertar: { chamadas_1h: number | null; erros_1h: number | null };
  jobs: JobDaPlataforma[];
  avisos_7d: Record<string, number>;
};

export async function saudeDasNotificacoes(): Promise<SaudeDasNotificacoes | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_saude_notificacoes");
  if (error || !data) return null;
  return data as SaudeDasNotificacoes;
}

export type DificuldadeNoBeta = {
  pesquisa: string;
  pesquisa_id: string;
  funcionalidade: string | null;
  texto: string | null;
  negativa: boolean;
  publico: string;
  empresa: string | null;
  empresa_id: string | null;
  em: string;
};

export type FunilDoBetaNoBanco = {
  solicitacoes: Partial<Record<"pending" | "approved" | "rejected" | "revoked", number>>;
  recebidas_30d: number;
  aguardando_48h: number;
  pendente_mais_antiga: string | null;
  horas_ate_aprovar: number | null;
  funcionalidades: { funcionalidade: string; respostas: number; negativas: number; media: number | null }[];
  dificuldades: DificuldadeNoBeta[];
};

export async function funilDoBetaNoBanco(): Promise<FunilDoBetaNoBanco | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_beta_funil");
  if (error || !data) return null;
  return data as FunilDoBetaNoBanco;
}

export type InvestigacaoDaEmpresa = {
  beta: { status: string; pedido_em: string; aprovado_em: string | null; expira_em: string | null; regiao: string | null } | null;
  pesquisas: { exibidas: number; respondidas: number; dispensadas: number };
  comentarios: { pesquisa: string; pesquisa_id: string; tipo: string; texto: string | null; valor: unknown; publico: string; em: string }[];
  notificacoes_30d: { categoria: string; total: number; abertas: number }[];
  historico: { tipo: string; titulo: string; prioridade: string; destinatarios: number; em: string }[];
  push: { pessoas: number; com_push: number; aparelhos: number };
  incidentes: { tipo: string; titulo: string; corpo: string; url: string | null; em: string }[];
};

export async function investigacaoDaEmpresa(id: string): Promise<InvestigacaoDaEmpresa | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_empresa_investigacao", { p_company: id });
  if (error || !data) return null;
  return data as InvestigacaoDaEmpresa;
}

// ---------------------------------------------------------------------------
// Pilotos (acompanhamento interno; só leitura para o Admin)
// ---------------------------------------------------------------------------

export type PilotoNaLista = {
  id: string;
  nome: string;
  status: import("@/lib/piloto").StatusDoPiloto;
  inicio: string;
  fim: string;
  company_id: string;
  empresa: string;
  criado_em: string;
  hoje: string;
  dias_registrados: number;
  ultimo: {
    dia: string;
    dia_do_piloto: number;
    final: boolean;
    capturado_em: string;
    usuarios_ativos: number | null;
    ultimo_acesso: string | null;
    operacoes: number | null;
    valor: number | null;
  } | null;
};

export async function pilotosDoAdmin(): Promise<PilotoNaLista[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_listar_pilotos");
  if (error) return null;
  return (data ?? []) as PilotoNaLista[];
}

export type DetalheDoPiloto = {
  piloto: {
    id: string;
    company_id: string;
    empresa: string;
    slug: string;
    nome: string;
    objetivo: string | null;
    inicio: string;
    fim: string;
    status: import("@/lib/piloto").StatusDoPiloto;
    criado_em: string;
    encerrado_em: string | null;
    motivo_encerramento: string | null;
  };
  hoje: string;
  snapshots: import("@/lib/piloto").SnapshotDoPiloto[];
  usuarios: { user_id: string; email: string; papel: string; profissional: string | null; ultimo_acesso: string | null }[];
  mapa_sessoes: { dow: number; hora: number; usuarios: number }[];
};

export async function detalheDoPiloto(id: string): Promise<DetalheDoPiloto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_piloto_detalhe", { p_id: id });
  if (error || !data) return null;
  return data as DetalheDoPiloto;
}
