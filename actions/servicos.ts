"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const serviceSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do serviço"),
  category: z.string().optional(),
  default_price: z.string(),
  planned_duration_minutes: z.string(),
  default_commission_percent: z.string().optional(),
});

export async function createServiceRecord(formData: FormData) {
  const supabase = await createClient();
  const parsed = serviceSchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    default_price: formData.get("default_price"),
    planned_duration_minutes: formData.get("planned_duration_minutes"),
    default_commission_percent: formData.get("default_commission_percent") || undefined,
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const { error } = await supabase.from("service").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    category: parsed.data.category || null,
    default_price: Number(parsed.data.default_price),
    planned_duration_minutes: Number(parsed.data.planned_duration_minutes),
    default_commission_percent: parsed.data.default_commission_percent
      ? Number(parsed.data.default_commission_percent)
      : null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/servicos");
  redirect("/servicos");
}

export async function updateServiceRecord(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service")
    .update({
      name: formData.get("name"),
      category: formData.get("category") || null,
      default_price: Number(formData.get("default_price")),
      planned_duration_minutes: Number(formData.get("planned_duration_minutes")),
      default_commission_percent: formData.get("default_commission_percent")
        ? Number(formData.get("default_commission_percent"))
        : null,
      status: formData.get("status"),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/servicos");
  redirect("/servicos");
}

export async function toggleProfessionalOnService(
  serviceId: string,
  professionalId: string,
  linked: boolean
) {
  const supabase = await createClient();

  if (linked) {
    const { error } = await supabase
      .from("professional_service")
      .insert({ service_id: serviceId, professional_id: professionalId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("professional_service")
      .delete()
      .eq("service_id", serviceId)
      .eq("professional_id", professionalId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/servicos/${serviceId}`);
}
