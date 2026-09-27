"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAuthProvider } from "@/infrastructure/auth/supabase/auth-provider";
import { friendlyAuthMessage } from "@/lib/errors";
import { passwordSchema } from "@/lib/auth-validation";
import { COOKIE_CLIENTE } from "@/lib/cliente-conta";
import { trustedOrigin } from "@/actions/auth";
import type { ActionResult } from "@/actions/onboarding";

/**
 * A conta do cliente final — quem marca horário na página da barbearia.
 *
 * Mesmo Supabase Auth da equipe, outro contexto: o vínculo com a barbearia
 * mora em client_identity e só nasce por e-mail verificado
 * (link_client_identity, no banco). Nada aqui dá acesso ao produto interno —
 * quem é só cliente é levado para /[slug]/minha-conta em todas as portas do
 * app (ver lib/cliente-conta.ts).
 */
const authProvider = createSupabaseAuthProvider();

const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);

export type ClienteAuthState = { error: string | null; enviadoPara?: string };

async function marcarBarbearia(slug: string) {
  // O login pelo Google e o link de confirmação de e-mail voltam por
  // /auth/oauth-callback; este cookie diz para qual barbearia voltar.
  (await cookies()).set(COOKIE_CLIENTE, slug, { maxAge: 60 * 60 * 24, path: "/", sameSite: "lax", httpOnly: true });
}

export async function entrarComoCliente(
  slug: string,
  _prev: ClienteAuthState,
  formData: FormData
): Promise<ClienteAuthState> {
  const slugOk = slugSchema.safeParse(slug);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!slugOk.success) return { error: "Barbearia não encontrada." };
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const result = await authProvider.signInWithPassword({ email, password });
  if (!result.ok) {
    return {
      error: /confirm/i.test(result.error)
        ? "Confirme o seu e-mail pelo link que enviamos antes de entrar."
        : "E-mail ou senha incorretos.",
    };
  }
  redirect(`/${slug}/minha-conta`);
}

const cadastroSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Informe o telefone com DDD"),
  password: passwordSchema,
});

export async function criarContaDeCliente(
  slug: string,
  _prev: ClienteAuthState,
  formData: FormData
): Promise<ClienteAuthState> {
  const slugOk = slugSchema.safeParse(slug);
  if (!slugOk.success) return { error: "Barbearia não encontrada." };
  const parsed = cadastroSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await marcarBarbearia(slug);
  const origin = await trustedOrigin();
  const result = await authProvider.signUpWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
    emailRedirectTo: `${origin}/auth/oauth-callback`,
    metadata: { cliente_slug: slug, ...(parsed.data.phone ? { phone: parsed.data.phone } : {}) },
  });
  if (!result.ok) return { error: friendlyAuthMessage(result.error) };
  if (result.data.hasSession) redirect(`/${slug}/minha-conta`);
  return { error: null, enviadoPara: parsed.data.email };
}

/** Prepara o retorno do Google para esta barbearia (chamado antes do redirecionamento). */
export async function prepararEntradaGoogle(slug: string): Promise<ActionResult<null>> {
  const slugOk = slugSchema.safeParse(slug);
  if (!slugOk.success) return { ok: false, error: "Barbearia não encontrada." };
  await marcarBarbearia(slug);
  return { ok: true, data: null };
}

export async function sairDaContaDeCliente(slug: string) {
  await authProvider.signOut();
  redirect(`/${slugSchema.safeParse(slug).success ? slug : ""}`);
}

export type PerfilDoCliente = {
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  company_name: string;
};

/**
 * Vincula (idempotente) e devolve o perfil do cliente autenticado nesta
 * barbearia. Chamado pela área do cliente e pelo agendamento autenticado.
 */
export async function perfilDoCliente(slug: string, telefone?: string): Promise<ActionResult<PerfilDoCliente>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("link_client_identity", { p_slug: slug, p_name: null, p_phone: telefone ?? null })
    .maybeSingle();
  if (error || !data) {
    const code = error?.message ?? "";
    return {
      ok: false,
      error:
        code === "EMAIL_NAO_CONFIRMADO"
          ? "Confirme o seu e-mail pelo link que enviamos antes de continuar."
          : code === "NAO_AUTENTICADO"
            ? "Entre na sua conta para continuar."
            : code === "BARBEARIA_INDISPONIVEL"
              ? "Esta barbearia não está atendendo pelo CORTEX no momento."
              : "Não foi possível abrir a sua conta agora.",
    };
  }
  return { ok: true, data: data as PerfilDoCliente };
}

export type MeuAgendamento = {
  appointment_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  services: string;
  professional_name: string;
  client_access_token: string;
};

export async function meusAgendamentos(slug: string): Promise<ActionResult<MeuAgendamento[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_client_appointments", { p_slug: slug });
  if (error) return { ok: false, error: "Não foi possível carregar os seus horários agora." };
  return { ok: true, data: (data ?? []) as MeuAgendamento[] };
}

const MENSAGENS_AGENDAMENTO: Record<string, string> = {
  HORARIO_INDISPONIVEL: "Esse horário acabou de ser reservado. Escolha outro horário.",
  HORARIO_NO_PASSADO: "Escolha um horário no futuro.",
  CLIENTE_NAO_VINCULADO: "Entre na sua conta desta barbearia para marcar.",
  NAO_AUTENTICADO: "Entre na sua conta para marcar.",
  SERVICO_INVALIDO: "Esse serviço não está disponível.",
  PROFISSIONAL_INVALIDO: "Esse profissional não está disponível.",
  BARBEARIA_INDISPONIVEL: "Esta barbearia não está aceitando agendamentos no momento.",
};

export type AgendamentoDoCliente = {
  appointment_id: string;
  client_access_token: string;
  starts_at: string;
  ends_at: string;
};

/**
 * Agendamento feito por um cliente autenticado: as mesmas validações do
 * agendamento público, mas o cliente vem da identidade (create_client_appointment)
 * — o horário entra no histórico certo, não no de quem tiver o mesmo telefone.
 */
export async function agendarComoCliente(input: {
  slug: string;
  serviceIds: string[];
  professionalId: string;
  startsAt: string;
}): Promise<ActionResult<AgendamentoDoCliente>> {
  if (!slugSchema.safeParse(input.slug).success || input.serviceIds.length === 0) {
    return { ok: false, error: "Escolha ao menos um serviço." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_client_appointment", {
      p_slug: input.slug,
      p_service_ids: input.serviceIds,
      p_professional_id: input.professionalId,
      p_starts_at: input.startsAt,
      p_unit_id: null,
    })
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: MENSAGENS_AGENDAMENTO[error?.message ?? ""] ?? "Não foi possível marcar agora. Tente de novo." };
  }
  return { ok: true, data: data as AgendamentoDoCliente };
}
