"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const clientSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do cliente"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
  communication_consent: z.boolean().default(true),
});

export async function createClientRecord(formData: FormData) {
  const supabase = await createClient();
  const parsed = clientSchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    birth_date: formData.get("birth_date") || undefined,
    notes: formData.get("notes") || undefined,
    communication_consent: formData.get("communication_consent") === "on",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  await requireCompanyAccess(parsed.data.company_id);

  const { error } = await supabase.from("client").insert(parsed.data);
  if (error) throw new Error(friendlyMessage(error));

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("client")
    .update({
      name: formData.get("name"),
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      birth_date: formData.get("birth_date") || null,
      notes: formData.get("notes") || null,
      communication_consent: formData.get("communication_consent") === "on",
    })
    .eq("id", clientId);

  if (error) throw new Error(friendlyMessage(error));

  revalidatePath("/clientes");
  redirect("/clientes");
}
