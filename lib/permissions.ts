import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  getCompanyRoleKey,
  requireAuthenticatedUser,
  requireCompanyAccess,
  TenancyError,
} from "@/lib/tenancy";

function isManagerRole(roleKey: string | null): boolean {
  return roleKey === "owner" || roleKey === "admin";
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
 * Faz o papel de `requireCompanyAccess` também: sem vínculo o papel é null e
 * a falha é a mesma.
 */
export async function requireCompanyManager(companyId: string): Promise<{ userId: string }> {
  const user = await requireAuthenticatedUser();
  const roleKey = await getCompanyRoleKey(companyId);

  if (roleKey === null) {
    throw new TenancyError("Você não tem acesso a esta empresa.");
  }
  if (!isManagerRole(roleKey)) {
    throw new TenancyError("Só o responsável ou um gerente pode fazer isso.");
  }

  return { userId: user.id };
}

/**
 * O sistema de roles (owner/admin/staff, `role` + `user_company_role`) já
 * resolve o gate empresa-a-empresa. Este helper complementa com o segundo
 * nível — "um barbeiro só vê o próprio contexto": owner/admin sempre têm
 * acesso amplo; um usuário comum só passa quando o registro de `professional`
 * que ele tenta ver é o dele (`professional.user_id = auth.uid()`). Usado pela
 * Central do Barbeiro e pela visão de comissões por profissional.
 */
export async function requireOwnProfessionalOrManager(
  companyId: string,
  professionalId: string
): Promise<{ isManager: boolean }> {
  await requireCompanyAccess(companyId);

  const user = await requireAuthenticatedUser();
  if (isManagerRole(await getCompanyRoleKey(companyId))) {
    return { isManager: true };
  }

  const supabase = await createClient();
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
 * O usuário logado é gerente/admin/owner nesta empresa (não um barbeiro
 * comum). Não recebe mais userId: o papel vem do vínculo da sessão atual,
 * memoizado por request — passar um id abriria margem para perguntar pelo
 * papel de outra pessoa, que não é o que nenhuma chamada quer.
 */
export async function isCompanyManager(companyId: string): Promise<boolean> {
  return isManagerRole(await getCompanyRoleKey(companyId));
}

/**
 * O professional (se houver) ligado ao usuário logado nesta empresa.
 * Memoizado por request: o layout pergunta isso para decidir o escopo da
 * navegação e as páginas de Comissões e Inteligência perguntam de novo.
 */
export const getOwnProfessionalId = cache(
  async (companyId: string, userId: string): Promise<string | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("professional")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();

    return data?.id ?? null;
  }
);
