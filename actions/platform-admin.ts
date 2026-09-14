"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const DOMAIN_MESSAGES: Record<string, string> = {
  SOLICITACAO_NAO_ENCONTRADA: "Solicitação não encontrada.",
  SOLICITACAO_JA_PROCESSADA: "Esta solicitação já foi decidida.",
  SOLICITACAO_NAO_APROVADA: "Só é possível revogar uma solicitação aprovada.",
  USUARIO_NAO_ENCONTRADO: "Usuário não encontrado.",
  NAO_PODE_REVOGAR_A_SI_MESMO: "Você não pode revogar o próprio acesso de platform admin.",
  PLATFORM_ADMIN_NAO_ENCONTRADO: "Este usuário não é platform admin.",
  PERIODO_INVALIDO: "Informe um período de Beta entre 1 e 24 meses.",
  EMPRESA_NAO_ENCONTRADA: "Empresa não encontrada.",
  EMPRESA_JA_SUSPENSA: "Esta empresa já está suspensa.",
  EMPRESA_NAO_ESTA_SUSPENSA: "Esta empresa não está suspensa.",
  MOTIVO_OBRIGATORIO: "Informe o motivo da suspensão.",
};

function domainOrFriendly(error: unknown): string {
  const message = String((error as { message?: string })?.message ?? "");
  return DOMAIN_MESSAGES[message] ?? friendlyMessage(error);
}

const reasonSchema = z.string().trim().max(500).optional();

/**
 * Todas as ações abaixo chamam requirePlatformAdmin() de novo, mesmo que o
 * layout de /admin já tenha checado — uma Server Action é um endpoint HTTP
 * e pode ser chamada direto, sem passar pela tela.
 */
export async function approveBetaRequest(
  id: string,
  reason?: string,
  periodMonths?: number
): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const parsedPeriod = z.number().int().min(1).max(24).default(2).safeParse(periodMonths ?? 2);
  if (!parsedPeriod.success) return { ok: false, error: DOMAIN_MESSAGES.PERIODO_INVALIDO };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_beta_access_request", {
    p_id: id,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
    p_period_months: parsedPeriod.data,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/acessos");
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export async function rejectBetaRequest(id: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_beta_access_request", {
    p_id: id,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/acessos");
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export async function revokeBetaRequest(id: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_beta_access_request", {
    p_id: id,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/acessos");
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export async function grantPlatformAdminAccess(userId: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_platform_admin", {
    p_user_id: userId,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/usuarios");
  return { ok: true, data: null };
}

export async function revokePlatformAdminAccess(userId: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_platform_admin", {
    p_user_id: userId,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/usuarios");
  return { ok: true, data: null };
}

/**
 * P0.5 — suspender é a ação preferida sobre excluir: a empresa para de
 * operar (o gate em getCurrentCompany/AppLayout bloqueia o acesso), mas
 * nenhum dado — venda, caixa, comissão, cliente — é apagado. Reativar
 * desfaz exatamente isso, nunca perde o motivo original (fica na
 * auditoria de plataforma, não na própria linha da empresa).
 */
export async function suspendCompany(companyId: string, reason: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = z.string().trim().min(3).max(500).safeParse(reason);
  if (!parsedReason.success) return { ok: false, error: DOMAIN_MESSAGES.MOTIVO_OBRIGATORIO };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_suspend_company", {
    p_company_id: companyId,
    p_reason: parsedReason.data,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${companyId}`);
  return { ok: true, data: null };
}

export async function reactivateCompany(companyId: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reactivate_company", {
    p_company_id: companyId,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
  });

  if (error) return { ok: false, error: domainOrFriendly(error) };
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${companyId}`);
  return { ok: true, data: null };
}
