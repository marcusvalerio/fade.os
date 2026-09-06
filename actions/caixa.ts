"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

async function requireRegisterCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cashRegisterId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("cash_register")
    .select("company_id")
    .eq("id", cashRegisterId)
    .maybeSingle();
  if (error || !data) throw new Error("Caixa não encontrado.");
  await requireCompanyAccess(data.company_id);
  return data.company_id;
}

async function requireSessionCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cashSessionId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("cash_session")
    .select("company_id")
    .eq("id", cashSessionId)
    .maybeSingle();
  if (error || !data) throw new Error("Sessão de caixa não encontrada.");
  await requireCompanyAccess(data.company_id);
  return data.company_id;
}

export async function openCashSession(
  cashRegisterId: string,
  openingBalance: number
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  try {
    await requireRegisterCompany(supabase, cashRegisterId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .rpc("open_cash_session", { p_cash_register_id: cashRegisterId, p_opening_balance: openingBalance })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };
  revalidatePath("/caixa");
  return { ok: true, data: { id: data as string } };
}

export async function closeCashSession(
  cashSessionId: string,
  countedBalance: number,
  notes?: string
): Promise<ActionResult<{ difference: number }>> {
  const supabase = await createClient();
  try {
    await requireSessionCompany(supabase, cashSessionId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .rpc("close_cash_session", {
      p_cash_session_id: cashSessionId,
      p_counted_balance: countedBalance,
      p_notes: notes || null,
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };
  revalidatePath("/caixa");
  return { ok: true, data: { difference: Number((data as { difference: number }).difference) } };
}

const movementSchema = z.object({
  cash_session_id: z.string().uuid(),
  type: z.enum(["sangria", "suprimento", "other_in", "other_out"]),
  amount: z.coerce.number().positive("Informe um valor válido"),
  reason: z.string().min(2, "Informe o motivo"),
});

export async function addCashMovement(
  input: z.infer<typeof movementSchema>
): Promise<ActionResult<null>> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  let companyId: string;
  try {
    companyId = await requireSessionCompany(supabase, parsed.data.cash_session_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.from("cash_movement").insert({
    company_id: companyId,
    cash_session_id: parsed.data.cash_session_id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
  });

  if (error) return { ok: false, error: friendlyMessage(error) };
  revalidatePath("/caixa");
  return { ok: true, data: null };
}
