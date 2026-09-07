"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess, requireAllBelongToCompany } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";
import type { AppointmentStatus } from "@/lib/types";

/**
 * Sem `ends_at`: a duração é service.planned_duration_minutes, derivada pelo
 * banco. O formulário tinha um campo de fim livre, o que permitia reservar 5
 * minutos para um serviço de uma hora e liberar o resto da agenda.
 */
const serviceLineSchema = z.object({
  service_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  starts_at: z.string().min(1),
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
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();

  // Toda a validação de disponibilidade mora no banco — profissional da
  // empresa, ativo, desta unidade, que executa o serviço, dentro da jornada e
  // do funcionamento da unidade, fora de intervalos, bloqueios e ausências, e
  // sem conflito. Antes, a Server Action checava só a empresa e o restante era
  // confiado ao que a UI oferecia; hoje a UI é conselho, o banco é a regra.
  //
  // A função também substitui o insert em duas etapas com compensação manual:
  // ou o agendamento inteiro existe, ou nada existe.
  const { data, error } = await supabase
    .rpc("create_internal_appointment", {
      p_company_id: parsed.data.company_id,
      p_unit_id: parsed.data.unit_id,
      p_client_id: parsed.data.client_id,
      p_lines: parsed.data.lines.map((line) => ({
        service_id: line.service_id,
        professional_id: line.professional_id,
        starts_at: new Date(line.starts_at).toISOString(),
      })),
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/agenda");
  return { ok: true, data: { id: data as string } };
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
