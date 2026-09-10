/**
 * O que a pessoa digitou, de volta para a tela.
 *
 * O React 19 reseta os campos não controlados assim que uma Server Action
 * retorna — mesmo quando ela retornou um ERRO. Na prática: o formulário
 * recusava o preço negativo, escrevia a frase certa em português… e apagava
 * o nome, a categoria e todo o resto. A pessoa lia a explicação e encontrava
 * o formulário em branco.
 *
 * A saída é devolver o que veio junto com o erro, e usar isso como
 * `defaultValue`. Assim o campo renasce com o valor que a pessoa tinha
 * escrito, e ela corrige só o que estava errado.
 *
 * Só valores de texto atravessam: File e Blob não têm por que voltar, e
 * mandá-los de volta pelo estado seria carregar binário à toa.
 */
export type ValoresEnviados = Record<string, string>;

export function ecoDoFormulario(formData: FormData): ValoresEnviados {
  const eco: ValoresEnviados = {};
  for (const [chave, valor] of formData.entries()) {
    if (typeof valor === "string") eco[chave] = valor;
  }
  return eco;
}
