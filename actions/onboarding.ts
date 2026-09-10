"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireAllBelongToCompany } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/current-company";
import { buildReadiness, type Readiness, type ReadinessKey } from "@/lib/onboarding-readiness";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const companySchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa"),
  trade_name: z.string().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("Informe um e-mail válido, com @ e domínio.").optional().or(z.literal("")),
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
/**
 * A empresa cujo onboarding este usuário deixou pela metade, se houver.
 *
 * Não é "a primeira empresa que eu achar": é uma condição específica —
 * empresa em que ESTE usuário é owner E que nunca teve o onboarding
 * concluído. Quando existe mais de uma (resquício do bug de duplicação),
 * vale a mais recente, que é a que a pessoa estava configurando.
 */
async function findIncompleteCompany(): Promise<{ id: string; name: string } | null> {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_company_role")
    .select("company:company_id(id, name, onboarding_completed_at, created_at), role:role_id(key)")
    .eq("user_id", user.id);

  const candidates = (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((link) => (link.role as any)?.key === "owner")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((link) => link.company as any)
    .filter((company) => company && company.onboarding_completed_at === null)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return candidates[0] ? { id: candidates[0].id, name: candidates[0].name } : null;
}

/**
 * Quem pode estar no onboarding.
 *
 * O wizard existe para um primeiro acesso: conta sem empresa, ou empresa
 * ainda em configuração. Uma conta que já concluiu uma barbearia não deve
 * conseguir iniciar outra por aqui — era assim que `createCompanyStep` caía
 * em `create_company_with_owner` e criava uma segunda empresa.
 *
 * Isto é a camada de conveniência (leva a pessoa para o lugar certo em vez de
 * mostrar um formulário que vai falhar). A garantia está no banco:
 * `create_company_with_owner` recusa com EMPRESA_JA_CONFIGURADA.
 *
 * Retomar um onboarding incompleto continua permitido, inclusive para quem já
 * tem outra empresa concluída — quem manda é a empresa que está sendo
 * configurada, nunca "a primeira que eu achar".
 */
export async function getOnboardingAccess(): Promise<
  { allowed: true } | { allowed: false; redirectTo: string }
> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { allowed: false, redirectTo: "/login" };
  }

  if (await findIncompleteCompany()) return { allowed: true };

  const supabase = await createClient();
  const user = await requireAuthenticatedUser();
  const { data } = await supabase
    .from("user_company_role")
    .select("company:company_id(onboarding_completed_at)")
    .eq("user_id", user.id);

  const jaConfigurou = (data ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link) => (link.company as any)?.onboarding_completed_at !== null &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link.company as any)?.onboarding_completed_at !== undefined
  );

  return jaConfigurou ? { allowed: false, redirectTo: "/" } : { allowed: true };
}

export type OnboardingState = {
  companyId: string;
  companyName: string;
  unitId: string | null;
  unitName: string;
  professionals: { id: string; name: string }[];
  services: { id: string; name: string }[];
  products: { id: string; name: string }[];
  consumables: { id: string; name: string }[];
  paymentMethods: string[];
  hasSchedule: boolean;
};

/**
 * Estado do onboarding em andamento, para o wizard retomar de onde parou.
 *
 * Antes, tudo isso vivia só no estado do React: um refresh, um fechar de aba
 * ou um voltar depois zerava a tela — e recomeçar criava OUTRA empresa, porque
 * o passo 1 sempre inseria. O teste operacional produziu 8 empresas assim.
 */
