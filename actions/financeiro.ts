"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const entrySchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  type: z.enum(["income", "expense"]),
  category: z.string().min(2, "Informe a categoria"),
  description: z.string().optional(),
  amount: z.coerce.number().positive("Informe um valor válido"),
  quantity: z.coerce.number().optional(),
  unit_cost: z.coerce.number().optional(),
  supplier: z.string().optional(),
  entry_date: z.string().min(1),
});

/**
 * Lançamento manual (compras, retiradas administrativas, etc.) — os
 * lançamentos automáticos (pagamento de venda, estorno) nascem dentro de
 * close_attendance()/cancel_sale() no banco, nunca aqui.
 */
export async function createFinancialEntry(
  input: z.infer<typeof entrySchema>
): Promise<ActionResult<null>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyAccess(parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("financial_entry").insert({
    company_id: parsed.data.company_id,
    unit_id: parsed.data.unit_id || null,
    type: parsed.data.type,
    category: parsed.data.category,
    description: parsed.data.description || null,
    amount: parsed.data.amount,
    quantity: parsed.data.quantity ?? null,
    unit_cost: parsed.data.unit_cost ?? null,
    supplier: parsed.data.supplier || null,
    reference_type: "manual",
    entry_date: parsed.data.entry_date,
    created_by: user?.id ?? null,
  });

  if (error) return { ok: false, error: friendlyMessage(error) };
  revalidatePath("/financeiro");
  return { ok: true, data: null };
}
