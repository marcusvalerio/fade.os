"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAllBelongToCompany } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import { custoSchema, nomeCatalogoSchema, precoSchema, textoOpcionalSchema } from "@/lib/catalogo";
import type { ActionResult } from "@/actions/onboarding";

const productSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  name: nomeCatalogoSchema,
  category: z.string().optional(),
  cost_price: custoSchema.default(0),
  sale_price: precoSchema,
  current_stock: z.coerce.number().min(0).default(0),
  minimum_stock: z.coerce.number().min(0).default(0),
});

export async function createProductRecord(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = productSchema.safeParse({
    company_id: formData.get("company_id"),
    unit_id: formData.get("unit_id"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    cost_price: formData.get("cost_price") || 0,
    sale_price: formData.get("sale_price") || 0,
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
    .from("product")
    .insert({
      company_id: parsed.data.company_id,
      unit_id: parsed.data.unit_id,
      name: parsed.data.name,
      category: parsed.data.category || null,
      cost_price: parsed.data.cost_price,
      sale_price: parsed.data.sale_price,
      current_stock: parsed.data.current_stock,
      minimum_stock: parsed.data.minimum_stock,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/produtos");
  return { ok: true, data: { id: data.id } };
}

export async function createProductAndRedirect(formData: FormData) {
  const result = await createProductRecord(formData);
  if (!result.ok) throw new Error(result.error);
  redirect("/produtos");
}

async function requireProductCompany(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from("product")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) throw new Error("Produto não encontrado.");
  await requireCompanyManager(data.company_id);
}

export async function updateProductRecord(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireProductCompany(supabase, id);

  const { error } = await supabase
    .from("product")
    .update({
      name: formData.get("name"),
      category: formData.get("category") || null,
      cost_price: Number(formData.get("cost_price")) || 0,
      sale_price: Number(formData.get("sale_price")) || 0,
      minimum_stock: Number(formData.get("minimum_stock")) || 0,
    })
    .eq("id", id);

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/produtos");
  redirect("/produtos");
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await createClient();
  await requireProductCompany(supabase, id);

  const { error } = await supabase.from("product").update({ active }).eq("id", id);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/produtos");
}
