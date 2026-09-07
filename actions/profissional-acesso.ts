"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompanyAccess, requireAuthenticatedUser, TenancyError } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

/**
 * requireCompanyAccess sozinho aceita qualquer vínculo (owner/admin/staff)
 * — correto para ações operacionais comuns, mas administrar o acesso de
 * OUTRO profissional (ativar/desativar/resetar credenciais) precisa ser
 * owner/admin. Sem essa checagem extra, um profissional comum (role
 * staff) conseguiria desativar ou resetar a senha de um colega chamando a
 * Server Action diretamente.
 */
async function requireManagerAccess(companyId: string): Promise<void> {
  await requireCompanyAccess(companyId);
  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(companyId, user.id))) {
    throw new TenancyError("Apenas o responsável ou um gerente pode administrar o acesso de profissionais.");
  }
}

const accessSchema = z.object({ professionalId: z.string().uuid(), companyId: z.string().uuid() });
const internalEmail = (identifier: string) => `${identifier.toLowerCase()}@login.fade.os`;

async function getProfessional(professionalId: string, companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("professional").select("id, name, email, user_id").eq("id", professionalId).eq("company_id", companyId).single();
  if (error || !data) throw new Error("Profissional não encontrado");
  return data;
}

async function disableAccessRecord(professionalId: string, companyId: string) {
  try {
    const supabase = await createClient();
    await supabase.rpc("disable_professional_access", { p_professional_id: professionalId, p_company_id: companyId });
  } catch (error) {
    console.error("[fade-os] rollback do acesso profissional falhou:", error);
  }
}

/**
 * professional.user_id só é gravado por esta função (linha ~70), e a única
 * chamada que reaproveita um userId existente é resetProfessionalAccess, que
 * sempre repassa o próprio user_id sincronizado aqui antes — hoje, portanto,
 * nunca aponta para a conta pessoal de um owner/admin. Mesmo assim, esta
 * checagem existe como segunda camada: se algum dia professional.user_id for
 * vinculado à conta de um owner/admin (por engano ou por uma feature futura
 * de "vincular meu próprio login"), NUNCA sobrescrever e-mail/senha dessa
 * conta pelo login sintético de profissional — isso destruiria o acesso
 * administrativo da pessoa.
 */
async function assertSafeToSyncExistingAuthUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: roleLinks, error } = await admin
    .from("user_company_role")
    .select("role:role_id(key)")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar a conta de acesso existente.");

  const hasManagerRole = (roleLinks ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link) => (link.role as any)?.key === "owner" || (link.role as any)?.key === "admin"
  );
  if (hasManagerRole) {
    throw new Error(
      "Este profissional está vinculado a uma conta com acesso administrativo (owner/admin). Por segurança, o e-mail e a senha dessa conta não podem ser substituídos pelo login de profissional."
    );
  }
}

/**
 * Remove o vínculo `staff` do usuário nesta empresa — nunca um vínculo
 * owner/admin. É o que efetivamente tira o acesso aos dados, porque
 * my_company_ids() (base de todo o RLS) lê user_company_role.
 */
async function revokeStaffCompanyLink(userId: string, companyId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: staffRole, error: roleError } = await admin
    .from("role")
    .select("id")
    .eq("key", "staff")
    .single();
  if (roleError || !staffRole) throw new Error("Papel de profissional não configurado.");

  const { error } = await admin
    .from("user_company_role")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("role_id", staffRole.id);

  if (error) throw new Error(`Não foi possível revogar o vínculo de acesso: ${error.message}`);
}

