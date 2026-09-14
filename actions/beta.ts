"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyMessage } from "@/lib/errors";
import { betaAccessRequestSchema } from "@/lib/beta-validation";
import type { ActionResult } from "@/actions/onboarding";

const DOMAIN_MESSAGES: Record<string, string> = {
  EMAIL_INVALIDO: "Informe um e-mail válido.",
  NOME_OBRIGATORIO: "Informe seu nome.",
  NOME_BARBEARIA_OBRIGATORIO: "Informe o nome da barbearia.",
  SOLICITACAO_JA_EXISTE: "Já existe uma solicitação em aberto para este e-mail.",
};

/**
 * Porta pública de entrada do Beta — sem autenticação, sem platform admin.
 * Toda validação/normalização real vive em submit_beta_access_request()
 * (SECURITY DEFINER); aqui é só parsear o formulário e traduzir o erro.
 */
export async function submitBetaAccessRequest(
  _prevState: ActionResult<null>,
  formData: FormData
): Promise<ActionResult<null>> {
  const parsed = betaAccessRequestSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    barbershop_name: formData.get("barbershop_name"),
    region: formData.get("region") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_beta_access_request", {
    p_email: parsed.data.email,
    p_name: parsed.data.name,
    p_barbershop_name: parsed.data.barbershop_name,
    p_phone: parsed.data.phone || null,
    p_region: parsed.data.region || null,
  });

  if (error) {
    const message = String((error as { message?: string }).message ?? "");
    if (DOMAIN_MESSAGES[message]) return { ok: false, error: DOMAIN_MESSAGES[message] };
    return { ok: false, error: friendlyMessage(error) };
  }

  return { ok: true, data: null };
}
