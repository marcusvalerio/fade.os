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

/**
 * Os valores padrão de um formulário depois de um envio: o que a pessoa
 * enviou vence o que está no banco, campo por campo.
 *
 * - texto, textarea e select: o valor enviado; sem eco, o do banco.
 * - checkbox: com eco, marcada só se veio no envio (o FormData omite caixa
 *   desmarcada) — desmarcar e errar não pode religar o que estava no banco.
 * - radio: com eco, a opção enviada.
 *
 * Um valor por nome: grupos de checkbox com o mesmo `name` não cabem aqui.
 *
 * Atenção ao select num formulário com `action`: o React só aplica o
 * `defaultValue` de um select ao montar, então depois do reset automático ele
 * volta à opção da montagem. Com `enviarSemLimpar` não há reset e a escolha
 * fica no próprio campo.
 */
export function lerEco(eco: ValoresEnviados | undefined) {
  return {
    texto: (chave: string, doBanco?: string | number | null) => eco?.[chave] ?? (doBanco != null ? String(doBanco) : ""),
    opcao: (chave: string, doBanco?: string | null) => eco?.[chave] ?? doBanco ?? undefined,
    marcado: (chave: string, doBanco: boolean) => (eco ? chave in eco : doBanco),
    escolhido: (chave: string, opcao: string, doBanco: boolean) => (eco ? eco[chave] === opcao : doBanco),
  };
}
