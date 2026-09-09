"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import { businessInstant } from "@/lib/time";
import type { ActionResult } from "@/actions/onboarding";
import type { AvailableSlot } from "@/lib/types";

/**
 * Bloqueios e ausências chegam de um `<input type="datetime-local">`, que não
 * carrega fuso: "14:00" só quer dizer 14:00 na barbearia. Jornadas, intervalos
 * e funcionamento da unidade não passam por aqui porque são colunas `time` —
 * relógio de parede puro, que o motor SQL já ancora em America/Sao_Paulo.
 */
function parseBusinessRange(
  startsAt: string,
  endsAt: string
): { start: Date; end: Date } | { error: string } {
  let start: Date;
  let end: Date;
  try {
    start = businessInstant(startsAt);
    end = businessInstant(endsAt);
  } catch {
    return { error: "Data e hora inválidas." };
  }
  if (!(end > start)) return { error: "O fim precisa ser depois do início." };
  return { start, end };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function requireProfessionalCompanyId(supabase: Supa, professionalId: string): Promise<string> {
  const { data, error } = await supabase
    .from("professional")
    .select("company_id")
    .eq("id", professionalId)
    .maybeSingle();

  if (error || !data) throw new Error("Profissional não encontrado.");
  await requireCompanyManager(data.company_id);
  return data.company_id as string;
}

async function requireUnitCompanyId(supabase: Supa, unitId: string): Promise<string> {
  const { data, error } = await supabase
    .from("unit")
    .select("company_id")
    .eq("id", unitId)
    .maybeSingle();

  if (error || !data) throw new Error("Unidade não encontrada.");
  await requireCompanyManager(data.company_id);
  return data.company_id as string;
}

// ---------------------------------------------------------------------------
// Jornada semanal do profissional
// ---------------------------------------------------------------------------
const scheduleDaySchema = z.object({
  professional_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  active: z.boolean(),
});

export async function setProfessionalScheduleDay(
  input: z.infer<typeof scheduleDaySchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.active && parsed.data.start_time >= parsed.data.end_time) {
    return { ok: false, error: "Horário final precisa ser depois do inicial." };
  }

  const supabase = await createClient();
  try {
    await requireProfessionalCompanyId(supabase, parsed.data.professional_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .from("professional_schedule")
    .upsert(
      {
        professional_id: parsed.data.professional_id,
        weekday: parsed.data.weekday,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        active: parsed.data.active,
      },
      { onConflict: "professional_id,weekday" }
    )
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/profissionais/${parsed.data.professional_id}/jornada`);
  return { ok: true, data: { id: data.id } };
}

async function requireScheduleCompanyId(supabase: Supa, scheduleId: string): Promise<string> {
  const { data, error } = await supabase
    .from("professional_schedule")
    .select("professional_id, professional:professional_id(company_id)")
    .eq("id", scheduleId)
    .maybeSingle();

  if (error || !data) throw new Error("Jornada não encontrada.");
  const companyId = (data.professional as unknown as { company_id: string })?.company_id;
  await requireCompanyManager(companyId);
  return companyId;
}

export async function addScheduleBreak(
  scheduleId: string,
  startTime: string,
  endTime: string
): Promise<ActionResult<{ id: string }>> {
  if (startTime >= endTime) return { ok: false, error: "Horário final precisa ser depois do inicial." };

  const supabase = await createClient();
  try {
    await requireScheduleCompanyId(supabase, scheduleId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .from("professional_schedule_break")
    .insert({ schedule_id: scheduleId, start_time: startTime, end_time: endTime })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/profissionais");
  return { ok: true, data: { id: data.id } };
}

export async function removeScheduleBreak(breakId: string, professionalId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  try {
    await requireProfessionalCompanyId(supabase, professionalId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.from("professional_schedule_break").delete().eq("id", breakId);
  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/profissionais/${professionalId}/jornada`);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Jornada de funcionamento da unidade
// ---------------------------------------------------------------------------
const unitHoursDaySchema = z.object({
  unit_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  start_time: z.string().min(4),
  end_time: z.string().min(4),
  active: z.boolean(),
});

export async function setUnitBusinessHoursDay(
  input: z.infer<typeof unitHoursDaySchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = unitHoursDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.active && parsed.data.start_time >= parsed.data.end_time) {
    return { ok: false, error: "Horário final precisa ser depois do inicial." };
  }

  const supabase = await createClient();
  try {
    await requireUnitCompanyId(supabase, parsed.data.unit_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .from("unit_business_hours")
    .upsert(
      {
        unit_id: parsed.data.unit_id,
        weekday: parsed.data.weekday,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        active: parsed.data.active,
      },
      { onConflict: "unit_id,weekday" }
    )
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/configuracoes");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Bloqueios manuais
// ---------------------------------------------------------------------------
const blockSchema = z.object({
  professional_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  reason: z.string().optional(),
});

export async function createProfessionalBlock(
  input: z.infer<typeof blockSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const range = parseBusinessRange(parsed.data.starts_at, parsed.data.ends_at);
  if ("error" in range) return { ok: false, error: range.error };

  const supabase = await createClient();
  try {
    await requireProfessionalCompanyId(supabase, parsed.data.professional_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .from("professional_block")
    .insert({
      professional_id: parsed.data.professional_id,
      unit_id: parsed.data.unit_id || null,
      starts_at: range.start.toISOString(),
      ends_at: range.end.toISOString(),
      reason: parsed.data.reason || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/profissionais/${parsed.data.professional_id}/jornada`);
  return { ok: true, data: { id: data.id } };
}

export async function cancelProfessionalBlock(
  blockId: string,
  professionalId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  try {
    await requireProfessionalCompanyId(supabase, professionalId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase
    .from("professional_block")
    .update({ status: "cancelled" })
    .eq("id", blockId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/profissionais/${professionalId}/jornada`);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Ausências
// ---------------------------------------------------------------------------
const absenceSchema = z.object({
  professional_id: z.string().uuid(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  type: z.enum(["vacation", "day_off", "leave", "holiday", "other"]),
  reason: z.string().optional(),
});

export async function createProfessionalAbsence(
  input: z.infer<typeof absenceSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const range = parseBusinessRange(parsed.data.starts_at, parsed.data.ends_at);
  if ("error" in range) return { ok: false, error: range.error };

  const supabase = await createClient();
  try {
    await requireProfessionalCompanyId(supabase, parsed.data.professional_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .from("professional_absence")
    .insert({
      professional_id: parsed.data.professional_id,
      starts_at: range.start.toISOString(),
      ends_at: range.end.toISOString(),
      type: parsed.data.type,
      reason: parsed.data.reason || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/profissionais/${parsed.data.professional_id}/jornada`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteProfessionalAbsence(
  absenceId: string,
  professionalId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  try {
    await requireProfessionalCompanyId(supabase, professionalId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.from("professional_absence").delete().eq("id", absenceId);
  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/profissionais/${professionalId}/jornada`);
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// O motor em si — wrapper fino sobre a função SQL. Nunca recalcula nada em
// TypeScript: toda a lógica de disponibilidade mora no Postgres (get_available_slots),
// esta função só chama a RPC e tipa o retorno.
// ---------------------------------------------------------------------------
export async function getAvailableSlots(params: {
  company_id: string;
  unit_id: string;
  service_id: string;
  date: string; // "YYYY-MM-DD"
  professional_id?: string;
}): Promise<ActionResult<AvailableSlot[]>> {
  try {
    await requireCompanyAccess(params.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_company_id: params.company_id,
    p_unit_id: params.unit_id,
    p_service_id: params.service_id,
    p_date: params.date,
    p_professional_id: params.professional_id ?? null,
  });

  if (error) return { ok: false, error: friendlyMessage(error) };
  return { ok: true, data: (data ?? []) as AvailableSlot[] };
}
