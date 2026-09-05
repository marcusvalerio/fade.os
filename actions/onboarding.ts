"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

export async function createCompanyStep(
  input: z.infer<typeof companySchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada, faça login novamente." };

  const { data, error } = await supabase
    .from("company")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professional")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function linkProfessionalToService(
  professionalId: string,
  serviceId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_service")
    .insert({ professional_id: professionalId, service_id: serviceId });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
