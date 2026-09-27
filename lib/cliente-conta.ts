import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getUserCompanyLinks } from "@/lib/tenancy";

/**
 * Conta do cliente final — o lado de quem marca horário, separado da equipe.
 *
 * Um mesmo login do Supabase pode ser cliente de uma barbearia (vínculo em
 * client_identity) e, em tese, membro da equipe de outra. A equipe sempre
 * prevalece: só é "só cliente" quem não tem nenhum vínculo de equipe. Para
 * esse, o lugar é /[slug]/minha-conta — nunca o onboarding de dono, que
 * criaria uma barbearia por engano, nem o produto interno.
 */
export const barbeariasDoCliente = cache(async (): Promise<{ slug: string; name: string }[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_client_barbershops");
  return (data ?? []) as { slug: string; name: string }[];
});

/** Para onde levar um usuário autenticado que é só cliente; null se não for. */
export async function destinoDoClienteSemEquipe(): Promise<string | null> {
  const links = await getUserCompanyLinks();
  if (links.length > 0) return null;
  const barbearias = await barbeariasDoCliente();
  return barbearias.length > 0 ? `/${barbearias[0].slug}/minha-conta` : null;
}

/** Cookie curto que marca "este login começou na área do cliente desta barbearia". */
export const COOKIE_CLIENTE = "cortex-cliente";
