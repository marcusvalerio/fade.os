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
 * O início de atendimento vindo da Agenda é uma operação atômica no banco.
 *
 * Isso resolve dois problemas operacionais de uma vez:
 * - double-click/retry não cria dois atendimentos para o mesmo agendamento;
 * - se um dos serviços reservados não puder mais entrar no atendimento,
 *   attendance + itens + mudança de status são revertidos juntos.
 */
export async function startAttendanceFromAppointment(appointmentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("start_attendance_from_appointment", {
      p_appointment_id: appointmentId,
    })
    .single();

  if (error || !data) {
    throw new Error(friendlyMessage(error));
  }

  revalidatePath("/agenda");
  revalidatePath("/atendimento");
  revalidatePath(`/atendimento/${data as string}`);

  return data as string;
}

/**
 * O preço NUNCA vem do formulário. `original_price` e `unit_price` costumavam
 * chegar do cliente e serem gravados como estão — um payload modificado
 * transformava um corte de R$ 80 num item de R$ 1, e o registro ficava
 * internamente consistente porque o backend nunca teve o preço certo.
 *
 * Agora o valor é sempre lido de `service.default_price` / `product.sale_price`
 * no momento em que o item entra no atendimento (congelar o preço vigente é
 * intencional: reajustar o catálogo depois não pode mexer num atendimento em
 * andamento). O formulário só decide quantidade, desconto e cortesia.
 */
const authorizationCodeSchema = z.string().trim().min(1).optional();

const addItemSchema = z.object({
  attendance_id: z.string().uuid(),
  service_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  discount: z.coerce.number().min(0).default(0),
  type: z.enum(["normal", "courtesy"]).default("normal"),
  courtesy_reason: z.string().optional(),
  authorization_code: authorizationCodeSchema,
});

const addProductItemSchema = z.object({
  attendance_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().min(1).default(1),
  discount: z.coerce.number().min(0).default(0),
  type: z.enum(["normal", "courtesy"]).default("normal"),
  courtesy_reason: z.string().optional(),
  authorization_code: authorizationCodeSchema,
});

/**
 * A entrada de item passa pelas RPCs add_attendance_*_item em vez de um
 * insert solto. O motivo é a autorização: a marca deixada por
 * authorize_operation vale só dentro da transação, então apresentar o código
 * e escrever o item precisam acontecer na mesma chamada ao banco.
 *
 * A validação de verdade (preço do catálogo, profissional habilitado, unidade,
 * desconto e cortesia autorizados) mora no trigger trg_attendance_item_integrity.
 * Estas funções são só o caminho sancionado até lá — um INSERT direto no
 * PostgREST bate no mesmo trigger.
 */
export async function addAttendanceProductItem(
  input: z.infer<typeof addProductItemSchema>
): Promise<ActionResult<null>> {
  const parsed = addProductItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  try {
    await requireAttendanceCompany(supabase, parsed.data.attendance_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.rpc("add_attendance_product_item", {
    p_attendance_id: parsed.data.attendance_id,
    p_product_id: parsed.data.product_id,
    p_quantity: parsed.data.quantity,
    p_discount: parsed.data.discount,
    p_type: parsed.data.type,
    p_courtesy_reason: parsed.data.courtesy_reason ?? null,
    p_authorization_code: parsed.data.authorization_code ?? null,
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

  const supabase = await createClient();

  try {
    await requireAttendanceCompany(supabase, parsed.data.attendance_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.rpc("add_attendance_service_item", {
    p_attendance_id: parsed.data.attendance_id,
    p_service_id: parsed.data.service_id,
    p_professional_id: parsed.data.professional_id,
    p_discount: parsed.data.discount,
    p_type: parsed.data.type,
    p_courtesy_reason: parsed.data.courtesy_reason ?? null,
    p_authorization_code: parsed.data.authorization_code ?? null,
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

/**
 * Remove um item lançado por engano, antes da conclusão. Estoque e comissão
 * só são gerados em close_attendance() — um item ainda "solto" no atendimento
 * nunca baixou estoque nem criou comissão, então apagá-lo aqui não deixa
 * nada para reverter. A trigger trg_attendance_item_immutable (banco) já
 * bloqueia DELETE quando attendance.status = 'completed'; isto é a segunda
 * camada, com mensagem amigável em vez do erro técnico do Postgres.
 */
export async function removeAttendanceItem(
  itemId: string,
  attendanceId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  try {
    await requireAttendanceItemCompany(supabase, itemId, attendanceId);

    const { data: attendance } = await supabase
      .from("attendance")
      .select("status")
      .eq("id", attendanceId)
      .maybeSingle();
    if (attendance?.status === "completed") {
      return { ok: false, error: "Este atendimento já foi concluído — não é possível remover itens." };
    }

    const { error } = await supabase.from("attendance_item").delete().eq("id", itemId);
    if (error) return { ok: false, error: friendlyMessage(error) };
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }
  revalidatePath(`/atendimento/${attendanceId}`);
  return { ok: true, data: null };
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
  authorization_code: z.string().trim().min(1).optional(),
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
      p_authorization_code: parsed.data.authorization_code ?? null,
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/atendimento");
  revalidatePath("/caixa");
  revalidatePath("/financeiro");
  revalidatePath("/comissoes");
  // P0.7: close_attendance() agora também marca appointment.status='completed'
  // quando o atendimento nasceu de um agendamento — sem isto a Agenda (cache
  // de servidor) só refletiria isso na próxima navegação sem relação.
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true, data: { saleId: data as string } };
}

export async function cancelAttendance(attendanceId: string) {
  const supabase = await createClient();
  await requireAttendanceCompany(supabase, attendanceId);

  const { data: attendance, error: lookupError } = await supabase
    .from("attendance")
    .select("status, origin_appointment_id")
    .eq("id", attendanceId)
    .maybeSingle();

  if (lookupError || !attendance) {
    throw new Error("Atendimento não encontrado.");
  }

  if (attendance.status !== "in_progress") {
    throw new Error(
      attendance.status === "completed"
        ? "Este atendimento já foi concluído e não pode ser cancelado."
        : "Este atendimento já foi cancelado."
    );
  }

  const { error } = await supabase
    .from("attendance")
    .update({ status: "cancelled" })
    .eq("id", attendanceId)
    .eq("status", "in_progress");

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/atendimento");
  revalidatePath("/agenda");
  redirect("/atendimento");
}

const updateItemSchema = z.object({
  discount: z.coerce.number().min(0),
  type: z.enum(["normal", "courtesy"]),
  courtesy_reason: z.string().optional(),
  authorization_code: z.string().trim().min(1).optional(),
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

  // O recálculo de final_price e a exigência de autorização vivem no trigger;
  // aqui não se decide preço nenhum.
  const { error } = await supabase.rpc("update_attendance_item", {
    p_item_id: itemId,
    p_discount: parsed.data.discount,
    p_type: parsed.data.type,
    p_courtesy_reason: parsed.data.courtesy_reason ?? null,
    p_authorization_code: parsed.data.authorization_code ?? null,
  });

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath(`/atendimento/${attendanceId}`);
  return { ok: true, data: null };
}
