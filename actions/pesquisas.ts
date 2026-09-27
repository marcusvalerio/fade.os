"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { getSessionUser } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import {
  MENSAGENS_DA_PESQUISA,
  TIPOS_DE_PESQUISA,
  PUBLICOS,
  FUNCIONALIDADES,
  limparOpcoes,
  errosDaPesquisa,
  type PesquisaPendente,
} from "@/lib/pesquisas";
import type { ActionResult } from "@/actions/onboarding";

/**
 * Pesquisas in-app. O banco decide o público de quem chama pelo vínculo
 * real (papel na empresa ou conta de cliente) — a área e a empresa que
 * chegam daqui são só o contexto da tela; mandar outra empresa não dá
 * acesso a nada (PESQUISA_INDISPONIVEL).
 */

const contextoSchema = z.object({
  area: z.enum(["equipe", "cliente"]),
  empresaId: z.string().uuid(),
});

function mensagem(error: unknown): string {
  const m = String((error as { message?: string })?.message ?? "");
  return MENSAGENS_DA_PESQUISA[m] ?? friendlyMessage(error);
}

export async function buscarPesquisaPendente(area: string, empresaId: string): Promise<PesquisaPendente | null> {
  const ctx = contextoSchema.safeParse({ area, empresaId });
  if (!ctx.success || !(await getSessionUser())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pesquisa_pendente", { p_area: ctx.data.area, p_company_id: ctx.data.empresaId });
  if (error || !data?.length) return null;
  const p = data[0] as PesquisaPendente;
  return { ...p, opcoes: Array.isArray(p.opcoes) ? p.opcoes : [] };
}

export async function marcarPesquisaExibida(pesquisaId: string, area: string, empresaId: string): Promise<void> {
  const ctx = contextoSchema.safeParse({ area, empresaId });
  if (!ctx.success || !z.string().uuid().safeParse(pesquisaId).success) return;
  const supabase = await createClient();
  await supabase.rpc("marcar_pesquisa_exibida", { p_pesquisa_id: pesquisaId, p_area: ctx.data.area, p_company_id: ctx.data.empresaId });
}

export async function dispensarPesquisa(pesquisaId: string, area: string, empresaId: string): Promise<ActionResult<null>> {
  const ctx = contextoSchema.safeParse({ area, empresaId });
  if (!ctx.success || !z.string().uuid().safeParse(pesquisaId).success) return { ok: false, error: MENSAGENS_DA_PESQUISA.PESQUISA_INDISPONIVEL };
  const supabase = await createClient();
  const { error } = await supabase.rpc("dispensar_pesquisa", { p_pesquisa_id: pesquisaId, p_area: ctx.data.area, p_company_id: ctx.data.empresaId });
  if (error) return { ok: false, error: mensagem(error) };
  return { ok: true, data: null };
}

const respostaSchema = z.union([z.number(), z.boolean(), z.string().max(1000), z.array(z.string().max(200)).max(8)]);

export async function responderPesquisa(
  pesquisaId: string,
  area: string,
  empresaId: string,
  valor: unknown,
  comentario?: string
): Promise<ActionResult<null>> {
  const ctx = contextoSchema.safeParse({ area, empresaId });
  const v = respostaSchema.safeParse(valor);
  const c = z.string().max(1000).optional().safeParse(comentario);
  if (!ctx.success || !z.string().uuid().safeParse(pesquisaId).success) return { ok: false, error: MENSAGENS_DA_PESQUISA.PESQUISA_INDISPONIVEL };
  if (!v.success) return { ok: false, error: MENSAGENS_DA_PESQUISA.RESPOSTA_INVALIDA };
  if (!c.success) return { ok: false, error: MENSAGENS_DA_PESQUISA.COMENTARIO_LONGO };

  const supabase = await createClient();
  const { error } = await supabase.rpc("responder_pesquisa", {
    p_pesquisa_id: pesquisaId,
    p_area: ctx.data.area,
    p_company_id: ctx.data.empresaId,
    p_valor: v.data,
    p_comentario: c.data?.trim() || null,
  });
  if (error) return { ok: false, error: mensagem(error) };
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Administração (requirePlatformAdmin aqui e is_platform_admin no banco)
// ---------------------------------------------------------------------------

const chaves = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const dataOpcional = z
  .string()
  .trim()
  .optional()
  .transform((s) => (s ? s : null))
  .refine((s) => s === null || !Number.isNaN(new Date(s).getTime()), "Data inválida.");

const pesquisaSchema = z.object({
  id: z.string().uuid().nullable(),
  titulo: z.string().trim(),
  pergunta: z.string().trim(),
  tipo: z.enum(chaves(TIPOS_DE_PESQUISA)),
  opcoes: z.array(z.string()).max(20),
  permiteComentario: z.boolean(),
  funcionalidade: z.enum(chaves(FUNCIONALIDADES)),
  publico: z.array(z.enum(chaves(PUBLICOS))).max(3),
  publicarEm: dataOpcional,
  encerrarEm: dataOpcional,
});

export type PesquisaParaSalvar = z.input<typeof pesquisaSchema>;

export async function salvarPesquisa(entrada: PesquisaParaSalvar): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }
  const p = pesquisaSchema.safeParse(entrada);
  if (!p.success) return { ok: false, error: "Confira os campos da pesquisa." };

  const opcoes = p.data.tipo === "escolha" || p.data.tipo === "multipla" ? limparOpcoes(p.data.opcoes) : [];
  const erros = errosDaPesquisa({ ...p.data, opcoes, publicarEm: p.data.publicarEm, encerrarEm: p.data.encerrarEm });
  const primeiro = Object.values(erros)[0];
  if (primeiro) return { ok: false, error: primeiro };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_salvar_pesquisa", {
    p_id: p.data.id,
    p_titulo: p.data.titulo,
    p_pergunta: p.data.pergunta,
    p_tipo: p.data.tipo,
    p_opcoes: opcoes,
    p_permite_comentario: p.data.permiteComentario,
    p_funcionalidade: p.data.funcionalidade,
    p_publico: [...new Set(p.data.publico)],
    p_publicar_em: p.data.publicarEm,
    p_encerrar_em: p.data.encerrarEm,
  });
  if (error || !data) return { ok: false, error: mensagem(error) };
  revalidatePath("/admin/pesquisas");
  return { ok: true, data: { id: data as string } };
}

export async function mudarStatusDaPesquisa(id: string, status: "publicada" | "encerrada"): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }
  if (!z.string().uuid().safeParse(id).success || !["publicada", "encerrada"].includes(status)) {
    return { ok: false, error: MENSAGENS_DA_PESQUISA.TRANSICAO_INVALIDA };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mudar_status_pesquisa", { p_id: id, p_status: status });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath("/admin/pesquisas");
  revalidatePath(`/admin/pesquisas/${id}`);
  return { ok: true, data: null };
}

export async function excluirRascunhoDePesquisa(id: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: MENSAGENS_DA_PESQUISA.PESQUISA_NAO_ENCONTRADA };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_excluir_rascunho_pesquisa", { p_id: id });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath("/admin/pesquisas");
  return { ok: true, data: null };
}
