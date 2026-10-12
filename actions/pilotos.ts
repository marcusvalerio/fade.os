"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

/**
 * Pilotos: criar, atualizar o retrato de hoje, encerrar. Duas barreiras
 * (requirePlatformAdmin aqui e is_platform_admin no banco) e tudo auditado
 * em platform_audit_log pelas próprias funções. Nada aqui toca em dado
 * operacional da barbearia.
 */

const MENSAGENS: Record<string, string> = {
  FORBIDDEN: "Só administradores da plataforma podem mexer em pilotos.",
  EMPRESA_NAO_ENCONTRADA: "Empresa não encontrada.",
  DURACAO_INVALIDA: "A duração precisa ficar entre 1 e 90 dias.",
  INICIO_INVALIDO: "O início precisa ser hoje ou nos próximos 60 dias.",
  PILOTO_JA_ABERTO: "Esta empresa já tem um piloto planejado ou em andamento.",
  PILOTO_NAO_ABERTO: "Este piloto já foi encerrado.",
  MOTIVO_OBRIGATORIO: "Escreva o motivo do encerramento.",
};

function mensagem(error: unknown) {
  const m = String((error as { message?: string })?.message ?? "");
  const conhecida = Object.keys(MENSAGENS).find((k) => m.includes(k));
  return conhecida ? MENSAGENS[conhecida] : friendlyMessage(error);
}

const novoSchema = z.object({
  empresa: z.string().uuid("Escolha uma empresa."),
  nome: z.string().trim().min(3, "Nome curto demais.").max(90, "Nome com mais de 90 caracteres."),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início inválida."),
  dias: z.coerce.number().int().min(1).max(90),
  objetivo: z.string().trim().max(500).optional().nullable(),
});

export async function criarPiloto(entrada: z.input<typeof novoSchema>): Promise<ActionResult<{ id: string }>> {
  await requirePlatformAdmin();
  const p = novoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_criar_piloto", {
    p_company: p.data.empresa,
    p_nome: p.data.nome,
    p_inicio: p.data.inicio,
    p_dias: p.data.dias,
    p_objetivo: p.data.objetivo || null,
  });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath("/admin/pilotos");
  return { ok: true, data: { id: data as string } };
}

export async function capturarPiloto(id: string): Promise<ActionResult<null>> {
  await requirePlatformAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Piloto inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_capturar_piloto", { p_id: id });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath(`/admin/pilotos/${id}`);
  return { ok: true, data: null };
}

export async function encerrarPiloto(id: string, motivo: string, cancelar: boolean): Promise<ActionResult<null>> {
  await requirePlatformAdmin();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Piloto inválido." };
  const m = z.string().trim().min(3, MENSAGENS.MOTIVO_OBRIGATORIO).max(300).safeParse(motivo);
  if (!m.success) return { ok: false, error: m.error.issues[0]?.message ?? MENSAGENS.MOTIVO_OBRIGATORIO };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_encerrar_piloto", { p_id: id, p_motivo: m.data, p_cancelar: !!cancelar });
  if (error) return { ok: false, error: mensagem(error) };
  revalidatePath(`/admin/pilotos/${id}`);
  revalidatePath("/admin/pilotos");
  return { ok: true, data: null };
}
