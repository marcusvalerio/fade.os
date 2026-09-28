"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAllBelongToCompany, requireAuthenticatedUser } from "@/lib/tenancy";
import { requireCompanyManager } from "@/lib/permissions";
import { getCurrentCompany } from "@/lib/current-company";
import { ecoDoFormulario, type ValoresEnviados } from "@/lib/form-echo";
import { friendlyMessage } from "@/lib/errors";
import { comissaoOpcionalSchema, nomePessoaSchema } from "@/lib/catalogo";
import type { ActionResult } from "@/actions/onboarding";

const professionalSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  name: nomePessoaSchema,
  role_title: z.string().optional(),
  email: z.string().email("Informe um e-mail válido, com @ e domínio.").optional().or(z.literal("")),
  phone: z.string().optional(),
  default_commission_percent: comissaoOpcionalSchema,
});

export async function createProfessionalRecord(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const parsed = professionalSchema.safeParse({
    company_id: formData.get("company_id"),
    unit_id: formData.get("unit_id"),
    name: formData.get("name"),
    role_title: formData.get("role_title") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    default_commission_percent: formData.get("default_commission_percent") || undefined,
  });

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
    .insert({
      company_id: parsed.data.company_id,
      unit_id: parsed.data.unit_id,
      name: parsed.data.name,
      role_title: parsed.data.role_title || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      default_commission_percent: parsed.data.default_commission_percent ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/profissionais");
  return { ok: true, data: { id: data.id } };
}

export type ProfessionalFormState = { error: string | null; valores?: ValoresEnviados };

/**
 * Devolve o erro em vez de estourar — mesmo caminho de serviços, clientes e
 * produtos. A validação continua sendo a mesma, incluindo a faixa de comissão
 * de 0 a 100; o que muda é a mensagem chegar à tela sem apagar o formulário.
 */
export async function createProfessionalAndRedirect(
  _prev: ProfessionalFormState,
  formData: FormData
): Promise<ProfessionalFormState> {
  const result = await createProfessionalRecord(formData);
  if (!result.ok) return { error: result.error, valores: ecoDoFormulario(formData) };
  // Fora de try/catch: redirect sinaliza por exceção e precisa subir intacto.
  redirect("/profissionais");
}

async function requireProfessionalCompany(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from("professional")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) throw new Error("Profissional não encontrado.");

  await requireCompanyManager(data.company_id);
  return data.company_id as string;
}

export async function updateProfessionalRecord(
  id: string,
  _prev: ProfessionalFormState,
  formData: FormData
): Promise<ProfessionalFormState> {
  const supabase = await createClient();
  try {
    await requireProfessionalCompany(supabase, id);
  } catch (error) {
    return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  }

  // A edição também ia direto do formulário para o banco: era por aqui que
  // uma comissão de 999% entrava depois do cadastro.
  const parsed = professionalSchema.omit({ company_id: true, unit_id: true }).safeParse({
    name: formData.get("name"),
    role_title: formData.get("role_title") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    default_commission_percent: formData.get("default_commission_percent") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message, valores: ecoDoFormulario(formData) };

  const { error } = await supabase
    .from("professional")
    .update({
      name: parsed.data.name,
      role_title: parsed.data.role_title || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      default_commission_percent: parsed.data.default_commission_percent ?? null,
    })
    .eq("id", id);

  if (error) return { error: friendlyMessage(error), valores: ecoDoFormulario(formData) };
  revalidatePath("/profissionais");
  redirect("/profissionais");
}

export async function toggleProfessionalActive(id: string, active: boolean) {
  const supabase = await createClient();
  await requireProfessionalCompany(supabase, id);

  const { error } = await supabase
    .from("professional")
    .update({ active })
    .eq("id", id);

  if (error) throw new Error(friendlyMessage(error));
  revalidatePath("/profissionais");
}

/**
 * P0.3 — owner/admin também atende clientes: NÃO cria uma segunda conta
 * nem um login sintético (isso é só para staff sem e-mail próprio, ver
 * actions/profissional-acesso.ts). Aqui a pessoa já tem uma conta real —
 * só se vincula o `professional.user_id` a ela mesma nesta empresa, o
 * mesmo sinal que getOwnProfessionalId() já usa para reconhecer "isto sou
 * eu, profissional". Desativar nunca apaga o registro: comissões e itens
 * de atendimento já lançados continuam apontando para ele.
 */
export async function setSelfProfessionalContext(enabled: boolean): Promise<ActionResult<null>> {
  const current = await getCurrentCompany();
  if (!current) return { ok: false, error: "Nenhuma empresa ativa." };
  const companyId = current.company.id;

  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("professional")
    .select("id, active")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (enabled) {
    if (existing) {
      if (!existing.active) {
        const { error } = await supabase.from("professional").update({ active: true }).eq("id", existing.id);
        if (error) return { ok: false, error: friendlyMessage(error) };
      }
    } else {
      const name = user.name || user.email || "Profissional";
      const { error } = await supabase
        .from("professional")
        .insert({ company_id: companyId, user_id: user.id, name, active: true });
      if (error) return { ok: false, error: friendlyMessage(error) };
    }
  } else if (existing?.active) {
    const { error } = await supabase.from("professional").update({ active: false }).eq("id", existing.id);
    if (error) return { ok: false, error: friendlyMessage(error) };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true, data: null };
}

export async function setProfessionalAvatar(
  id: string,
  avatarUrl: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  try {
    await requireProfessionalCompany(supabase, id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase.from("professional").update({ avatar_url: avatarUrl }).eq("id", id);
  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/profissionais");
  revalidatePath(`/profissionais/${id}`);
  return { ok: true, data: null };
}
