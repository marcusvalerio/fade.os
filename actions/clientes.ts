"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess } from "@/lib/tenancy";
import { ecoDoFormulario, type ValoresEnviados } from "@/lib/form-echo";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const clientSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(2, "Informe o nome do cliente"),
  phone: z.string().optional(),
  email: z.string().email("Informe um e-mail válido, com @ e domínio.").optional().or(z.literal("")),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
  communication_consent: z.boolean().default(true),
});

export type ClientFormState = { error: string | null; valores?: ValoresEnviados };

/**
 * Devolve o erro em vez de estourar — o mesmo caminho já usado no catálogo.
 * `throw` numa Server Action de formulário cai na error boundary: a pessoa
 * perde tudo o que digitou e vê uma tela de erro genérica no lugar da frase
 * que explica o que está errado.
 *
 * A validação NÃO muda: é o mesmo `clientSchema`, com as mesmas mensagens.
 * O que muda é como o erro chega à tela.
 */
export async function createClientRecord(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const supabase = await createClient();
  const parsed = clientSchema.safeParse({
    company_id: formData.get("company_id"),
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    birth_date: formData.get("birth_date") || undefined,
    notes: formData.get("notes") || undefined,
    communication_consent: formData.get("communication_consent") === "on",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message, valores: ecoDoFormulario(formData) };

  try {
    await requireCompanyAccess(parsed.data.company_id);
  } catch (error) {
    return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  }

  const { error } = await supabase.from("client").insert(parsed.data);
  if (error) return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };

  revalidatePath("/clientes");
  // Fora de try/catch de propósito: redirect sinaliza por exceção e precisa
  // subir intacto.
  redirect("/clientes");
}

export async function updateClientRecord(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const supabase = await createClient();

  // client não chega com company_id do form — deriva do próprio registro
  // (a leitura já é escopada por RLS) e confirma que o usuário tem acesso
  // a essa empresa antes de aceitar o update, em vez de depender só do
  // RLS silenciosamente não afetar nenhuma linha.
  const { data: existing, error: lookupError } = await supabase
    .from("client")
    .select("company_id")
    .eq("id", clientId)
    .maybeSingle();

  if (lookupError || !existing) return { error: "Cliente não encontrado." };

  try {
    await requireCompanyAccess(existing.company_id);
  } catch (error) {
    return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  }

  const { error } = await supabase
    .from("client")
    .update({
      name: formData.get("name"),
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      birth_date: formData.get("birth_date") || null,
      notes: formData.get("notes") || null,
      communication_consent: formData.get("communication_consent") === "on",
    })
    .eq("id", clientId);

  if (error) return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };

  revalidatePath("/clientes");
  redirect("/clientes");
}
