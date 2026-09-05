"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess, requireAllBelongToCompany } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";
import type { AppointmentStatus } from "@/lib/types";

const serviceLineSchema = z.object({
  service_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
});

const createAppointmentSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  client_id: z.string().uuid(),
  lines: z.array(serviceLineSchema).min(1, "Adicione ao menos um serviço"),
});

export async function createAppointment(
  input: z.infer<typeof createAppointmentSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyAccess(parsed.data.company_id);
    await requireAllBelongToCompany("unit", [parsed.data.unit_id], parsed.data.company_id);
    await requireAllBelongToCompany("client", [parsed.data.client_id], parsed.data.company_id);
    await requireAllBelongToCompany(
      "service",
      parsed.data.lines.map((l) => l.service_id),
      parsed.data.company_id
    );
    await requireAllBelongToCompany(
      "professional",
      parsed.data.lines.map((l) => l.professional_id),
      parsed.data.company_id
    );
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointment")
    .insert({
      company_id: parsed.data.company_id,
      unit_id: parsed.data.unit_id,
      client_id: parsed.data.client_id,
    })
    .select("id")
    .single();

  if (appointmentError || !appointment) {
    return { ok: false, error: friendlyMessage(appointmentError) };
  }

  const rows = parsed.data.lines.map((line) => ({
    appointment_id: appointment.id,
    service_id: line.service_id,
    professional_id: line.professional_id,
    starts_at: new Date(line.starts_at).toISOString(),
    ends_at: new Date(line.ends_at).toISOString(),
  }));

  const { error: linesError } = await supabase.from("appointment_service").insert(rows);

  if (linesError) {
    // Compensating action: don't leave an appointment with no services behind.
    await supabase.from("appointment").delete().eq("id", appointment.id);

    return { ok: false, error: friendlyMessage(linesError) };
  }

  revalidatePath("/agenda");
  return { ok: true, data: { id: appointment.id } };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
) {
  const supabase = await createClient();

  const { data: existing, error: lookupError } = await supabase
    .from("appointment")
    .select("company_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (lookupError || !existing) {
    throw new Error("Agendamento não encontrado.");
  }

  await requireCompanyAccess(existing.company_id);

  const { error } = await supabase
    .from("appointment")
    .update({ status })
    .eq("id", appointmentId);

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/agenda");
}
