"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireAllBelongToCompany } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const companySchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa"),
  trade_name: z.string().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
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

  // create_company_with_owner (SECURITY DEFINER) só aceita os campos que já
  // existiam quando foi escrita — whatsapp/cep/cidade/estado são novos da
  // Fase 1. Em vez de alterar uma função SECURITY DEFINER só para isso, o
  // vínculo owner que a própria RPC acabou de criar já libera este UPDATE
  // comum, sujeito à mesma RLS de sempre.
  if (parsed.data.whatsapp || parsed.data.postal_code || parsed.data.city || parsed.data.state) {
    await supabase
      .from("company")
      .update({
        whatsapp: parsed.data.whatsapp || null,
        postal_code: parsed.data.postal_code || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
      })
      .eq("id", data.id);
  }

  return { ok: true, data: { id: data.id } };
}

const unitSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome da unidade"),
  address: z.string().optional(),
  phone: z.string().optional(),
  business_hours_note: z.string().optional(),
});

export async function createUnitStep(
  input: z.infer<typeof unitSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyManager(parsed.data.company_id);
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

  // Só a estrutura: nenhuma fase de abertura/fechamento/sangria existe
  // ainda, mas o caixa da unidade já "existe" para as fases futuras
  // construírem em cima, em vez de nascer só quando o caixa operacional
  // for implementado. Não bloqueia a criação da unidade se falhar — só
  // registra, para investigar depois sem travar o onboarding por isso.
  const { error: cashRegisterError } = await supabase
    .from("cash_register")
    .insert({ company_id: parsed.data.company_id, unit_id: data.id });
  if (cashRegisterError) {
    console.error("[fade-os] falha ao criar cash_register da unidade:", cashRegisterError);
  }

  return { ok: true, data: { id: data.id } };
}

const professionalSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do profissional"),
  role_title: z.string().optional(),
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
    await requireCompanyManager(parsed.data.company_id);
    await requireAllBelongToCompany("unit", [parsed.data.unit_id], parsed.data.company_id);
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
  description: z.string().optional(),
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
    await requireCompanyManager(parsed.data.company_id);
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
    await requireCompanyManager(companyId);
    await requireAllBelongToCompany("professional", [professionalId], companyId);
    await requireAllBelongToCompany("service", [serviceId], companyId);
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

/**
 * Marca o momento em que o dono passou pela revisão e decidiu entrar no
 * sistema. Não é um gate de acesso — a Agenda/Atendimento já funcionam com
 * configuração mínima (empresa + unidade) mesmo sem isso — é só o sinal de
 * "review concluída" para fases futuras (ex.: um checklist de configuração
 * recomendada pendente).
 */
export async function completeOnboarding(companyId: string): Promise<ActionResult<null>> {
  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: null };
}
