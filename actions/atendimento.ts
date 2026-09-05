"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/actions/onboarding";

const walkInSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  client_id: z.string().uuid(),
});

export async function createWalkInAttendance(
  input: z.infer<typeof walkInSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = walkInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .insert({ ...parsed.data, origin: "walk_in", status: "in_progress" })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

/**
 * A atendimento pode nascer de um agendamento: copiamos cada
 * appointment_service (servico + profissional já reservados) para um
 * attendance_item, com o preço vigente do serviço congelado no momento
 * em que o atendimento começa de verdade — não no momento em que foi
 * agendado.
 */
export async function startAttendanceFromAppointment(appointmentId: string) {
  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointment")
    .select("id, company_id, unit_id, client_id")
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) throw new Error("Agendamento não encontrado");

  const { data: lines, error: linesError } = await supabase
    .from("appointment_service")
    .select("service_id, professional_id, service:service_id(default_price, planned_duration_minutes)")
    .eq("appointment_id", appointmentId);

  if (linesError) throw new Error(linesError.message);

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .insert({
      company_id: appointment.company_id,
      unit_id: appointment.unit_id,
      client_id: appointment.client_id,
      origin_appointment_id: appointment.id,
      origin: "from_appointment",
      status: "in_progress",
    })
    .select("id")
    .single();

  if (attendanceError || !attendance) {
    throw new Error(attendanceError?.message ?? "Erro ao criar atendimento");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (lines ?? []).map((l: any) => ({
    attendance_id: attendance.id,
    service_id: l.service_id,
    professional_id: l.professional_id,
    original_price: l.service.default_price,
    discount: 0,
    final_price: l.service.default_price,
    planned_duration_minutes: l.service.planned_duration_minutes,
  }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("attendance_item").insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }

  await supabase.from("appointment").update({ status: "in_progress" }).eq("id", appointmentId);

  revalidatePath("/agenda");
  revalidatePath("/atendimento");
}

const addItemSchema = z.object({
  attendance_id: z.string().uuid(),
  service_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  original_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  planned_duration_minutes: z.coerce.number().int().min(1),
  type: z.enum(["normal", "courtesy"]).default("normal"),
  courtesy_reason: z.string().optional(),
});

export async function addAttendanceItem(
  input: z.infer<typeof addItemSchema>
): Promise<ActionResult<null>> {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const finalPrice =
    parsed.data.type === "courtesy" ? 0 : parsed.data.original_price - parsed.data.discount;

  const supabase = await createClient();
  const { error } = await supabase.from("attendance_item").insert({
    attendance_id: parsed.data.attendance_id,
    service_id: parsed.data.service_id,
    professional_id: parsed.data.professional_id,
    original_price: parsed.data.original_price,
    discount: parsed.data.type === "courtesy" ? parsed.data.original_price : parsed.data.discount,
    final_price: finalPrice,
    type: parsed.data.type,
    courtesy_reason: parsed.data.courtesy_reason || null,
    planned_duration_minutes: parsed.data.planned_duration_minutes,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/atendimento/${parsed.data.attendance_id}`);
  return { ok: true, data: null };
}

export async function markItemStarted(itemId: string, attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_item")
    .update({ started_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/atendimento/${attendanceId}`);
}

export async function markItemEnded(itemId: string, attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_item")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/atendimento/${attendanceId}`);
}

export async function completeAttendance(attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ status: "completed" })
    .eq("id", attendanceId);
  if (error) throw new Error(error.message);
  revalidatePath("/atendimento");
  redirect("/atendimento");
}
