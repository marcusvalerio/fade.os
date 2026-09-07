"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAllBelongToCompany } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const consumableSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do material"),
  category: z.string().optional(),
  unit_of_measure: z.string().min(1).default("un"),
  cost_price: z.coerce.number().min(0).default(0),
  current_stock: z.coerce.number().min(0).default(0),
  minimum_stock: z.coerce.number().min(0).default(0),
});

export async function createConsumableRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = consumableSchema.safeParse({
    company_id: formData.get("company_id"),
    unit_id: formData.get("unit_id"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    unit_of_measure: formData.get("unit_of_measure") || "un",
    cost_price: formData.get("cost_price") || 0,
    current_stock: formData.get("current_stock") || 0,
    minimum_stock: formData.get("minimum_stock") || 0,
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyManager(parsed.data.company_id);
    await requireAllBelongToCompany("unit", [parsed.data.unit_id], parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consumable")
    .insert({
      company_id: parsed.data.company_id,
      unit_id: parsed.data.unit_id,
      name: parsed.data.name,
      category: parsed.data.category || null,
      unit_of_measure: parsed.data.unit_of_measure,
      cost_price: parsed.data.cost_price,
      current_stock: parsed.data.current_stock,
      minimum_stock: parsed.data.minimum_stock,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/materiais");
  return { ok: true, data: { id: data.id } };
}

export async function createConsumableAndRedirect(formData: FormData) {
  const result = await createConsumableRecord(formData);
  if (!result.ok) throw new Error(result.error);
  redirect("/materiais");
}

async function requireConsumableCompany(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from("consumable")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) throw new Error("Material não encontrado.");
  await requireCompanyManager(data.company_id);
}

export async function updateConsumableRecord(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireConsumableCompany(supabase, id);

  const { error } = await supabase
    .from("consumable")
    .update({
      name: formData.get("name"),
      category: formData.get("category") || null,
      unit_of_measure: formData.get("unit_of_measure") || "un",
      cost_price: Number(formData.get("cost_price")) || 0,
      minimum_stock: Number(formData.get("minimum_stock")) || 0,
    })
    .eq("id", id);

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/materiais");
  redirect("/materiais");
}

export async function toggleConsumableActive(id: string, active: boolean) {
  const supabase = await createClient();
  await requireConsumableCompany(supabase, id);

  const { error } = await supabase.from("consumable").update({ active }).eq("id", id);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/materiais");
}
