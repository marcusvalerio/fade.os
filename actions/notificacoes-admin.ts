"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { friendlyMessage } from "@/lib/errors";
import { reportarErro } from "@/lib/observabilidade";
import { entregarPushPendentes } from "@/lib/notificacoes/servidor";
import { TIPOS_COMUNICAVEIS, destinoSeguro } from "@/lib/notificacoes/catalogo";
import type { ActionResult } from "@/actions/onboarding";

/**
 * Comunicados e pesquisas enviadas pelo Admin. Duas barreiras:
 * requirePlatformAdmin aqui e is_platform_admin em cada função do banco
 * (que também audita em platform_audit_log). Não existe endpoint público de
 * disparo: tudo passa por estas ações, com sessão de admin.
 */

const MENSAGENS: Record<string, string> = {
  FORBIDDEN: "Só administradores da plataforma podem enviar comunicados.",
  TIPO_NAO_COMUNICAVEL: "Este tipo de notificação não pode ser enviado pelo Admin.",
  PRIORIDADE_NAO_PERMITIDA: "Prioridade não permitida para este tipo (crítica só em manutenção; produto até normal).",
  URL_INVALIDA: "A ação precisa ser um caminho do CORTEX, começando com /.",
  DESTINO_INVALIDO: "Escolha ao menos um público.",
  DATA_NO_PASSADO: "A data de envio já passou.",
  COMUNICADO_NAO_EDITAVEL: "Só rascunhos podem ser editados.",
  COMUNICADO_INDISPONIVEL: "Este comunicado não pode mais ser enviado ou cancelado.",
  LIMITE_DE_ENVIOS: "Limite de 3 comunicados de produto por dia atingido. Agende para amanhã.",
  PESQUISA_NAO_PUBLICADA: "Publique a pesquisa antes de enviar.",
  PESQUISA_JA_ENVIADA: "Esta pesquisa já foi enviada como notificação.",
};

function mensagem(error: unknown) {
  const m = String((error as { message?: string })?.message ?? "");
  const conhecida = Object.keys(MENSAGENS).find((k) => m.includes(k));
  return conhecida ? MENSAGENS[conhecida] : friendlyMessage(error);
}

const papelSchema = z.enum(["owner", "admin", "staff", "cliente"]);
const dataSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((s) => (s ? s : null))
  .refine((s) => s === null || !Number.isNaN(Date.parse(s)), "Data inválida.");

const comunicadoSchema = z.object({
  id: z.string().uuid().nullable(),
  titulo: z.string().trim().min(3, "Título curto demais.").max(90, "Título com mais de 90 caracteres."),
  mensagem: z.string().trim().min(3, "Mensagem curta demais.").max(300, "Mensagem com mais de 300 caracteres."),
  tipo: z.enum(TIPOS_COMUNICAVEIS.map((t) => t.chave) as [string, ...string[]]),
  prioridade: z.enum(["critical", "important", "normal", "informational"]),
  url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((s) => (s ? s : null))
    .refine((s) => s === null || destinoSeguro(s) !== null, "A ação precisa ser um caminho do CORTEX, começando com /."),
  papeis: z.array(papelSchema).min(1, "Escolha ao menos um público.").max(4),
  empresas: z.array(z.string().uuid()).max(200).nullable(),
  enviarEm: dataSchema,
});

export type ComunicadoParaSalvar = z.input<typeof comunicadoSchema>;

async function exigirAdmin(): Promise<string | null> {
  try {
    await requirePlatformAdmin();
    return null;
  } catch (e) {
    return friendlyMessage(e);
  }
}

