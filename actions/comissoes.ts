"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

export async function markCommissionPaid(commissionId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { data: commission, error: lookupError } = await supabase
    .from("commission")
    .select("company_id, status")
    .eq("id", commissionId)
    .maybeSingle();

  if (lookupError || !commission) return { ok: false, error: "Comissão não encontrada." };

  try {
    await requireCompanyManager(commission.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  if (commission.status !== "due") {
    return { ok: false, error: "Só é possível marcar como paga uma comissão devida." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("commission")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_by: user?.id ?? null })
    .eq("id", commissionId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/comissoes");
  return { ok: true, data: null };
}
