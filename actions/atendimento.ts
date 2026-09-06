"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess, requireAllBelongToCompany, TenancyError } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

async function requireAttendanceCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  attendanceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("attendance")
    .select("company_id")
    .eq("id", attendanceId)
    .maybeSingle();

  if (error || !data) throw new TenancyError("Atendimento não encontrado.");

  await requireCompanyAccess(data.company_id);

  return data.company_id;
}

async function requireAttendanceItemCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  attendanceId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("attendance_item")
    .select("attendance_id")
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data || data.attendance_id !== attendanceId) {
    throw new TenancyError("Item não encontrado neste atendimento.");
  }

  await requireAttendanceCompany(supabase, attendanceId);
}

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

  await requireCompanyAccess(appointment.company_id);

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

const addProductItemSchema = z.object({
  attendance_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().min(1).default(1),
  unit_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
});

export async function addAttendanceProductItem(
  input: z.infer<typeof addProductItemSchema>
): Promise<ActionResult<null>> {
  const parsed = addProductItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

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
    await requireCompanyAccess(attendance.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data: product, error: productError } = await supabase
    .from("product")
    .select("company_id, current_stock")
    .eq("id", parsed.data.product_id)
    .maybeSingle();

  if (productError || !product || product.company_id !== attendance.company_id) {
    return { ok: false, error: "Produto não encontrado nesta empresa." };
  }

  const total = parsed.data.unit_price * parsed.data.quantity;
  const finalPrice = total - parsed.data.discount;

  const { error } = await supabase.from("attendance_item").insert({
    attendance_id: parsed.data.attendance_id,
    kind: "product",
    product_id: parsed.data.product_id,
    quantity: parsed.data.quantity,
    original_price: total,
    discount: parsed.data.discount,
    final_price: finalPrice,
    type: "normal",
  });

  if (error) return { ok: false, error: friendlyMessage(error) };
  revalidatePath(`/atendimento/${parsed.data.attendance_id}`);
  return { ok: true, data: null };
}

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
  await requireAttendanceItemCompany(supabase, itemId, attendanceId);

  const { error } = await supabase
    .from("attendance_item")
    .update({ started_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath(`/atendimento/${attendanceId}`);
}

export async function markItemEnded(itemId: string, attendanceId: string) {
  const supabase = await createClient();
  await requireAttendanceItemCompany(supabase, itemId, attendanceId);

  const { error } = await supabase
    .from("attendance_item")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw new Error(friendlyMessage(error));
  revalidatePath(`/atendimento/${attendanceId}`);
}

const closeAttendanceSchema = z.object({
  attendance_id: z.string().uuid(),
  discount_amount: z.coerce.number().min(0).default(0),
  surcharge_amount: z.coerce.number().min(0).default(0),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "pix", "debit", "credit", "credit_installments"]),
        amount: z.coerce.number().positive(),
      })
    )
    .default([]),
});

/**
 * Fecha o atendimento de verdade: cria a venda + itens + comissão + baixa
 * de estoque + pagamentos + lançamento financeiro, tudo atômico via
 * public.close_attendance() (supabase/migrations/…_phase4_functions.sql).
 * Substitui o antigo completeAttendance(), que só marcava o status sem
 * gerar nenhuma das entidades que a Fase 4 exige (venda/pagamento).
 */
export async function closeAttendance(
  input: z.infer<typeof closeAttendanceSchema>
): Promise<ActionResult<{ saleId: string }>> {
  const parsed = closeAttendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  try {
    await requireAttendanceCompany(supabase, parsed.data.attendance_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { data, error } = await supabase
    .rpc("close_attendance", {
      p_attendance_id: parsed.data.attendance_id,
      p_discount_amount: parsed.data.discount_amount,
      p_surcharge_amount: parsed.data.surcharge_amount,
      p_payments: parsed.data.payments,
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/atendimento");
  revalidatePath("/caixa");
  revalidatePath("/financeiro");
  revalidatePath("/comissoes");
  return { ok: true, data: { saleId: data as string } };
}

export async function cancelAttendance(attendanceId: string) {
  const supabase = await createClient();
  await requireAttendanceCompany(supabase, attendanceId);

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

  try {
    await requireAttendanceItemCompany(supabase, itemId, attendanceId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

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