async function syncAuthUser(professionalId: string, companyId: string, identifier: string, password: string, existingUserId?: string | null) {
  const admin = createAdminClient();
  const email = internalEmail(identifier);
  let userId = existingUserId ?? undefined;
  const professional = await getProfessional(professionalId, companyId);

  if (userId) {
    await assertSafeToSyncExistingAuthUser(userId);
    const { error } = await admin.auth.admin.updateUserById(userId, { email, password, email_confirm: true, ban_duration: "none", user_metadata: { name: professional.name, account_type: "professional" } });
    if (error) throw new Error(`Não foi possível atualizar o acesso: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: professional.name, account_type: "professional" } });
    if (error || !data.user) throw new Error(`Não foi possível criar o acesso: ${error?.message ?? "usuário não criado"}`);
    userId = data.user.id;
  }

  const { data: staffRole, error: roleError } = await admin.from("role").select("id").eq("key", "staff").single();
  if (roleError || !staffRole) throw new Error("Papel de profissional não configurado.");

  const { error: roleLinkError } = await admin.from("user_company_role").upsert({ user_id: userId, company_id: companyId, role_id: staffRole.id }, { onConflict: "user_id,company_id" });
  if (roleLinkError) throw new Error(`Não foi possível vincular o perfil de acesso: ${roleLinkError.message}`);

  const supabase = await createClient();
  const { error } = await supabase.from("professional").update({ user_id: userId }).eq("id", professionalId).eq("company_id", companyId);
  if (error) throw new Error(`Não foi possível vincular o acesso ao profissional: ${error.message}`);
}

export async function enableProfessionalAccess(professionalId: string, companyId: string): Promise<ActionResult<{ access_identifier: string; temporary_password: string }>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireManagerAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("enable_professional_access", { p_professional_id: professionalId, p_company_id: companyId }).single();
    if (error) throw error;
    const result = data as { access_identifier: string; temporary_password: string };
    try {
      // Reaproveita a conta de auth já vinculada quando existe. Sem isso,
      // reativar um profissional criava uma SEGUNDA conta e deixava a antiga
      // órfã e banida — e o caminho de update é justamente o que remove o ban
      // aplicado na desativação.
      const professional = await getProfessional(professionalId, companyId);
      await syncAuthUser(
        professionalId,
        companyId,
        result.access_identifier,
        result.temporary_password,
        professional.user_id
      );
    } catch (syncError) {
      await disableAccessRecord(professionalId, companyId);
      throw syncError;
    }
    revalidatePath(`/profissionais/${professionalId}`); revalidatePath("/profissionais");
    return { ok: true, data: result };
  } catch (error) { console.error("[fade-os] enableProfessionalAccess:", error); return { ok: false, error: friendlyMessage(error) }; }
}

export async function disableProfessionalAccess(professionalId: string, companyId: string): Promise<ActionResult<null>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireManagerAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }
  try {
    const professional = await getProfessional(professionalId, companyId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("disable_professional_access", { p_professional_id: professionalId, p_company_id: companyId });
    if (error) throw error;
    if (professional.user_id) {
      // Desativar o registro de acesso não bastava: o vínculo em
      // user_company_role continuava valendo, e é ele que alimenta
      // my_company_ids() — ou seja, o RLS seguia liberando os dados da
      // empresa para uma sessão já emitida. Remover o vínculo revoga de
      // verdade, na fonte que o banco consulta.
      //
      // Só o vínculo `staff` é removido: se a pessoa também é owner ou admin
      // desta empresa, o acesso administrativo dela não pode ser derrubado
      // por uma operação sobre o cadastro de profissional.
      await revokeStaffCompanyLink(professional.user_id, companyId);

      const { error: authError } = await createAdminClient().auth.admin.updateUserById(professional.user_id, { ban_duration: "876000h" });
      if (authError) throw new Error(`Não foi possível bloquear o login: ${authError.message}`);
    }
    revalidatePath(`/profissionais/${professionalId}`); revalidatePath("/profissionais");
    return { ok: true, data: null };
  } catch (error) { console.error("[fade-os] disableProfessionalAccess:", error); return { ok: false, error: friendlyMessage(error) }; }
}

export async function resetProfessionalAccess(professionalId: string, companyId: string): Promise<ActionResult<{ access_identifier: string; temporary_password: string }>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireManagerAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }
  try {
    const professional = await getProfessional(professionalId, companyId);
    if (!professional.user_id) throw new Error("Este profissional ainda não possui uma conta de acesso.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reset_professional_access", { p_professional_id: professionalId, p_company_id: companyId }).single();
    if (error) throw error;
    const result = data as { access_identifier: string; temporary_password: string };
    try {
      await syncAuthUser(professionalId, companyId, result.access_identifier, result.temporary_password, professional.user_id);
    } catch (syncError) {
      await disableAccessRecord(professionalId, companyId);
      throw syncError;
    }
    revalidatePath(`/profissionais/${professionalId}`); revalidatePath("/profissionais");
    return { ok: true, data: result };
  } catch (error) { console.error("[fade-os] resetProfessionalAccess:", error); return { ok: false, error: friendlyMessage(error) }; }
}

export async function getProfessionalAccessStatus(professionalId: string, companyId: string): Promise<ActionResult<{ has_access: boolean; access_identifier?: string; is_access_enabled?: boolean; password_set_at?: string | null; created_at?: string; updated_at?: string } | null>> {
  const parsed = accessSchema.safeParse({ professionalId, companyId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try { await requireCompanyAccess(companyId); } catch (error) { return { ok: false, error: friendlyMessage(error) }; }
  const supabase = await createClient();
  const { data, error } = await supabase.from("professional_access").select("access_identifier, is_access_enabled, password_set_at, created_at, updated_at").eq("professional_id", professionalId).eq("company_id", companyId).maybeSingle();
  if (error) return { ok: false, error: friendlyMessage(error) };
  if (!data) return { ok: true, data: { has_access: false } };
  return { ok: true, data: { has_access: true, ...data } };
}

export async function changeProfessionalPassword(newPassword: string): Promise<ActionResult<null>> {
  const password = z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^a-zA-Z0-9]/).safeParse(newPassword);
  if (!password.success) return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };

  // A mesma pessoa pode ser profissional em mais de uma empresa, então um
  // maybeSingle() filtrado só por user_id ERRA em vez de responder. Busca-se
  // o conjunto e conclui-se o primeiro acesso de todos os vínculos ativos —
  // a senha vive no Supabase Auth e é uma só para esta conta.
  const { data: professionals, error: professionalError } = await supabase
    .from("professional")
    .select("id, company_id")
    .eq("user_id", user.id);
  if (professionalError) return { ok: false, error: friendlyMessage(professionalError) };
  if (!professionals || professionals.length === 0) {
    return { ok: false, error: "Usuário profissional não encontrado." };
  }

  const { data: accesses } = await supabase
    .from("professional_access")
    .select("professional_id, is_access_enabled, password_set_at")
    .in(
      "professional_id",
      professionals.map((p) => p.id)
    );

  const enabled = (accesses ?? []).filter((access) => access.is_access_enabled);
  if (enabled.length === 0) return { ok: false, error: "Seu acesso profissional está desativado." };

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { ok: false, error: "Não foi possível atualizar sua senha." };

  // Usa o cliente administrativo somente para registrar o estado que o próprio
  // profissional acabou de concluir. A senha continua sendo gerenciada pelo Auth.
  const { error: markError } = await createAdminClient()
    .from("professional_access")
    .update({ password_set_at: new Date().toISOString() })
    .in(
      "professional_id",
      enabled.map((access) => access.professional_id)
    );
  if (markError) {
    console.error("[fade-os] não foi possível registrar primeiro acesso:", markError);
    return { ok: false, error: "Senha alterada, mas não foi possível registrar a conclusão do primeiro acesso. Tente novamente." };
  }
  return { ok: true, data: null };
}
