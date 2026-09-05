import { createClient } from "@/lib/supabase/server";

/**
 * NAO IMPLEMENTADO (decisao aberta #6 do Architecture Blueprint): seletor
 * de "empresa ativa" para usuarios com acesso a mais de uma empresa.
 * Nesta fase, se o usuario tiver mais de um vinculo em user_company_role,
 * sempre usamos o primeiro (mais antigo). Isso é suficiente para o
 * fluxo de dono-unico-de-uma-barbearia do vertical slice, mas precisa
 * de uma decisao de produto (seletor no topo da tela) antes de vender
 * para consultores/usuarios multiempresa.
 */
export async function getCurrentCompany() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_company_role")
    .select("company_id, role:role_id(key,name), company:company_id(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    company: data.company as unknown as { id: string; name: string },
    roleKey: (data.role as unknown as { key: string })?.key ?? null,
  };
}
