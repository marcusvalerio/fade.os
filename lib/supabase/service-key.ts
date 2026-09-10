/**
 * A chave de serviço tem forma reconhecível?
 *
 * Antes a checagem era uma lista de literais ("your-service-role-key" e
 * companhia). Lista de placeholder só pega o placeholder que alguém previu:
 * qualquer outro valor errado — chave rotacionada, `xxx` digitado às pressas,
 * ou a chave publicável colada no lugar da secreta — passava pela porta e ia
 * morrer no Supabase como "Invalid API key". E aí a tela dizia "Tente
 * novamente", que é o conselho errado para um problema que nunca se resolve
 * sozinho.
 *
 * Conferir a FORMA inverte isso: em vez de tentar reconhecer os valores
 * inválidos, reconhece-se os válidos. Hoje o Supabase emite dois formatos — o
 * JWT legado (`eyJ…`, três segmentos) e a chave secreta nova (`sb_secret_…`).
 * Qualquer coisa fora disso é configuração incompleta.
 *
 * Isto NÃO diz que a chave funciona: uma chave bem formada e revogada só é
 * descoberta no primeiro uso. Diz que vale a pena tentar — o que basta para
 * separar "o ambiente não está configurado" de "deu erro, tente de novo".
 *
 * Vive num módulo próprio, sem dependência nenhuma, para poder ser testado
 * sem carregar o cliente do Supabase.
 */
export function pareceChaveDeServico(chave: string): boolean {
  const c = chave.trim();
  // A publicável é segura de expor e não autoriza nada de admin; colada aqui,
  // é engano de instalação, não uma chave a testar.
  if (c.startsWith("sb_publishable_")) return false;
  if (c.startsWith("sb_secret_")) return c.length > "sb_secret_".length;
  return c.startsWith("eyJ") && c.split(".").length === 3;
}
