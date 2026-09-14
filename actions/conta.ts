"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const DOMAIN_MESSAGES: Record<string, string> = {
  EMPRESA_SEM_OUTRO_RESPONSAVEL:
    "Você é o único responsável por uma empresa. Adicione outro responsável em Equipe antes de excluir sua conta.",
};

/**
 * EXCLUIR CONTA != EXCLUIR EMPRESA. prepare_account_deletion() (banco) faz
 * a parte que precisa ser atômica e auditável: bloqueia se a conta for
 * owner único de alguma empresa, desvincula (nunca apaga) o registro de
 * professional — histórico comercial (venda, comissão, atendimento)
 * referencia professional.id, nunca professional.user_id, então nada
 * disso é tocado — revoga platform_admin se houver, audita por empresa e
 * só então remove os vínculos de user_company_role.
 *
 * A remoção de auth.users em si exige o client administrativo (service
 * role) — se o vínculo já foi limpo no banco mas essa etapa falhar (ex.:
 * ambiente sem a chave de serviço configurada), a conta fica sem nenhum
 * acesso a nenhuma empresa mas ainda consegue logar; o erro deixa isso
 * explícito em vez de fingir sucesso.
 */
export async function deleteOwnAccount(): Promise<ActionResult<null>> {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("prepare_account_deletion");
  if (error) {
    const message = String((error as { message?: string }).message ?? "");
    if (DOMAIN_MESSAGES[message]) return { ok: false, error: DOMAIN_MESSAGES[message] };
    return { ok: false, error: friendlyMessage(error) };
  }

  try {
    const admin = createAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("[cortex-os] falha ao excluir auth.users após limpar vínculos:", deleteError);
      return {
        ok: false,
        error:
          "Seus vínculos com empresas foram removidos, mas não foi possível concluir a exclusão da conta. Fale com o suporte.",
      };
    }
  } catch (adminError) {
    console.error("[cortex-os] client administrativo indisponível para excluir conta:", adminError);
    return { ok: false, error: friendlyMessage(adminError) };
  }

  await supabase.auth.signOut();
  redirect("/login?conta_excluida=1");
}
