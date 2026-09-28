"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import { reportarErro } from "@/lib/observabilidade";
import { entregarPushPendentes } from "@/lib/notificacoes/servidor";
import type { Categoria, Prioridade, Publico } from "@/lib/notificacoes/catalogo";
import type { ActionResult } from "@/actions/onboarding";

/**
 * Central de notificações, preferências e aparelhos de quem está logado.
 *
 * Toda leitura e escrita passa por função do banco que filtra por
 * auth.uid(): a área e a empresa que chegam daqui só recortam as
 * notificações da PRÓPRIA pessoa (mandar outra empresa não mostra nada de
 * ninguém). Nenhuma ação aqui cria notificação.
 */

const areaSchema = z.enum(["equipe", "cliente", "plataforma"]);
const idSchema = z.string().uuid();

export type NotificacaoDaCentral = {
  id: string;
  tipo: string;
  categoria: Categoria;
  prioridade: Prioridade;
  titulo: string;
  corpo: string;
  url: string | null;
  criada_em: string;
  lida_em: string | null;
  pesquisa_id: string | null;
};

const MENSAGENS: Record<string, string> = {
  PREFERENCIA_OBRIGATORIA: "Este aviso é essencial e não pode ser desligado.",
  PREFERENCIA_INDISPONIVEL: "Esta opção não vale para o seu acesso.",
  TOKEN_INVALIDO: "Este navegador não entregou um identificador válido. Tente de novo.",
  NAO_AUTENTICADO: "Sua sessão expirou. Entre de novo.",
};

function mensagem(error: unknown) {
  const m = String((error as { message?: string })?.message ?? "");
  return MENSAGENS[m] ?? friendlyMessage(error);
}

/**
 * Contador do sino. Também é o "despertador" do envio de push quando o banco
 * ainda não tem o endereço do servidor (ver notificacoes_despertar_envio):
 * depois de responder, processa a fila — no máximo uma vez a cada 20 s por
 * instância.
 */
export async function contarNaoLidas(area: string, empresaId: string | null): Promise<number> {
  const a = areaSchema.safeParse(area);
  if (!a.success || (empresaId !== null && !idSchema.safeParse(empresaId).success)) return 0;
  if (!(await getSessionUser())) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contar_notificacoes_nao_lidas", { p_area: a.data, p_company: empresaId });
  after(() => entregarPushPendentes({ intervaloMinimoMs: 20_000 }));
  if (error) return 0;
  return Number(data ?? 0);
}

export async function listarNotificacoes(
  area: string,
  empresaId: string | null,
  opcoes: { somenteNaoLidas?: boolean; antes?: string | null; limite?: number } = {}
): Promise<NotificacaoDaCentral[]> {
  const a = areaSchema.safeParse(area);
  if (!a.success || (empresaId !== null && !idSchema.safeParse(empresaId).success)) return [];
  const antes = opcoes.antes && !Number.isNaN(Date.parse(opcoes.antes)) ? opcoes.antes : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("minhas_notificacoes", {
    p_area: a.data,
    p_company: empresaId,
    p_somente_nao_lidas: !!opcoes.somenteNaoLidas,
    p_limite: Math.min(Math.max(opcoes.limite ?? 30, 1), 100),
    p_antes: antes,
  });
  if (error) {
    reportarErro(error, "notificacoes.listar", { area: a.data });
    return [];
  }
  return (data ?? []) as NotificacaoDaCentral[];
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  if (!idSchema.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.rpc("marcar_notificacao_lida", { p_id: id });
}

export async function marcarTodasComoLidas(area: string, empresaId: string | null): Promise<number> {
  const a = areaSchema.safeParse(area);
  if (!a.success || (empresaId !== null && !idSchema.safeParse(empresaId).success)) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("marcar_notificacoes_lidas", { p_area: a.data, p_company: empresaId });
  return Number(data ?? 0);
}

export async function arquivarNotificacao(id: string): Promise<void> {
  if (!idSchema.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.rpc("arquivar_notificacao", { p_id: id });
}

// ---------------------------------------------------------------------------
// Preferências
// ---------------------------------------------------------------------------

export type MinhaPreferencia = { preferencia: string; categoria: Categoria; obrigatoria: boolean; ativa: boolean; publicos: Publico[] };
export type MeuAjuste = { push_ativo: boolean; push_permissao: "default" | "granted" | "denied" | "unsupported" | null; aparelhos: number };

export async function lerMinhasPreferencias(): Promise<{ preferencias: MinhaPreferencia[]; ajuste: MeuAjuste }> {
  const vazio = { preferencias: [], ajuste: { push_ativo: false, push_permissao: null, aparelhos: 0 } };
  if (!(await getSessionUser())) return vazio;
  const supabase = await createClient();
  const [prefs, ajuste] = await Promise.all([supabase.rpc("minhas_preferencias_notificacao"), supabase.rpc("meu_ajuste_de_notificacao")]);
  if (prefs.error || ajuste.error) {
    reportarErro(prefs.error ?? ajuste.error, "notificacoes.preferencias");
    return vazio;
  }
  return {
    preferencias: (prefs.data ?? []) as MinhaPreferencia[],
    ajuste: ((ajuste.data ?? [])[0] ?? vazio.ajuste) as MeuAjuste,
  };
}

export async function definirPreferencia(preferencia: string, ativa: boolean): Promise<ActionResult<null>> {
  const p = z.string().regex(/^[a-z]+\.[a-z_]+$/).safeParse(preferencia);
  if (!p.success || typeof ativa !== "boolean") return { ok: false, error: MENSAGENS.PREFERENCIA_INDISPONIVEL };
  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_preferencia_notificacao", { p_preferencia: p.data, p_ativa: ativa });
  if (error) return { ok: false, error: mensagem(error) };
  return { ok: true, data: null };
}

const permissaoSchema = z.enum(["default", "granted", "denied", "unsupported"]).nullable();

/** Liga/desliga o push da pessoa (em todos os aparelhos) e guarda o estado do navegador. */
export async function definirPush(ativo: boolean, permissao: string | null): Promise<ActionResult<null>> {
  const p = permissaoSchema.safeParse(permissao);
  if (typeof ativo !== "boolean" || !p.success) return { ok: false, error: "Estado de permissão inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_push_notificacao", { p_ativo: ativo, p_permissao: p.data });
  if (error) return { ok: false, error: mensagem(error) };
  return { ok: true, data: null };
}

const tokenSchema = z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:\-.]+$/);

export async function registrarAparelho(token: string, rotulo: string | null): Promise<ActionResult<null>> {
  const t = tokenSchema.safeParse(token);
  const r = z.string().max(80).nullable().safeParse(rotulo);
  if (!t.success || !r.success) return { ok: false, error: MENSAGENS.TOKEN_INVALIDO };
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_dispositivo_push", { p_token: t.data, p_rotulo: r.data });
  if (error) {
    reportarErro(error, "push.registrar_aparelho");
    return { ok: false, error: mensagem(error) };
  }
  return { ok: true, data: null };
}

export async function removerAparelho(token: string): Promise<void> {
  const t = tokenSchema.safeParse(token);
  if (!t.success) return;
  const supabase = await createClient();
  await supabase.rpc("remover_dispositivo_push", { p_token: t.data });
}
