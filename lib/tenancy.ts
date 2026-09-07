import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * O RLS no banco já é a barreira real de isolamento entre empresas — nenhuma
 * dessas verificações substitui as policies. Isso existe como segunda
 * camada: falha rápido, com uma mensagem clara, antes de depender do banco
 * rejeitar via RLS (que também rejeitaria, só que com um erro técnico de
 * Postgres). Nunca confie em company_id vindo do cliente sem essa checagem.
 */
export class TenancyError extends Error {}

export type CompanyLink = {
  company_id: string;
  role_key: string | null;
  company: { id: string; name: string; slug: string; logo_url: string | null };
};

/**
 * Memoização por request (React cache): o layout, cada página abaixo dele e
 * cada Server Action chamada no mesmo request perguntam a mesma coisa —
 * "quem é o usuário" e "de quais empresas ele participa". Antes cada pergunta
 * virava uma ida ao Supabase: uma página com três checagens gastava ~8
 * requisições para responder sempre o mesmo. Agora a primeira paga, o resto
 * lê da memória do request.
 *
 * Isso NÃO é cache entre requests: o escopo é um request só, e a sessão
 * continua sendo validada por auth.getUser() (que verifica o token no
 * servidor) uma vez em cada um.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireAuthenticatedUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new TenancyError("Sessão expirada, faça login novamente.");
  }

  return user;
}

/**
 * Todos os vínculos do usuário, com papel e dados da empresa, numa consulta
 * só — serve o gate de acesso, o gate de gestão e o seletor de empresa.
 * Ordenado por created_at porque getCurrentCompany depende dessa ordem para
 * escolher a empresa padrão de forma determinística.
 */
export const getUserCompanyLinks = cache(async (): Promise<CompanyLink[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_company_role")
    .select("company_id, role:role_id(key), company:company_id(id, name, slug, logo_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((link) => ({
    company_id: link.company_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role_key: ((link.role as any)?.key as string | undefined) ?? null,
    company: link.company as unknown as CompanyLink["company"],
  }));
});

/** Papel do usuário nesta empresa, ou null se não houver vínculo. */
export async function getCompanyRoleKey(companyId: string): Promise<string | null> {
  const links = await getUserCompanyLinks();
  return links.find((link) => link.company_id === companyId)?.role_key ?? null;
}

export async function requireCompanyAccess(companyId: string): Promise<void> {
  await requireAuthenticatedUser();

  const links = await getUserCompanyLinks();
  if (!links.some((link) => link.company_id === companyId)) {
    throw new TenancyError("Você não tem acesso a esta empresa.");
  }
}

type OwnedTable = "unit" | "client" | "professional" | "service";

/**
 * Confirma que todo id em `ids` existe em `table` com company_id = companyId
 * — não basta o id ser um UUID válido de *algum* registro, ele precisa ser
 * dessa empresa especificamente. Use sempre que uma action receber um id
 * estrangeiro (unit_id, client_id, professional_id, service_id) do cliente
 * além do company_id: o banco (RLS + triggers) já rejeitaria um cruzamento
 * de tenant, isto só antecipa a falha com uma mensagem clara.
 */
export async function requireAllBelongToCompany(
  table: OwnedTable,
  ids: string[],
  companyId: string
): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("company_id", companyId)
    .in("id", uniqueIds);

  if (error || !data || data.length !== uniqueIds.length) {
    throw new TenancyError("Um dos itens selecionados não pertence a esta empresa.");
  }
}
