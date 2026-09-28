import { startTransition, useActionState, useRef, useState, useTransition, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import { capturarNoNavegador } from "@/lib/observabilidade-navegador";
import { classificarFalha, mensagemDaFalha } from "@/lib/falha-de-envio";
import { ecoDoFormulario, lerEco, type ValoresEnviados } from "@/lib/form-echo";

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

/**
 * O que fazer com uma exceção no meio de um envio.
 *
 * `redirect()` e `notFound()` do Next viajam como exceção — são o fim feliz
 * de quem redireciona — e sobem intactos para o Next navegar. O resto vira
 * uma das duas frases de lib/falha-de-envio.ts; o que não é queda de rede da
 * própria pessoa vai para o Sentry.
 */
export function falhaNoEnvio(erro: unknown, origem: string): string {
  unstable_rethrow(erro);
  const tipo = classificarFalha(erro);
  if (tipo !== "rede") capturarNoNavegador(erro, `envio:${origem}`);
  return mensagemDaFalha(tipo);
}

/**
 * Envio com "Salvando…" que sempre termina.
 *
 * - Um envio por vez: clique duplo ou Enter repetido não mandam de novo.
 * - Recusa, exceção, queda de rede, tempo esgotado: `aoFalhar` recebe a frase
 *   certa e o pendente acaba no `finally`, aconteça o que acontecer.
 *
 *   const { pendente, enviar } = useEnvio("configuracoes.unidade");
 *   enviar(async () => { const r = await acao(); ... }, setErro);
 */
export function useEnvio(origem: string) {
  const [pendente, setPendente] = useState(false);
  const emAndamento = useRef(false);
  // Só para entregar um redirect do Next ao limite de erro dele (ver o catch).
  const [, devolverAoNext] = useTransition();

  async function enviar(fazer: () => Promise<void>, aoFalhar: (mensagem: string) => void) {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setPendente(true);
    try {
      await fazer();
    } catch (erro) {
      let mensagem: string;
      try {
        mensagem = falhaNoEnvio(erro, origem);
      } catch (doNext) {
        // Lançado dentro de uma transição, o React leva o erro ao limite mais
        // próximo — o do Next, que navega.
        devolverAoNext(() => {
          throw doNext;
        });
        return;
      }
      aoFalhar(mensagem);
    } finally {
      emAndamento.current = false;
      setPendente(false);
    }
  }

  return { pendente, enviar };
}

/**
 * `useActionState` pelo `onSubmit`, com a mesma garantia de `useEnvio`.
 *
 * O envio não passa por `action`, então o React não reseta nada: texto,
 * select, checkbox e radio ficam como a pessoa deixou. Exceção, queda de
 * rede ou resposta estranha viram o estado de erro que `falha` monta — a tela
 * não cai na error boundary. `redirect()` da Server Action continua navegando,
 * e o `useFormStatus` (BotaoDeAcao) continua vendo o envio pendente.
 */
export function useEnvioComEstado<E extends object>(
  acao: (anterior: E, dados: FormData) => Promise<E>,
  inicial: E,
  { origem, falha }: { origem: string; falha: (mensagem: string, dados: FormData, anterior: E) => E }
) {
  const emAndamento = useRef(false);
  const [estado, despachar, pendente] = useActionState<E, FormData>(async (anterior, dados) => {
    try {
      const resultado = await acao(anterior as E, dados);
      // Um estado que não é objeto quebraria a tela na primeira leitura.
      if (resultado === null || typeof resultado !== "object") throw new Error(`Envio sem resultado: ${origem}`);
      return resultado;
    } catch (erro) {
      return falha(falhaNoEnvio(erro, origem), dados, anterior as E);
    } finally {
      emAndamento.current = false;
    }
  }, inicial as Awaited<E>);

  const aoEnviar = enviarSemLimpar((dados) => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    startTransition(() => despachar(dados));
  });

  return { estado, aoEnviar, pendente };
}

export type EstadoComEco = { error: string | null; valores?: ValoresEnviados };

/**
 * O formulário de cadastro com eco (cliente, serviço, produto, profissional,
 * material): `useEnvioComEstado` + o eco como fonte dos valores padrão. Depois
 * de um erro, o campo e o eco dizem a mesma coisa: vale o último envio, não o
 * que está no banco.
 */
export function useFormularioComEco(
  acao: (anterior: EstadoComEco, dados: FormData) => Promise<EstadoComEco>,
  origem: string
) {
  const envio = useEnvioComEstado<EstadoComEco>(acao, { error: null }, {
    origem,
    falha: (error, dados, anterior) => ({ ...anterior, error, valores: ecoDoFormulario(dados) }),
  });
  return { ...envio, eco: lerEco(envio.estado.valores) };
}
