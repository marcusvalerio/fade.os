import { createClient } from "@/lib/supabase/server";
import type { PontoSemanal } from "@/app/admin/SerieSemanal";

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
  platform_admin_revoked: "Admin de plataforma revogado",
  platform_admin_bootstrap: "Primeiro admin de plataforma",
  beta_request_created: "Pedido de Beta recebido",
  beta_request_approved: "Beta aprovado",
  beta_request_rejected: "Beta recusado",
  beta_request_revoked: "Beta revogado",
  beta_request_approval_undone: "Aprovação de Beta desfeita",
  beta_access_temporary_password_regenerated: "Senha temporária do Beta refeita",
  company_suspended: "Empresa suspensa",
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
