"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

/**
 * Passa pela RPC em vez de um UPDATE direto: `commission` deixou de aceitar
 * escrita de `authenticated`, porque o razão financeiro não pode ser
 * reescrito por PATCH no PostgREST depois da venda fechada.
 *
 * A checagem de owner/admin, de empresa e de status ("só uma comissão devida
 * vira paga") mora dentro de mark_commission_paid, que é onde a chamada
 * direta também bate.
 */
export async function markCommissionPaid(commissionId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_commission_paid", {
    p_commission_id: commissionId,
  });

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/comissoes");
  return { ok: true, data: null };
}

/**
 * Paga, de uma vez, as comissões devidas de um profissional que a tela
 * mostrou. Os ids vêm da tela: o que entrou depois de a tela abrir fica para
 * o próximo pagamento, em vez de ser pago sem ninguém ver.
 */
export async function pagarPendentes(
  companyId: string,
  professionalId: string,
  ids: string[]
): Promise<ActionResult<{ pagas: number; total: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("mark_commissions_paid", { p_company_id: companyId, p_professional_id: professionalId, p_ids: ids })
    .single();
  if (error || !data) return { ok: false, error: friendlyMessage(error) };
  const r = data as { pagas: number; total: number | string };
  revalidatePath("/comissoes");
  return { ok: true, data: { pagas: r.pagas, total: Number(r.total) } };
}
