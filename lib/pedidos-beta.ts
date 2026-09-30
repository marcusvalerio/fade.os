/**
 * Pedidos de acesso ao Beta aguardando decisão — o texto da faixa
 * "IMPORTANTE" do Admin e a regra de quando avisar.
 *
 * Duas coisas separadas de propósito:
 *   - PENDÊNCIA é o estado do pedido (`beta_access_requests.status =
 *     'pending'`). A faixa mostra isso e só isso: não depende de nenhuma
 *     notificação ter chegado, então um aviso que falhou nunca esconde um
 *     pedido.
 *   - AVISO é "esta aba já contou para a pessoa que este pedido chegou".
 *     `novosPedidos` responde isso por id, para o mesmo pedido nunca gerar
 *     dois avisos na mesma aba.
 *
 * Sem imports de servidor: roda no navegador e nos testes.
 */

export type PedidoPendente = {
  id: string;
  nome: string;
  barbearia: string;
  criadoEm: string;
};

export type PedidosPendentes = { total: number; recentes: PedidoPendente[] };

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** "1 pedido de acesso aguardando" / "3 pedidos de acesso aguardando". */
export function tituloDaFaixa(total: number): string {
  return total === 1 ? "1 pedido de acesso aguardando" : `${total} pedidos de acesso aguardando`;
}

/**
 * Quem pediu. Um pedido: "Victorio, da Barbearia X, pediu acesso ao
 * CORTEX.OS". Vários: o mais recente e quantos mais.
 */
export function descricaoDaFaixa(p: PedidosPendentes): string {
  const [ultimo] = p.recentes;
  if (!ultimo) return "Quem pediu acesso está esperando aprovação para começar.";
  const quem = primeiroNome(ultimo.nome) || "Alguém";
  const onde = ultimo.barbearia.trim() ? `, da ${ultimo.barbearia.trim()},` : "";
  const base = `${quem}${onde} pediu acesso ao CORTEX.OS`;
  const outros = p.total - 1;
  if (outros <= 0) return `${base}.`;
  return `${base} — e mais ${outros} ${outros === 1 ? "pedido espera" : "pedidos esperam"} decisão.`;
}

/**
 * Pedidos que esta aba ainda não viu. `vistos` começa com os pedidos já na
 * tela ao abrir: chegar ao Admin com 2 pendentes não é "chegaram 2 agora".
 */
export function novosPedidos(vistos: ReadonlySet<string>, recentes: PedidoPendente[]): PedidoPendente[] {
  return recentes.filter((r) => !vistos.has(r.id));
}
