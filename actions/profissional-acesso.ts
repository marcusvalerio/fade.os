"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

/**
 * enableProfessionalAccess
 * Admin ativa acesso de um profissional ao FADE.OS
 * Retorna: { access_identifier, temporary_password } — mostrado UMA VEZ
 */
export async function enableProfessionalAccess(
  professionalId: string,
  companyId: string
): Promise<ActionResult<{ access_identifier: string; temporary_password: string }>> {
  const parsed = z.object({ professionalId: z.string().uuid(), companyId: z.string().uuid() })
    .safeParse({ professionalId, companyId });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await requireCompanyAccess(parsed.data.companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("enable_professional_access", {
      p_professional_id: parsed.data.professionalId,
      p_company_id: parsed.data.companyId,
    })
    .single();

  if (error) {
    console.error("[fade-os] enable_professional_access error:", error);
    return { ok: false, error: friendlyMessage(error) };
  }

  const result = data as {
    access_identifier: string;
    temporary_password: string;
    message: string;
  };

  revalidatePath(`/profissionais/${parsed.data.professionalId}`);
  revalidatePath("/profissionais");

  return {
    ok: true,
    data: {
      access_identifier: result.access_identifier,
      temporary_password: result.temporary_password,
    },
  };
}

/**
 * disableProfessionalAccess
 * Admin desativa acesso de um profissional (sem deletar histórico)
 */
export async function disableProfessionalAccess(
  professionalId: string,
  companyId: string
): Promise<ActionResult<null>> {
  const parsed = z.object({ professionalId: z.string().uuid(), companyId: z.string().uuid() })
    .safeParse({ professionalId, companyId });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await requireCompanyAccess(parsed.data.companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("disable_professional_access", {
      p_professional_id: parsed.data.professionalId,
      p_company_id: parsed.data.companyId,
    });

  if (error) {
    console.error("[fade-os] disable_professional_access error:", error);
    return { ok: false, error: friendlyMessage(error) };
  }

  revalidatePath(`/profissionais/${parsed.data.professionalId}`);
  revalidatePath("/profissionais");

  return { ok: true, data: null };
}

/**
 * resetProfessionalAccess
 * Admin reseta acesso: novo identifier + password temporária
 * Força profissional a trocar senha no próximo login
 */
export async function resetProfessionalAccess(
  professionalId: string,
  companyId: string
): Promise<ActionResult<{ access_identifier: string; temporary_password: string }>> {
  const parsed = z.object({ professionalId: z.string().uuid(), companyId: z.string().uuid() })
    .safeParse({ professionalId, companyId });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await requireCompanyAccess(parsed.data.companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("reset_professional_access", {
      p_professional_id: parsed.data.professionalId,
      p_company_id: parsed.data.companyId,
    })
    .single();

  if (error) {
    console.error("[fade-os] reset_professional_access error:", error);
    return { ok: false, error: friendlyMessage(error) };
  }

  const result = data as {
    access_identifier: string;
    temporary_password: string;
    message: string;
  };

  revalidatePath(`/profissionais/${parsed.data.professionalId}`);
  revalidatePath("/profissionais");

  return {
    ok: true,
    data: {
      access_identifier: result.access_identifier,
      temporary_password: result.temporary_password,
    },
  };
}

/**
 * getProfessionalAccessStatus
 * Retorna status de acesso do profissional (para exibir na UI)
 */
export async function getProfessionalAccessStatus(
  professionalId: string,
  companyId: string
): Promise<ActionResult<{
  has_access: boolean;
  access_identifier?: string;
  is_access_enabled?: boolean;
  password_set_at?: string | null;
  created_at?: string;
  updated_at?: string;
} | null>> {
  const parsed = z.object({ professionalId: z.string().uuid(), companyId: z.string().uuid() })
    .safeParse({ professionalId, companyId });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await requireCompanyAccess(parsed.data.companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_access")
    .select("access_identifier, is_access_enabled, password_set_at, created_at, updated_at")
    .eq("professional_id", parsed.data.professionalId)
    .eq("company_id", parsed.data.companyId)
    .maybeSingle();

  if (error) {
    console.error("[fade-os] getProfessionalAccessStatus error:", error);
    return { ok: false, error: friendlyMessage(error) };
  }

  if (!data) {
    return { ok: true, data: { has_access: false } };
  }

  return {
    ok: true,
    data: {
      has_access: true,
      access_identifier: data.access_identifier,
      is_access_enabled: data.is_access_enabled,
      password_set_at: data.password_set_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  };
}
