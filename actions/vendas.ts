"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

export async function cancelSale(saleId: string, reason: string): Promise<ActionResult<null>> {
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "Informe o motivo do cancelamento." };
  }

  const supabase = await createClient();

  const { data: sale, error: lookupError } = await supabase
    .from("sale")
    .select("company_id")
    .eq("id", saleId)
    .maybeSingle();

  if (lookupError || !sale) return { ok: false, error: "Venda não encontrada." };

  try {
    await requireCompanyManager(sale.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: saleId, p_reason: reason });
  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  revalidatePath("/comissoes");
  revalidatePath("/estoque");
  return { ok: true, data: null };
}
