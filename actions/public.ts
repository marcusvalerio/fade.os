"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";
import type {
  PublicCompany,
  PublicService,
  PublicProfessional,
  PublicSlot,
  PublicAppointmentCreated,
  PublicAppointment,
} from "@/lib/types";

/**
 * Actions da experiência pública (/{slug} e /{slug}/agendar). Nenhuma
 * função aqui chama requireAuthenticatedUser/requireCompanyAccess — o
 * visitante é anônimo por definição (seção 23 da Fase 3). Toda a
 * autorização e validação de tenancy acontece dentro das funções SECURITY
 * DEFINER do banco (supabase/migrations/20260908150000_phase3_public_
 * slug_and_booking.sql), nunca aqui — esta camada só normaliza input,
 * chama a RPC certa e traduz o erro.
 */

const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  BARBEARIA_NAO_ENCONTRADA: "Não encontramos essa barbearia.",
  UNIDADE_INVALIDA: "Essa unidade não pertence a esta barbearia.",
  UNIDADE_NAO_CONFIGURADA: "Esta barbearia ainda não configurou uma unidade.",
  SERVICO_INVALIDO: "Esse serviço não está disponível.",
  PROFISSIONAL_INVALIDO: "Esse profissional não está disponível.",
  PROFISSIONAL_NAO_HABILITADO: "Esse profissional não realiza esse serviço.",
  HORARIO_INDISPONIVEL: "Esse horário acabou de ser reservado. Escolha outro horário.",
  HORARIO_NO_PASSADO: "Escolha um horário no futuro.",
  NOME_INVALIDO: "Informe um nome válido.",
  TELEFONE_INVALIDO: "Informe um telefone válido, com DDD.",
  EMAIL_INVALIDO: "Informe um e-mail válido.",
};

function friendlyPublicMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (PUBLIC_ERROR_MESSAGES[message]) return PUBLIC_ERROR_MESSAGES[message];
  }
  return friendlyMessage(error);
}

const slugSchema = z.string().min(1).max(63);

export async function getPublicCompany(slug: string): Promise<ActionResult<PublicCompany | null>> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false, error: "Endereço inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_public_company", { p_slug: parsed.data })
    .maybeSingle();

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: (data as PublicCompany | null) ?? null };
}

export async function getPublicServices(slug: string): Promise<ActionResult<PublicService[]>> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false, error: "Endereço inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_services", { p_slug: parsed.data });

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: (data ?? []) as PublicService[] };
}

export async function getPublicTeam(slug: string): Promise<ActionResult<PublicProfessional[]>> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false, error: "Endereço inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_team", { p_slug: parsed.data });

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: (data ?? []) as PublicProfessional[] };
}

export async function getPublicProfessionals(
  slug: string,
  serviceId: string
): Promise<ActionResult<PublicProfessional[]>> {
  const parsed = z.object({ slug: slugSchema, serviceId: z.string().uuid() }).safeParse({ slug, serviceId });
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_professionals", {
    p_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
  });

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: (data ?? []) as PublicProfessional[] };
}

const slotsSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  professionalId: z.string().uuid().optional(),
});

export async function getPublicAvailableSlots(input: {
  slug: string;
  serviceId: string;
  date: string;
  professionalId?: string;
}): Promise<ActionResult<PublicSlot[]>> {
  const parsed = slotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_available_slots", {
    p_slug: parsed.data.slug,
    p_service_id: parsed.data.serviceId,
    p_date: parsed.data.date,
    p_professional_id: parsed.data.professionalId ?? null,
  });

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: (data ?? []) as PublicSlot[] };
}

const PHONE_DIGITS_MIN = 10;
const PHONE_DIGITS_MAX = 13;

const createAppointmentSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.string().min(1, "Escolha um horário"),
  clientName: z.string().trim().min(2, "Informe seu nome").max(120),
  clientPhone: z
    .string()
    .trim()
    .refine(
      (v) => {
        const digits = v.replace(/\D/g, "");
        return digits.length >= PHONE_DIGITS_MIN && digits.length <= PHONE_DIGITS_MAX;
      },
      { message: "Informe um telefone válido, com DDD." }
    ),
  clientEmail: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
});

export async function createPublicAppointment(input: {
  slug: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
}): Promise<ActionResult<PublicAppointmentCreated>> {
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_public_appointment", {
      p_slug: parsed.data.slug,
      p_service_id: parsed.data.serviceId,
      p_professional_id: parsed.data.professionalId,
      p_starts_at: new Date(parsed.data.startsAt).toISOString(),
      p_client_name: parsed.data.clientName,
      p_client_phone: parsed.data.clientPhone,
      p_client_email: parsed.data.clientEmail || null,
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: data as PublicAppointmentCreated };
}

const tokenSchema = z.string().uuid();

export async function getPublicAppointment(token: string): Promise<ActionResult<PublicAppointment | null>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Agendamento não encontrado." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_public_appointment", { p_token: parsed.data })
    .maybeSingle();

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: (data as PublicAppointment | null) ?? null };
}

export async function cancelPublicAppointment(token: string): Promise<ActionResult<{ cancelled: boolean }>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: "Agendamento não encontrado." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_public_appointment", { p_token: parsed.data });

  if (error) return { ok: false, error: friendlyPublicMessage(error) };
  return { ok: true, data: { cancelled: Boolean(data) } };
}
