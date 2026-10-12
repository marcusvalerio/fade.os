"use server";

import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform-permissions";
import type { PedidosPendentes } from "@/lib/pedidos-beta";

/**
 * Pedidos de Beta pendentes, para a faixa "IMPORTANTE" do Admin.
 *
 * Lê `beta_access_requests` com a sessão de quem pede: a política
 * `beta_access_requests_select` só devolve linhas para platform admin ativo,
 * e a checagem abaixo recusa antes de consultar. Quem não é admin recebe
 * nada — nunca um erro que diga que existem pedidos.
 *
 * Devolve só o que a faixa mostra (primeiro nome, barbearia, quando). E-mail
 * e telefone ficam na tela de Acessos.
 */
export async function pedidosBetaPendentes(): Promise<PedidosPendentes | null> {
  if (!(await isPlatformAdmin())) return null;

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("beta_access_requests")
    .select("id, name, barbershop_name, created_at", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return null;

  return {
    total: count ?? data?.length ?? 0,
    recentes: (data ?? []).map((r) => ({
      id: r.id as string,
      nome: ((r.name as string) ?? "").trim().split(/\s+/)[0] ?? "",
      barbearia: (r.barbershop_name as string) ?? "",
      criadoEm: r.created_at as string,
    })),
  };
}
