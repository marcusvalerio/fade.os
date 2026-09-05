"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";

const professionalSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  default_commission_percent: z.string().optional(),
});

export async function createProfessionalRecord(formData: FormData) {
  const supabase = await createClient();
  const parsed = professionalSchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    default_commission_percent: formData.get("default_commission_percent") || undefined,
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  await requireCompanyAccess(parsed.data.company_id);

  const { error } = await supabase.from("professional").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    default_commission_percent: parsed.data.default_commission_percent
      ? Number(parsed.data.default_commission_percent)
      : null,
  });

  if (error) throw new Error(friendlyMessage(error));

  revalidatePath("/profissionais");
  redirect("/profissionais");
}

async function requireProfessionalCompany(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from("professional")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) throw new Error("Profissional não encontrado.");

  await requireCompanyAccess(data.company_id);
}

export async function updateProfessionalRecord(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireProfessionalCompany(supabase, id);

  const { error } = await supabase
    .from("professional")
    .update({
      name: formData.get("name"),
      email: formData.get("email") || null,
      phone: formData.get("phone") || null,
      default_commission_percent: formData.get("default_commission_percent")
        ? Number(formData.get("default_commission_percent"))
        : null,
    })
    .eq("id", id);

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/profissionais");
  redirect("/profissionais");
}

export async function toggleProfessionalActive(id: string, active: boolean) {
  const supabase = await createClient();
  await requireProfessionalCompany(supabase, id);

  const { error } = await supabase
    .from("professional")
    .update({ active })
    .eq("id", id);

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/profissionais");
}
