import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { destinoSeguro } from "@/lib/notificacoes/catalogo";
import { reportarErro } from "@/lib/observabilidade";

/**
 * Clique numa notificação (push do sistema ou central): confere que é da
 * pessoa logada, marca como aberta e lida, e leva ao contexto dela.
 *
 * O destino que vale é o gravado no banco (abrir_notificacao). O ?destino=
 * que o service worker manda só é usado quando não há sessão (o próprio
 * destino pede login da área certa — equipe ou cliente) e, como tudo aqui,
 * só pode ser caminho interno: nunca redireciona para fora do CORTEX.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = destinoSeguro(req.nextUrl.searchParams.get("destino"));
  const ir = (caminho: string) => NextResponse.redirect(new URL(caminho, req.nextUrl.origin));

  if (!UUID.test(id)) return ir(pedido ?? "/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return ir(pedido ?? "/login");

  const { data, error } = await supabase.rpc("abrir_notificacao", { p_id: id });
  if (error) {
    // De outra pessoa (ou apagada): segue sem revelar nada.
    if (!/NOTIFICACAO_NAO_ENCONTRADA/.test(error.message)) {
      reportarErro(error, "notificacoes.abrir");
    }
    return ir(pedido ?? "/notificacoes");
  }
  return ir(destinoSeguro(data as string | null) ?? "/notificacoes");
}
