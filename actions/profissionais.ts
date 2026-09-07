"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAllBelongToCompany } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const professionalSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome"),
  role_title: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  default_commission_percent: z.string().optional(),
});

export async function createProfessionalRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = professionalSchema.safeParse({
    company_id: formData.get("company_id"),
    unit_id: formData.get("unit_id"),
    name: formData.get("name"),
    role_title: formData.get("role_title") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    default_commission_percent: formData.get("default_commission_percent") || undefined,
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
    .from("professional")
    .insert({
      company_id: parsed.data.company_id,
      unit_id: parsed.data.unit_id,
      name: parsed.data.name,
      role_title: parsed.data.role_title || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      default_commission_percent: parsed.data.default_commission_percent
        ? Number(parsed.data.default_commission_percent)
        : null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/profissionais");
  return { ok: true, data: { id: data.id } };
}

export async function createProfessionalAndRedirect(formData: FormData) {
  const result = await createProfessionalRecord(formData);
  if (!result.ok) throw new Error(result.error);
  redirect("/profissionais");
}

async function requireProfessionalCompany(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from("professional")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) throw new Error("Profissional não encontrado.");

  await requireCompanyManager(data.company_id);
  return data.company_id as string;
}

export async function updateProfessionalRecord(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireProfessionalCompany(supabase, id);

  const { error } = await supabase
    .from("professional")
    .update({
      name: formData.get("name"),
      role_title: formData.get("role_title") || null,
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

export async function setProfessionalAvatar(
  id: string,
  avatarUrl: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  try {
    await requireProfessionalCompany(supabase, id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.from("professional").update({ avatar_url: avatarUrl }).eq("id", id);
  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/profissionais");
  revalidatePath(`/profissionais/${id}`);
  return { ok: true, data: null };
}