export async function getOnboardingState(): Promise<ActionResult<OnboardingState | null>> {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const incomplete = await findIncompleteCompany();
  if (!incomplete) return { ok: true, data: null };

  const supabase = await createClient();
  const companyId = incomplete.id;

  const [units, professionals, services, products, consumables, payments] = await Promise.all([
    supabase.from("unit").select("id, name").eq("company_id", companyId).order("created_at"),
    supabase.from("professional").select("id, name").eq("company_id", companyId).order("created_at"),
    supabase.from("service").select("id, name").eq("company_id", companyId).order("created_at"),
    supabase.from("product").select("id, name").eq("company_id", companyId).order("created_at"),
    supabase.from("consumable").select("id, name").eq("company_id", companyId).order("created_at"),
    supabase.from("payment_method").select("method").eq("company_id", companyId).eq("active", true),
  ]);

  const unitIds = (units.data ?? []).map((unit) => unit.id);
  const { count: hours } = unitIds.length
    ? await supabase
        .from("unit_business_hours")
        .select("id", { count: "exact", head: true })
        .in("unit_id", unitIds)
        .eq("active", true)
    : { count: 0 };

  return {
    ok: true,
    data: {
      companyId,
      companyName: incomplete.name,
      unitId: units.data?.[0]?.id ?? null,
      unitName: units.data?.[0]?.name ?? "",
      professionals: professionals.data ?? [],
      services: services.data ?? [],
      products: products.data ?? [],
      consumables: consumables.data ?? [],
      paymentMethods: (payments.data ?? []).map((row) => row.method),
      hasSchedule: (hours ?? 0) > 0,
    },
  };
}

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

  // Idempotência: se já existe uma empresa deste dono com onboarding em
  // aberto, o passo 1 ATUALIZA aquela empresa em vez de criar mais uma.
  // Cobre refresh, duplo clique, reenvio da etapa e retorno depois de
  // abandonar — todos reproduzidos no teste operacional como duplicação.
  const incomplete = await findIncompleteCompany();
  if (incomplete) {
    const { error: updateError } = await supabase
      .from("company")
      .update({
        name: parsed.data.name,
        trade_name: parsed.data.trade_name || null,
        document: parsed.data.document || null,
        phone: parsed.data.phone || null,
        whatsapp: parsed.data.whatsapp || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        postal_code: parsed.data.postal_code || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
      })
      .eq("id", incomplete.id);

    if (updateError) return { ok: false, error: friendlyMessage(updateError) };
    return { ok: true, data: { id: incomplete.id } };
  }

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

  // Mesma idempotência do passo da empresa: o wizard configura UMA unidade,
  // então voltar a este passo edita a que já existe em vez de criar outra.
  const { data: existing } = await supabase
    .from("unit")
    .select("id")
    .eq("company_id", parsed.data.company_id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data, error } = existing
    ? await supabase.from("unit").update(parsed.data).eq("id", existing.id).select("id").single()
    : await supabase.from("unit").insert(parsed.data).select("id").single();

  if (error) return { ok: false, error: friendlyMessage(error) };
  if (existing) return { ok: true, data: { id: data.id } };

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
  email: z.string().email("Informe um e-mail válido, com @ e domínio.").optional().or(z.literal("")),
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

// ---------------------------------------------------------------------------
// Horários — o que faltava para a barbearia conseguir agendar
// ---------------------------------------------------------------------------
const scheduleSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
});

/**
 * Grava, de uma vez, o funcionamento da unidade e a jornada de todos os
 * profissionais da empresa.
 *
 * São duas tabelas diferentes porque o motor de disponibilidade cruza as duas
 * (a barbearia está aberta E o profissional está trabalhando), mas pedir isso
 * separadamente no onboarding é pedir para o dono errar. O wizard pergunta uma
 * vez "que dias e horas você abre" e aplica nos dois lugares — quem quiser
 * jornada diferente por pessoa ajusta depois, em Equipe → Jornada, que é onde
 * essa granularidade já existe.
 */
