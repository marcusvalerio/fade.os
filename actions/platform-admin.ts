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
export async function approveBetaRequest(id: string, reason?: string): Promise<ActionResult<null>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_beta_access_request", {
    p_id: id,
    p_reason: parsedReason.success ? parsedReason.data || null : null,
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
