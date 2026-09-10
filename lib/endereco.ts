/**
 * Composição do endereço para exibição.
 *
 * A vitrine mostrava o endereço duas vezes:
 *
 *   "Rua da Assembleia, 21 — Centro, Rio de Janeiro/RJ, Rio de Janeiro — RJ"
 *
 * A causa não é dado sujo — o valor gravado está certo. `unit.address` é um
 * endereço completo, digitado por quem cadastrou a unidade, e já costuma
 * terminar em cidade/UF; a página concatenava `company.city` e
 * `company.state` por cima sem olhar o que já estava lá.
 *
 * Por isso a correção é de apresentação, e não de dado: o que está no banco
 * continua exatamente como está. Aqui só se decide o que ainda falta dizer.
 */

/** Sem acento, sem caixa, sem espaço repetido — só para comparar. */
function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A cidade já aparece no endereço?
 *
 * Comparação por chave para que "Rio de Janeiro", "rio de janeiro" e
 * "RIO DE JANEIRO" sejam a mesma coisa.
 */
function jaContemCidade(base: string, cidade: string): boolean {
  const c = chave(cidade);
  return c.length > 0 && chave(base).includes(c);
}

/**
 * A UF já aparece no endereço?
 *
 * Aqui `includes` não serve: "RJ" está dentro de "Marjorie", e "SP" dentro de
 * "Espírito". A UF é uma sigla isolada, então ela precisa estar cercada por
 * algo que não seja letra — vírgula, barra, travessão, espaço ou a ponta da
 * string.
 */
function jaContemUf(base: string, uf: string): boolean {
  const u = chave(uf);
  if (u.length === 0) return false;
  return new RegExp(`(^|[^a-z0-9])${u}([^a-z0-9]|$)`).test(chave(base));
}

export type PartesEndereco = {
  /** Endereço da unidade; costuma ser o mais completo. */
  unitAddress?: string | null;
  /** Endereço da empresa, usado quando a unidade não tem o seu. */
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

/**
 * Devolve a linha de endereço pronta para exibir, ou `null` quando não há
 * endereço nenhum — nesse caso quem chama não deve renderizar o parágrafo.
 *
 * Cidade e UF só entram se ainda não estiverem no endereço. Nunca se remove
 * nada do que foi digitado: se o texto gravado já diz tudo, ele é usado como
 * está.
 */
export function composeEndereco({ unitAddress, address, city, state }: PartesEndereco): string | null {
  const base = (unitAddress || address || "").trim();
  if (!base) return null;

  const cidade = (city ?? "").trim();
  const uf = (state ?? "").trim();

  const faltaCidade = cidade.length > 0 && !jaContemCidade(base, cidade);
  const faltaUf = uf.length > 0 && !jaContemUf(base, uf);

  if (faltaCidade && faltaUf) return `${base}, ${cidade} — ${uf}`;
  if (faltaCidade) return `${base}, ${cidade}`;
  // Sem a cidade, a UF sozinha viraria "Rua X, RJ", que é pior do que o
  // endereço puro: dá a impressão de que a cidade é "RJ". Só se acrescenta a
  // UF isolada quando a cidade já está escrita no endereço.
  if (faltaUf && jaContemCidade(base, cidade)) return `${base} — ${uf}`;

  return base;
}
