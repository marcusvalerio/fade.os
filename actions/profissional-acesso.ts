"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const accessSchema = z.object({ professionalId: z.string().uuid(), companyId: z.string().uuid() });
const internalEmail = (identifier: string) => `${identifier.toLowerCase()}@login.fade.os`;

async function getProfessional(professionalId: string, companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional")
    .select("id, name, email, user_id")
    .eq("id", professionalId)
    .eq("company_id", companyId)
    .single();
  if (error || !data) throw new Error("Profissional não encontrado");
  return data;
}

async function syncAuthUser(
  professionalId: string,
  companyId: string,
  identifier: string,
  password: string,
  existingUserId?: string | null
) {
  const admin = createAdminClient();
  const email = internalEmail(identifier);
  let userId = existingUserId ?? undefined;

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email,
      password,
      email_confirm: true,
      ban_duration: "none",
    });
    if (error) throw new Error(`Não foi possível atualizar o acesso: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: (await getProfessional(professionalId, companyId)).name, account_type: "professional" },
    });
    if (error || !data.user) throw new Error(`Não foi possível criar o acesso: ${error?.message ?? "usuário não criado"}`);
    userId = data.user.id;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("professional")
    .update({ user_id: userId })
    .eq("id", professionalId)
    .eq("company_id", companyId);
  if (error) throw new Error(`Não foi possível vincular o acesso ao profissional: ${error.message}`);
}

export async function enableProfessionalAccess(
  professionalId: string,
  companyId: string
): Promise<ActionResult<{ access_identifier: string; temporary_password: string }>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireCompanyAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }

  try {
    const professional = await getProfessional(professionalId, companyId);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("enable_professional_access", {
      p_professional_id: professionalId, p_company_id: companyId,
    }).single();
    if (error) throw error;
    const result = data as { access_identifier: string; temporary_password: string };
    await syncAuthUser(professionalId, companyId, result.access_identifier, result.temporary_password, professional.user_id);
    revalidatePath(`/profissionais/${professionalId}`);
    revalidatePath("/profissionais");
    return { ok: true, data: { access_identifier: result.access_identifier, temporary_password: result.temporary_password } };
  } catch (error) {
    console.error("[fade-os] enableProfessionalAccess:", error);
    return { ok: false, error: friendlyMessage(error) };
  }
}

export async function disableProfessionalAccess(
  professionalId: string,
  companyId: string
): Promise<ActionResult<null>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireCompanyAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }

  try {
    const professional = await getProfessional(professionalId, companyId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("disable_professional_access", {
      p_professional_id: professionalId, p_company_id: companyId,
    });
    if (error) throw error;
    if (professional.user_id) {
      const admin = createAdminClient();
      const { error: authError } = await admin.auth.admin.updateUserById(professional.user_id, { ban_duration: "876000h" });
      if (authError) throw new Error(`Não foi possível bloquear o login: ${authError.message}`);
    }
    revalidatePath(`/profissionais/${professionalId}`);
    revalidatePath("/profissionais");
    return { ok: true, data: null };
  } catch (error) {
    console.error("[fade-os] disableProfessionalAccess:", error);
    return { ok: false, error: friendlyMessage(error) };
  }
}

export async function resetProfessionalAccess(
  professionalId: string,
  companyId: string
): Promise<ActionResult<{ access_identifier: string; temporary_password: string }>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireCompanyAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }

  try {
    const professional = await getProfessional(professionalId, companyId);
    if (!professional.user_id) throw new Error("Este profissional ainda não possui uma conta de acesso.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reset_professional_access", {
      p_professional_id: professionalId, p_company_id: companyId,
    }).single();
    if (error) throw error;
    const result = data as { access_identifier: string; temporary_password: string };
    await syncAuthUser(professionalId, companyId, result.access_identifier, result.temporary_password, professional.user_id);
    revalidatePath(`/profissionais/${professionalId}`);
    revalidatePath("/profissionais");
    return { ok: true, data: { access_identifier: result.access_identifier, temporary_password: result.temporary_password } };
  } catch (error) {
    console.error("[fade-os] resetProfessionalAccess:", error);
    return { ok: false, error: friendlyMessage(error) };
  }
}

export async function getProfessionalAccessStatus(
  professionalId: string,
  companyId: string
): Promise<ActionResult<{ has_access: boolean; access_identifier?: string; is_access_enabled?: boolean; password_set_at?: string | null; created_at?: string; updated_at?: string } | null>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireCompanyAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional_access")
    .select("access_identifier, is_access_enabled, password_set_at, created_at, updated_at")
    .eq("professional_id", professionalId).eq("company_id", companyId).maybeSingle();
  if (error) return { ok: false, error: friendlyMessage(error) };
  if (!data) return { ok: true, data: { has_access: false } };
  return { ok: true, data: { has_access: true, ...data } };
}

export async function changeProfessionalPassword(
  newPassword: string
): Promise<ActionResult<null>> {
  const password = z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^a-zA-Z0-9]/).safeParse(newPassword);
  if (!password.success) return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  const { data: professional } = await supabase.from("professional").select("id, company_id").eq("user_id", user.id).maybeSingle();
  if (!professional) return { ok: false, error: "Usuário profissional não encontrado." };

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { ok: false, error: "Não foi possível atualizar sua senha." };

  const { error: markError } = await supabase.from("professional_access").update({ password_set_at: new Date().toISOString() }).eq("professional_id", professional.id).eq("company_id", professional.company_id);
  if (markError) return { ok: false, error: "Senha alterada, mas não foi possível registrar a conclusão do primeiro acesso." };

  return { ok: true, data: null };
}
