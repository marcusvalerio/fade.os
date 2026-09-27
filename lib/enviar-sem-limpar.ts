import type { FormEvent } from "react";

/**
 * Enviar um formulário sem apagar o que a pessoa digitou.
 *
 * Com `<form action={fn}>`, o React 19 reseta o formulário quando `fn`
 * termina — inclusive quando o servidor RECUSOU os dados. Campo não
 * controlado volta ao `defaultValue` (vazio, ou o valor antigo) e caixa
 * controlada volta a como nasceu. Um CNPJ inválido apagava a etapa inteira do
 * onboarding; nas Configurações os campos voltavam ao valor salvo e o próximo
 * "Salvar" mandava o dado antigo sem ninguém perceber.
 *
 * Pelo `onSubmit` nada é resetado. O formulário que deve nascer vazio depois
 * de um SUCESSO (adicionar mais um item) faz isso ele mesmo — trocando a
 * `key` ou chamando `form.reset()` —, nunca no erro.
 *
 *   <form onSubmit={enviarSemLimpar(handleSubmit)}>
 *
 * Os formulários de `useActionState` ligados direto a uma Server Action nas
 * telas públicas seguem com `action` (funcionam antes da hidratação e a senha
 * nunca vai parar na URL) e devolvem o que foi enviado como `defaultValue`,
 * como em lib/form-echo.ts.
 */
export function enviarSemLimpar(enviar: (dados: FormData, form: HTMLFormElement) => void) {
  return (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const form = evento.currentTarget;
    enviar(new FormData(form), form);
  };
}