export async function setOnboardingSchedule(
  input: z.infer<typeof scheduleSchema>
): Promise<ActionResult<{ professionals: number }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.start_time >= parsed.data.end_time) {
    return { ok: false, error: "O horário de fechamento precisa ser depois do de abertura." };
  }

  try {
    await requireCompanyManager(parsed.data.company_id);
    await requireAllBelongToCompany("unit", [parsed.data.unit_id], parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { weekdays, start_time, end_time, unit_id, company_id } = parsed.data;

  const { error: hoursError } = await supabase.from("unit_business_hours").upsert(
    weekdays.map((weekday) => ({ unit_id, weekday, start_time, end_time, active: true })),
    { onConflict: "unit_id,weekday" }
  );
  if (hoursError) return { ok: false, error: friendlyMessage(hoursError) };

  const { data: professionals, error: profError } = await supabase
    .from("professional")
    .select("id")
    .eq("company_id", company_id)
    .eq("active", true);
  if (profError) return { ok: false, error: friendlyMessage(profError) };

  const rows = (professionals ?? []).flatMap((professional) =>
    weekdays.map((weekday) => ({
      professional_id: professional.id,
      weekday,
      start_time,
      end_time,
      active: true,
    }))
  );

  if (rows.length > 0) {
    const { error: scheduleError } = await supabase
      .from("professional_schedule")
      .upsert(rows, { onConflict: "professional_id,weekday" });
    if (scheduleError) return { ok: false, error: friendlyMessage(scheduleError) };
  }

  return { ok: true, data: { professionals: professionals?.length ?? 0 } };
}

// ---------------------------------------------------------------------------
// Mínimo operacional
// ---------------------------------------------------------------------------
/**
 * O que falta para esta empresa conseguir operar de verdade. Lê as sete
 * condições de lib/onboarding-readiness.ts direto do banco, escopado pela RLS
 * do próprio usuário.
 */
export async function getCompanyReadiness(companyId: string): Promise<ActionResult<Readiness>> {
  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const { data: units } = await supabase.from("unit").select("id").eq("company_id", companyId);
  const unitIds = (units ?? []).map((unit) => unit.id);

  const { data: professionals } = await supabase
    .from("professional")
    .select("id")
    .eq("company_id", companyId)
    .eq("active", true);
  const professionalIds = (professionals ?? []).map((professional) => professional.id);

  const [servicos, pagamentos, habilitacoes, funcionamento, jornadas] = await Promise.all([
    supabase.from("service").select("id", head).eq("company_id", companyId).eq("status", "active"),
    supabase.from("payment_method").select("id", head).eq("company_id", companyId).eq("active", true),
    professionalIds.length === 0
      ? { count: 0 }
      : supabase.from("professional_service").select("service_id", head).in("professional_id", professionalIds),
    unitIds.length === 0
      ? { count: 0 }
      : supabase.from("unit_business_hours").select("id", head).in("unit_id", unitIds).eq("active", true),
    professionalIds.length === 0
      ? { count: 0 }
      : supabase.from("professional_schedule").select("id", head).in("professional_id", professionalIds).eq("active", true),
  ]);

  const counts: Record<ReadinessKey, number> = {
    unidade: unitIds.length,
    profissional: professionalIds.length,
    servico: servicos.count ?? 0,
    pagamento: pagamentos.count ?? 0,
    profissional_servico: habilitacoes.count ?? 0,
    funcionamento: funcionamento.count ?? 0,
    jornada: jornadas.count ?? 0,
  };

  return { ok: true, data: buildReadiness(counts) };
}

/**
 * Fecha o onboarding. Deixou de ser um carimbo: agora o servidor confere o
 * mínimo operacional antes de marcar, porque a tela dizia "Tudo pronto" para
 * empresas que não conseguiam agendar nem receber — e um botão de conclusão é
 * um endpoint HTTP como qualquer outro, então a checagem não pode morar só no
 * wizard.
 *
 * Também deixa a empresa recém-configurada como ativa. Sem isso o dono cai na
 * empresa mais antiga da lista ao entrar no sistema, que é o que o teste
 * operacional reproduziu.
 */
export async function completeOnboarding(companyId: string): Promise<ActionResult<null>> {
  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const readiness = await getCompanyReadiness(companyId);
  if (!readiness.ok) return readiness;
  if (!readiness.data.ready) {
    return {
      ok: false,
      error: `Ainda falta configurar: ${readiness.data.missing.map((item) => item.label).join("; ")}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true, data: null };
}
