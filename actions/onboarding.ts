"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireCompanyAccess } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const companySchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa"),
  trade_name: z.string().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

/**
 * Bootstrap de tenancy: cria a empresa e o vínculo owner numa única
 * transação, via RPC SECURITY DEFINER (supabase/migrations/…_tenancy_
 * bootstrap_and_rls.sql). Isso resolve o ciclo em que a policy de insert de
 * user_company_role exigia um vínculo que ainda não existia — a função
 * cria os dois registros com o privilégio do seu dono, não do usuário, e
 * sempre usa auth.uid() para o vínculo (nunca um id vindo do cliente).
 */
export async function createCompanyStep(
  input: z.infer<typeof companySchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_company_with_owner", {
    p_name: parsed.data.name,
    p_trade_name: parsed.data.trade_name || null,
    p_document: parsed.data.document || null,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_address: parsed.data.address || null,
  });

  if (error || !data) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: { id: data.id } };
}

const unitSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome da unidade"),
  address: z.string().optional(),
});

export async function createUnitStep(
  input: z.infer<typeof unitSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyAccess(parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: { id: data.id } };
}

const professionalSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do profissional"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  default_commission_percent: z.coerce.number().min(0).max(100).optional(),
});

export async function createProfessionalStep(
  input: z.infer<typeof professionalSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyAccess(parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: { id: data.id } };
}

const serviceSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do serviço"),
  category: z.string().optional(),
  default_price: z.coerce.number().min(0, "Preço inválido"),
  planned_duration_minutes: z.coerce.number().int().min(1, "Duração inválida"),
  default_commission_percent: z.coerce.number().min(0).max(100).optional(),
});

export async function createServiceStep(
  input: z.infer<typeof serviceSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyAccess(parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: { id: data.id } };
}

export async function linkProfessionalToService(
  companyId: string,
  professionalId: string,
  serviceId: string
): Promise<ActionResult<null>> {
  try {
    await requireCompanyAccess(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_service")
    .insert({ professional_id: professionalId, service_id: serviceId });

  if (error) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: null };
}
