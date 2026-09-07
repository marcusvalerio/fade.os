"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

const companySettingsSchema = z.object({
  name: z.string().min(2, "Informe o nome da barbearia"),
  trade_name: z.string().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export async function updateCompanySettings(
  companyId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const parsed = companySettingsSchema.safeParse({
    name: formData.get("name"),
    trade_name: formData.get("trade_name") || undefined,
    document: formData.get("document") || undefined,
    phone: formData.get("phone") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    postal_code: formData.get("postal_code") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
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
    .eq("id", companyId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/configuracoes");
  return { ok: true, data: null };
}

const slugSchema = z.object({
  company_id: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(1, "Informe um endereço")
    .max(63, "Endereço muito longo"),
});

/**
 * Edição manual do slug público (seção 2: "quando possível, permita que o
 * proprietário escolha/edite o slug"). Delega para set_company_slug()
 * (SECURITY DEFINER) com p_auto_suffix=false — se o endereço escolhido já
 * estiver em uso, o dono recebe um erro amigável para tentar outro, em vez
 * de um sufixo surpresa como aconteceria na geração automática do
 * onboarding.
 */
export async function updateCompanySlug(
  companyId: string,
  desiredSlug: string
): Promise<ActionResult<{ slug: string }>> {
  const parsed = slugSchema.safeParse({ company_id: companyId, slug: desiredSlug });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyManager(parsed.data.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("set_company_slug", {
      p_company_id: parsed.data.company_id,
      p_desired_slug: parsed.data.slug,
      p_auto_suffix: false,
    })
    .single();

  if (error) {
    const message = String((error as { message?: string }).message ?? "");
    if (message === "SLUG_INDISPONIVEL" || message === "SLUG_RESERVED") {
      return { ok: false, error: "Esse endereço já está em uso. Tente outro." };
    }
    return { ok: false, error: friendlyMessage(error) };
  }

  revalidatePath("/configuracoes");
  return { ok: true, data: { slug: (data as { slug: string }).slug } };
}

export async function setCompanyLogo(companyId: string, logoUrl: string): Promise<ActionResult<null>> {
  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company")
    .update({ logo_url: logoUrl })
    .eq("id", companyId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/configuracoes");
  return { ok: true, data: null };
}

const unitSettingsSchema = z.object({
  name: z.string().min(2, "Informe o nome da unidade"),
  address: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  business_hours_note: z.string().optional(),
});

export async function updateUnitSettings(
  unitId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const parsed = unitSettingsSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    status: formData.get("status") || "active",
    business_hours_note: formData.get("business_hours_note") || undefined,
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("unit")
    .select("company_id")
    .eq("id", unitId)
    .maybeSingle();

  if (lookupError || !existing) return { ok: false, error: "Unidade não encontrada." };

  try {
    await requireCompanyManager(existing.company_id);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const { error } = await supabase
    .from("unit")
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      status: parsed.data.status,
      business_hours_note: parsed.data.business_hours_note || null,
    })
    .eq("id", unitId);

  if (error) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/configuracoes");
  return { ok: true, data: null };
}

/**
 * Gera (ou troca) o código de autorização da empresa.
 *
 * O código volta em texto puro UMA única vez, aqui — o banco guarda só o hash
 * bcrypt e não existe caminho para lê-lo de volta. Trocar invalida o anterior
 * na mesma hora, então quem tinha o código antigo perde a autorização
 * imediatamente.
 *
 * A checagem de owner/admin acontece dentro da RPC (SECURITY DEFINER), não
 * só aqui: chamar direto pelo PostgREST bate na mesma regra.
 */
export async function regenerateAuthorizationCode(
  companyId: string
): Promise<ActionResult<{ code: string }>> {
  try {
    await requireCompanyManager(companyId);
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("regenerate_authorization_code", { p_company_id: companyId })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/configuracoes");
  return { ok: true, data: { code: data as string } };
}

/** Só diz se a empresa já tem código configurado. Nunca devolve o valor. */
export async function hasAuthorizationCode(companyId: string): Promise<boolean> {
  try {
    await requireCompanyManager(companyId);
  } catch {
    return false;
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("has_authorization_code", { p_company_id: companyId });
  return data === true;
}
