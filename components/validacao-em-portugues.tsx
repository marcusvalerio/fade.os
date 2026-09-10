"use client";

import { useEffect } from "react";

/**
 * Faz o navegador falar português.
 *
 * O sistema valida em duas camadas: o HTML no cliente (`required`, `type`,
 * `maxLength`) e o Zod no servidor, que é a autoridade. O problema não era a
 * camada do servidor — as mensagens dela sempre estiveram em português. Era
 * que o navegador barrava o envio ANTES, e o balão que ele mostrava vinha na
 * língua do navegador: "Please fill out this field", "Please enter an email
 * address". O usuário nunca chegava a ver a mensagem da aplicação.
 *
 * Havia dois caminhos. Um era pôr `noValidate` em todo formulário e deixar o
 * Zod responder — mas boa parte das ações de hoje lança o erro em vez de
 * devolvê-lo à tela, então tirar a checagem do navegador trocaria um balão em
 * inglês por uma página de erro. O outro, que é este, é manter a checagem e
 * traduzir o balão.
 *
 * Um só ouvinte, em fase de captura, cobre todo formulário da aplicação —
 * inclusive os que ainda nem existem. `invalid` não borbulha, mas é
 * capturável, e é por isso que o ouvinte fica no documento e não em cada
 * campo.
 */

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function ehCampo(alvo: EventTarget | null): alvo is Campo {
  return (
    alvo instanceof HTMLInputElement ||
    alvo instanceof HTMLSelectElement ||
    alvo instanceof HTMLTextAreaElement
  );
}

/** O rótulo do campo, quando dá para descobrir — ajuda a mensagem a ser concreta. */
function mensagem(campo: Campo): string {
  const v = campo.validity;
  const tipo = campo instanceof HTMLInputElement ? campo.type : "";

  if (v.valueMissing) {
    if (campo instanceof HTMLSelectElement) return "Escolha uma opção.";
    if (tipo === "checkbox" || tipo === "radio") return "Marque esta opção para continuar.";
    if (tipo === "date") return "Escolha uma data.";
    if (tipo === "time") return "Escolha um horário.";
    return "Preencha este campo.";
  }

  if (v.typeMismatch) {
    if (tipo === "email") return "Informe um e-mail válido, com @ e domínio.";
    if (tipo === "url") return "Informe um endereço começando com https://";
    return "Informe um valor válido para este campo.";
  }

  // badInput é o que acontece quando o campo é numérico e o conteúdo não é
  // um número — o valor nem chega a existir para o servidor.
  if (v.badInput) {
    if (tipo === "number") return "Informe apenas números.";
    if (tipo === "date") return "Informe uma data válida.";
    if (tipo === "time") return "Informe um horário válido.";
    return "Informe um valor válido para este campo.";
  }

  if (v.tooShort && "minLength" in campo) return `Use pelo menos ${campo.minLength} caracteres.`;
  if (v.tooLong && "maxLength" in campo) return `Use no máximo ${campo.maxLength} caracteres.`;

  if (v.rangeUnderflow && "min" in campo) return `O menor valor aceito é ${campo.min}.`;
  if (v.rangeOverflow && "max" in campo) return `O maior valor aceito é ${campo.max}.`;
  if (v.stepMismatch) return "Este valor não é aceito neste campo.";

  // `title` é onde o formulário explica o formato esperado (a senha, por
  // exemplo). Se o autor escreveu, é melhor do que qualquer texto genérico.
  if (v.patternMismatch) return campo.title?.trim() || "Preencha no formato esperado.";

  return "Confira este campo.";
}

export function ValidacaoEmPortugues() {
  useEffect(() => {
    const aoInvalidar = (evento: Event) => {
      const campo = evento.target;
      if (!ehCampo(campo)) return;
      // customValidity próprio (posto por algum formulário) tem precedência:
      // quem escreveu sabe mais sobre o campo do que este tradutor.
      if (campo.validity.customError) return;
      campo.setCustomValidity(mensagem(campo));
    };

    // Uma mensagem customizada gruda: enquanto ela existir, o campo continua
    // inválido mesmo depois de corrigido. Limpar a cada digitação devolve a
    // decisão ao navegador.
    const aoEditar = (evento: Event) => {
      const campo = evento.target;
      if (ehCampo(campo) && campo.validationMessage) campo.setCustomValidity("");
    };

    document.addEventListener("invalid", aoInvalidar, true);
    document.addEventListener("input", aoEditar, true);
    document.addEventListener("change", aoEditar, true);
    return () => {
      document.removeEventListener("invalid", aoInvalidar, true);
      document.removeEventListener("input", aoEditar, true);
      document.removeEventListener("change", aoEditar, true);
    };
  }, []);

  return null;
}
