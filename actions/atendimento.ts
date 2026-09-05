"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess, requireAllBelongToCompany } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
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

  try {
    await requireCompanyAccess(parsed.data.company_id);
    await requireAllBelongToCompany("unit", [parsed.data.unit_id], parsed.data.company_id);
    await requireAllBelongToCompany("client", [parsed.data.client_id], parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .insert({ ...parsed.data, origin: "walk_in", status: "in_progress" })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyMessage(error) };
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

  if (linesError) throw new Error(friendlyMessage(linesError));

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
    throw new Error(attendanceError ? friendlyMessage(attendanceError) : "Erro ao criar atendimento");
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
    if (itemsError) throw new Error(friendlyMessage(itemsError));
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

  const { data: attendance, error: attendanceLookupError } = await supabase
    .from("attendance")
    .select("company_id")
    .eq("id", parsed.data.attendance_id)
    .maybeSingle();

  if (attendanceLookupError || !attendance) {
    return { ok: false, error: "Atendimento não encontrado." };
  }

  try {
    await requireAllBelongToCompany("service", [parsed.data.service_id], attendance.company_id);
    await requireAllBelongToCompany(
      "professional",
      [parsed.data.professional_id],
      attendance.company_id
    );
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

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

  if (error) return { ok: false, error: friendlyMessage(error) };
  revalidatePath(`/atendimento/${parsed.data.attendance_id}`);
  return { ok: true, data: null };
}

export async function markItemStarted(itemId: string, attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_item")
    .update({ started_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath(`/atendimento/${attendanceId}`);
}

export async function markItemEnded(itemId: string, attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_item")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath(`/atendimento/${attendanceId}`);
}

export async function completeAttendance(attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ status: "completed" })
    .eq("id", attendanceId);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/atendimento");
  redirect("/atendimento");
}

export async function cancelAttendance(attendanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ status: "cancelled" })
    .eq("id", attendanceId);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/atendimento");
  redirect("/atendimento");
}

const updateItemSchema = z.object({
  discount: z.coerce.number().min(0),
  type: z.enum(["normal", "courtesy"]),
  courtesy_reason: z.string().optional(),
});

export async function updateAttendanceItem(
  itemId: string,
  attendanceId: string,
  input: z.infer<typeof updateItemSchema>
): Promise<ActionResult<null>> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: item, error: fetchError } = await supabase
    .from("attendance_item")
    .select("original_price")
    .eq("id", itemId)
    .single();

  if (fetchError || !item) return { ok: false, error: "Item não encontrado" };

  const finalPrice =
    parsed.data.type === "courtesy" ? 0 : Number(item.original_price) - parsed.data.discount;

  const { error } = await supabase
    .from("attendance_item")
    .update({
      discount: parsed.data.type === "courtesy" ? item.original_price : parsed.data.discount,
      final_price: finalPrice,
      type: parsed.data.type,
      courtesy_reason: parsed.data.courtesy_reason || null,
    })
    .eq("id", itemId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/atendimento/${attendanceId}`);
  return { ok: true, data: null };
}
