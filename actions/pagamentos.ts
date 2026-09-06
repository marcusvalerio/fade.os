"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";
import type { PaymentMethodKey } from "@/lib/types";

/**
 * A barbearia não "cria" uma forma de pagamento — ela liga/desliga entre um
 * conjunto fixo. `upsert` com o par único (company_id, method) faz de uma
 * chamada só o que seria "cria se não existe, senão atualiza o active".
 */
export async function setPaymentMethodActive(
  companyId: string,
  method: PaymentMethodKey,
  active: boolean
): Promise<ActionResult<null>> {
  try {
    await requireCompanyAccess(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_method")
    .upsert(
      { company_id: companyId, method, active },
      { onConflict: "company_id,method" }
    );

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/configuracoes");
  revalidatePath("/onboarding");
  return { ok: true, data: null };
}
