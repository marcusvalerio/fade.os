"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const adjustSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  item_type: z.enum(["product", "consumable"]),
  item_id: z.string().uuid(),
  movement_type: z.enum(["entry", "consumption", "adjustment", "loss", "inventory"]),
  quantity: z.coerce.number(),
  unit_cost: z.coerce.number().min(0).optional(),
  reason: z.string().optional(),
}).superRefine((valor, ctx) => {
  // Inventário informa o saldo contado, e "contei zero" é uma contagem
  // legítima. Nos demais tipos o número é um delta, e delta zero não é
  // movimento nenhum.
  if (valor.movement_type === "inventory") {
    if (valor.quantity < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"],
        message: "O saldo contado não pode ser negativo." });
    }
    return;
  }
  if (valor.quantity === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"],
      message: "Informe uma quantidade diferente de zero." });
  }
});

export async function adjustStockAction(
  input: z.infer<typeof adjustSchema>
): Promise<ActionResult<{ movementId: string }>> {
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyManager(parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("adjust_stock", {
      p_company_id: parsed.data.company_id,
      p_unit_id: parsed.data.unit_id,
      p_item_type: parsed.data.item_type,
      p_item_id: parsed.data.item_id,
      p_movement_type: parsed.data.movement_type,
      p_quantity: parsed.data.quantity,
      p_unit_cost: parsed.data.unit_cost ?? null,
      p_reason: parsed.data.reason || null,
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/estoque");
  revalidatePath("/produtos");
  revalidatePath("/materiais");
  return { ok: true, data: { movementId: data as string } };
}
