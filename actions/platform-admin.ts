"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/platform-permissions";
import { friendlyMessage, friendlyAuthMessage } from "@/lib/errors";
import { trustedOrigin } from "@/actions/auth";
import { generateTemporaryPassword } from "@/lib/temporary-password";
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
export type BetaApprovalResult = {
  name: string;
  email: string;
  barbershopName: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  periodMonths: number;
  betaExpiresAt: string;
  accessUrl: string;
  /** Só existe quando a conta nasceu agora — nunca para uma conta reaproveitada. */
  temporaryPassword: string | null;
  accountReused: boolean;
};

type BeginBetaApprovalRow = {
  request_email: string;
  request_name: string;
  request_barbershop_name: string;
  request_phone: string | null;
  request_region: string | null;
  existing_user_id: string | null;
  existing_owner_company_id: string | null;
};

type FinalizeBetaApprovalRow = {
  company_id: string;
  company_name: string;
  company_slug: string;
  beta_expires_at: string;
};

/**
 * Aprovar não é só mudar o status — provisiona a conta de verdade:
 *
 *   1. platform_begin_beta_approval (RPC): valida platform admin + pendente,
 *      devolve os dados da solicitação e se já existe auth.users para este
 *      e-mail (para nunca duplicar conta nem tocar senha de conta existente).
 *   2. Conta nova? admin.auth.admin.createUser aqui no Node, com uma senha
 *      provisória gerada por lib/temporary-password.ts — o SQL não fala com
 *      o GoTrue, por isso este passo fica fora da RPC.
 *   3. platform_finalize_beta_approval (RPC): a parte atômica — cria/
 *      reaproveita a empresa e o vínculo owner, marca a solicitação como
 *      approved com o período/validade do Beta, grava a auditoria. Se
 *      falhar depois de uma conta ter sido criada no passo 2, essa conta é
 *      desfeita (compensação) antes de devolver o erro — nunca fica uma
 *      conta órfã sem empresa por causa de uma aprovação que não terminou.
 */
export async function approveBetaRequest(
  id: string,
  reason?: string,
  periodMonths?: number
): Promise<ActionResult<BetaApprovalResult>> {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const parsedReason = reasonSchema.safeParse(reason);
  const parsedPeriod = z.number().int().min(1).max(24).default(2).safeParse(periodMonths ?? 2);
  if (!parsedPeriod.success) return { ok: false, error: DOMAIN_MESSAGES.PERIODO_INVALIDO };
  const reasonValue = parsedReason.success ? parsedReason.data || null : null;

  const supabase = await createClient();

  const { data: beginData, error: beginError } = await supabase
    .rpc("platform_begin_beta_approval", { p_id: id })
    .single();
  if (beginError || !beginData) return { ok: false, error: domainOrFriendly(beginError) };
  const begin = beginData as BeginBetaApprovalRow;

  let userId = begin.existing_user_id;
  let temporaryPassword: string | null = null;
  const isNewAccount = !userId;

  // A partir daqui existe um efeito colateral externo ao banco (a conta no
  // Supabase Auth) que pode precisar ser desfeito se algo falhar depois —
  // por isso um try/catch cercando tudo, em vez de deixar uma exceção (ex.:
  // ConfigurationError de createAdminClient() por chave de serviço ausente)
  // escapar sem chance de compensação.
  try {
    if (!userId) {
      temporaryPassword = generateTemporaryPassword();
      const admin = createAdminClient();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: begin.request_email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { name: begin.request_name, account_type: "owner" },
      });
      if (createError || !created.user) {
        return {
          ok: false,
          error: createError ? friendlyAuthMessage(createError.message) : "Não foi possível criar a conta do usuário.",
        };
      }
      userId = created.user.id;
    }

    const { data: finalizeData, error: finalizeError } = await supabase
      .rpc("platform_finalize_beta_approval", {
        p_id: id,
        p_user_id: userId,
        p_period_months: parsedPeriod.data,
        p_new_account: isNewAccount,
        p_reason: reasonValue,
      })
      .single();
    const finalize = finalizeData as FinalizeBetaApprovalRow | null;

    if (finalizeError || !finalize) {
      if (isNewAccount && userId) await compensateNewAccount(userId);
      return { ok: false, error: domainOrFriendly(finalizeError) };
    }

    revalidatePath("/admin/acessos");
    revalidatePath("/admin");

    return {
      ok: true,
      data: {
        name: begin.request_name,
        email: begin.request_email,
        barbershopName: begin.request_barbershop_name,
        companyId: finalize.company_id,
        companyName: finalize.company_name,
        companySlug: finalize.company_slug,
        periodMonths: parsedPeriod.data,
        betaExpiresAt: finalize.beta_expires_at,
        accessUrl: `${await trustedOrigin()}/login`,
        temporaryPassword,
        accountReused: !isNewAccount,
      },
    };
  } catch (error) {
    if (isNewAccount && userId) await compensateNewAccount(userId);
    return { ok: false, error: friendlyMessage(error) };
  }
}

/** Desfaz a conta criada nesta tentativa quando um passo posterior falha — nunca deixa uma conta órfã sem empresa. */
async function compensateNewAccount(userId: string): Promise<void> {
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    if (error) throw error;
  } catch (error) {
    console.error("[cortex-os] não foi possível desfazer a conta criada após falha na aprovação do Beta:", error);
  }
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
