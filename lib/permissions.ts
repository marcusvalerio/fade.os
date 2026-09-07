import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess, requireAuthenticatedUser, TenancyError } from "@/lib/tenancy";

/**
 * O sistema de roles hoje (owner/admin/staff, `role`+`user_company_role`
 * das fases 1-2) já resolve o gate empresa-a-empresa. A Fase 4 pede um
 * segundo nível — "um barbeiro só vê o próprio contexto" (seção 17/20) —
 * que não existe como role separada ainda. Em vez de recriar o sistema de
 * roles (risco desnecessário para o que foi pedido), este helper
 * complementa: owner/admin sempre têm acesso amplo; um usuário comum só
 * passa quando o registro de `professional` que ele está tentando ver é o
 * seu próprio (`professional.user_id = auth.uid()`). Usado pela Central do
 * Barbeiro e pela visão de comissões por profissional.
 */
export async function requireOwnProfessionalOrManager(
  companyId: string,
  professionalId: string
): Promise<{ isManager: boolean }> {
  await requireCompanyAccess(companyId);

  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data: roleLink } = await supabase
    .from("user_company_role")
    .select("role:role_id(key)")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleKey = (roleLink?.role as any)?.key as string | undefined;
  const isManager = roleKey === "owner" || roleKey === "admin";
  if (isManager) return { isManager: true };

  const { data: professional } = await supabase
    .from("professional")
    .select("user_id")
    .eq("id", professionalId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!professional || professional.user_id !== user.id) {
    throw new TenancyError("Você só pode ver os próprios dados.");
  }

  return { isManager: false };
}

/**
 * Gate de gestão: a ação exige papel `owner` ou `admin` nesta empresa.
 *
 * Esconder o link na navegação não protege nada — uma Server Action é um
 * endpoint HTTP e pode ser chamada direto. `requireCompanyAccess` sozinho
 * aceita qualquer vínculo, `staff` incluído, o que basta para o que é
 * operação do dia a dia (agenda, atendimento, venda, caixa) mas não para
 * cadastro, configuração, ajuste de estoque, comissão, despesa ou
 * cancelamento de venda.
 *
 * Faz o papel de `requireCompanyAccess` também: sem vínculo nenhum a
 * consulta não retorna linha e a falha é a mesma. Uma query de papel em vez
 * de duas (acesso + papel).
 */
export async function requireCompanyManager(companyId: string): Promise<{ userId: string }> {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_company_role")
    .select("role:role_id(key)")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new TenancyError("Você não tem acesso a esta empresa.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleKey = (data.role as any)?.key as string | undefined;
  if (roleKey !== "owner" && roleKey !== "admin") {
    throw new TenancyError("Só o responsável ou um gerente pode fazer isso.");
  }

  return { userId: user.id };
}

/** Empresa atual do usuário logado é gerente/admin/owner (não um barbeiro comum). */
export async function isCompanyManager(companyId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_company_role")
    .select("role:role_id(key)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleKey = (data?.role as any)?.key as string | undefined;
  return roleKey === "owner" || roleKey === "admin";
}

/** O professional (se houver) ligado ao usuário logado nesta empresa. */
export async function getOwnProfessionalId(companyId: string, userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("professional")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  return data?.id ?? null;
}
