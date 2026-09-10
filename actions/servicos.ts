"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAllBelongToCompany } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { ecoDoFormulario, type ValoresEnviados } from "@/lib/form-echo";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";
import {
  comissaoOpcionalSchema,
  duracaoSchema,
  nomeCatalogoSchema,
  precoSchema,
  textoOpcionalSchema,
} from "@/lib/catalogo";

/**
 * As regras vivem em lib/catalogo.ts, junto com as de produto e material, e
 * têm a gêmea final nos triggers do banco. Antes, `default_price` era
 * `z.string()` puro: -R$ 50,00 e 0 min atravessavam sem nenhuma checagem.
 */
const serviceSchema = z.object({
  company_id: z.string().uuid(),
  name: nomeCatalogoSchema,
  description: textoOpcionalSchema,
  category: textoOpcionalSchema,
  default_price: precoSchema,
  planned_duration_minutes: duracaoSchema,
  default_commission_percent: comissaoOpcionalSchema,
  is_public: z.coerce.boolean().optional(),
});

export type ServiceFormState = { error: string | null; valores?: ValoresEnviados };

/**
 * Devolve o erro em vez de estourar. `throw` numa Server Action de formulário
 * cai na error boundary — a pessoa perdia o que digitou e via uma tela de
 * erro genérica em vez da frase que explica o que está errado.
 */
export async function createServiceRecord(
  _prev: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const supabase = await createClient();
  const parsed = serviceSchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    default_price: formData.get("default_price"),
    planned_duration_minutes: formData.get("planned_duration_minutes"),
    default_commission_percent: formData.get("default_commission_percent") || undefined,
    is_public: formData.get("is_public") === "on",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message, valores: ecoDoFormulario(formData) };

  try {
    await requireCompanyManager(parsed.data.company_id);
  } catch (error) {
    return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  }

  const { error } = await supabase.from("service").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    default_price: parsed.data.default_price,
    planned_duration_minutes: parsed.data.planned_duration_minutes,
    default_commission_percent: parsed.data.default_commission_percent ?? null,
    is_public: parsed.data.is_public ?? true,
  });

  if (error) return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };

  revalidatePath("/servicos");
  redirect("/servicos");
}

export async function updateServiceRecord(
  id: string,
  _prev: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const supabase = await createClient();

  const { data: existing, error: lookupError } = await supabase
    .from("service")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !existing) {
    return { error: "Serviço não encontrado." };
  }

  try {
    await requireCompanyManager(existing.company_id);
  } catch (error) {
    return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  }

  // A edição passava direto do formulário para o banco, sem nenhum schema —
  // era o caminho pelo qual um serviço válido virava inválido depois.
  const parsed = serviceSchema
    .omit({ company_id: true })
    .extend({ status: z.enum(["active", "inactive"]) })
    .safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      category: formData.get("category") || undefined,
      default_price: formData.get("default_price"),
      planned_duration_minutes: formData.get("planned_duration_minutes"),
      default_commission_percent: formData.get("default_commission_percent") || undefined,
      is_public: formData.get("is_public") === "on",
      status: formData.get("status") ?? "active",
    });

  if (!parsed.success) return { error: parsed.error.issues[0].message, valores: ecoDoFormulario(formData) };

  const { error } = await supabase
    .from("service")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      default_price: parsed.data.default_price,
      planned_duration_minutes: parsed.data.planned_duration_minutes,
      default_commission_percent: parsed.data.default_commission_percent ?? null,
      is_public: parsed.data.is_public ?? true,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  revalidatePath("/servicos");
  redirect("/servicos");
}

export async function toggleProfessionalOnService(
  serviceId: string,
  professionalId: string,
  linked: boolean
) {
  const supabase = await createClient();

  // Nem serviceId nem professionalId chegam com o company_id junto — deriva
  // do próprio serviço (a leitura já é escopada por RLS) e confirma que o
  // profissional é da mesma empresa antes de tocar em professional_service.
  const { data: service, error: serviceLookupError } = await supabase
    .from("service")
    .select("company_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceLookupError || !service) {
    throw new Error("Serviço não encontrado.");
  }

  await requireCompanyManager(service.company_id);
  await requireAllBelongToCompany("professional", [professionalId], service.company_id);

  if (linked) {
    const { error } = await supabase
      .from("professional_service")
      .insert({ service_id: serviceId, professional_id: professionalId });
    if (error) throw new Error(friendlyMessage(error));
  } else {
    const { error } = await supabase
      .from("professional_service")
      .delete()
      .eq("service_id", serviceId)
      .eq("professional_id", professionalId);
    if (error) throw new Error(friendlyMessage(error));
  }

  revalidatePath(`/servicos/${serviceId}`);
  revalidatePath(`/profissionais/${professionalId}`);
}