export async function salvarComunicado(entrada: ComunicadoParaSalvar): Promise<ActionResult<{ id: string }>> {
  const negado = await exigirAdmin();
  if (negado) return { ok: false, error: negado };
  const c = comunicadoSchema.safeParse(entrada);
  if (!c.success) return { ok: false, error: c.error.issues[0]?.message ?? "Confira os campos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_salvar_comunicado", {
    p_id: c.data.id,
    p_titulo: c.data.titulo,
    p_mensagem: c.data.mensagem,
    p_tipo: c.data.tipo,
    p_prioridade: c.data.prioridade,
    p_url: c.data.url,
    p_papeis: c.data.papeis,
    p_empresas: c.data.empresas?.length ? c.data.empresas : null,
    p_enviar_em: c.data.enviarEm ? new Date(c.data.enviarEm).toISOString() : null,
  });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath("/admin/notificacoes");
  return { ok: true, data: { id: data as string } };
}

type ResultadoDoEnvio = { destinatarios?: number; limitados?: number; ignorados?: number; agendado?: string };

export async function enviarComunicado(id: string): Promise<ActionResult<ResultadoDoEnvio>> {
  const negado = await exigirAdmin();
  if (negado) return { ok: false, error: negado };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: MENSAGENS.COMUNICADO_INDISPONIVEL };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_enviar_comunicado", { p_id: id });
  if (error) {
    if (!Object.keys(MENSAGENS).some((k) => error.message.includes(k))) reportarErro(error, "notificacoes.comunicado_enviar");
    return { ok: false, error: mensagem(error) };
  }
  after(() => entregarPushPendentes({ limite: 500 }));
  revalidatePath("/admin/notificacoes");
  return { ok: true, data: data as ResultadoDoEnvio };
}

export async function cancelarComunicado(id: string): Promise<ActionResult<null>> {
  const negado = await exigirAdmin();
  if (negado) return { ok: false, error: negado };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: MENSAGENS.COMUNICADO_INDISPONIVEL };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancelar_comunicado", { p_id: id });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath("/admin/notificacoes");
  return { ok: true, data: null };
}

export async function previaDoComunicado(papeis: string[], empresas: string[] | null): Promise<Record<string, number> | null> {
  if (await exigirAdmin()) return null;
  const p = z.array(papelSchema).min(1).safeParse(papeis);
  const e = z.array(z.string().uuid()).nullable().safeParse(empresas);
  if (!p.success || !e.success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_previa_comunicado", { p_papeis: p.data, p_empresas: e.data?.length ? e.data : null });
  if (error) return null;
  return data as Record<string, number>;
}

const envioDePesquisaSchema = z.object({
  pesquisaId: z.string().uuid(),
  titulo: z.string().trim().min(3, "Título curto demais.").max(90, "Título com mais de 90 caracteres."),
  mensagem: z.string().trim().min(3, "Mensagem curta demais.").max(300, "Mensagem com mais de 300 caracteres."),
  empresas: z.array(z.string().uuid()).max(200).nullable(),
  enviarEm: dataSchema,
});

export async function enviarPesquisaComoNotificacao(
  entrada: z.input<typeof envioDePesquisaSchema>
): Promise<ActionResult<ResultadoDoEnvio>> {
  const negado = await exigirAdmin();
  if (negado) return { ok: false, error: negado };
  const e = envioDePesquisaSchema.safeParse(entrada);
  if (!e.success) return { ok: false, error: e.error.issues[0]?.message ?? "Confira os campos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_enviar_pesquisa", {
    p_pesquisa_id: e.data.pesquisaId,
    p_titulo: e.data.titulo,
    p_mensagem: e.data.mensagem,
    p_empresas: e.data.empresas?.length ? e.data.empresas : null,
    p_enviar_em: e.data.enviarEm ? new Date(e.data.enviarEm).toISOString() : null,
  });
  if (error) {
    if (!Object.keys(MENSAGENS).some((k) => error.message.includes(k))) reportarErro(error, "notificacoes.pesquisa_enviar");
    return { ok: false, error: mensagem(error) };
  }
  after(() => entregarPushPendentes({ limite: 500 }));
  revalidatePath(`/admin/pesquisas/${e.data.pesquisaId}`);
  revalidatePath("/admin/notificacoes");
  return { ok: true, data: data as ResultadoDoEnvio };
}
