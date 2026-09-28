# Formulários — o que foi digitado não se perde

A regra do CORTEX: **um erro nunca apaga o trabalho de quem está digitando, e
nenhum envio fica preso em "Salvando…".** Enquanto o servidor não confirmar, o
formulário fica exatamente como a pessoa deixou — texto, select, checkbox,
radio, textarea. Só depois do sucesso ele limpa (criação), fecha, atualiza a
lista ou navega.

## Por que existe uma regra

Com `<form action={fn}>`, o React 19 reseta o formulário quando `fn` termina —
também quando o servidor recusou os dados. Campo não controlado volta ao
`defaultValue`, caixa controlada volta a como nasceu, e o select volta à opção
da montagem (o React não reaplica o `defaultValue` de um select depois de
montado). E uma exceção dentro da action — rede caiu, erro 500 — troca a tela
inteira pela de erro. Foi assim que um CNPJ inválido apagava o onboarding, que
um consentimento desmarcado voltava marcado e era salvo, e que um produto da
unidade B era gravado na unidade A.

## Como

| Caso | Use (`lib/enviar-sem-limpar.ts`) |
|---|---|
| Handler no cliente chamando uma Server Action que devolve `{ ok, error }` | `onSubmit={enviarSemLimpar(handleSubmit)}` + `useEnvio(origem)` → `enviar(fazer, aoFalhar)` |
| Server Action `(estado, formData) => estado` de cadastro (cliente, serviço, produto, profissional, material) | `useFormularioComEco(action, origem)` → `{ estado, aoEnviar, eco }`; valores padrão por `eco.texto`, `eco.opcao`, `eco.marcado`, `eco.escolhido` |
| Outro formato de estado | `useEnvioComEstado(action, inicial, { origem, falha })` |
| Página pública que precisa funcionar antes da hidratação (login, `/beta`, esqueci/redefinir/primeira senha, login do Admin, entrar da área do cliente) | fica com `action` e devolve o que foi enviado como `defaultValue` (`ecoDoFormulario`, em `lib/form-echo.ts`). Não converta. |

Os hooks garantem, sem nada a mais em cada tela:

- um envio por vez — clique duplo e Enter repetido não mandam de novo;
- o pendente termina no `finally`, aconteça o que acontecer;
- `redirect()` e `notFound()` da Server Action continuam navegando;
- exceção vira uma das duas frases padrão e, se não for queda de rede da
  própria pessoa, vai para o Sentry com a origem `envio:<origem>`.

Limpar depois do sucesso: trocar a `key` do formulário (onboarding, intervalos
da jornada) ou `form.reset()` (bloqueios, ausências). Nunca no erro, nunca
amarrado a `pending`.

`BotaoDeAcao` com `rotuloConcluido` recebe `falhou={Boolean(estado.error)}`:
`pending` desce tanto no sucesso quanto no erro, e um erro não é "concluído ✓".

## Mensagens

- Validação e regra de negócio: a frase que o servidor já escreve.
- Sem conexão, tempo esgotado, resposta que não é do app: "Não foi possível
  conectar ao CORTEX. Verifique sua conexão e tente novamente."
- Qualquer outra exceção: "Não foi possível salvar. Revise os dados e tente
  novamente."

As duas vivem em `lib/falha-de-envio.ts`. Nunca o texto técnico ("Failed to
fetch", "NEXT_REDIRECT").

## Testes

`lib/form-echo.test.ts` e `lib/falha-de-envio.test.ts` cobrem o eco (texto,
select, checkbox ON/OFF, radio, combinação) e a classificação das falhas. O
comportamento no navegador foi validado com os componentes reais no Chromium,
com as Server Actions simuladas (validação real, falhas injetadas: rede, tempo
esgotado, exceção, resposta vazia, redirect).

## Ainda fora do padrão (auditoria de 28/09/2026)

Não perdem o que foi digitado quando o servidor recusa (são controlados e
enviam por `onSubmit`), mas numa queda de rede:

- **ficam em "Salvando…"** (pendente manual sem `finally`): agendamento novo,
  reagendar, walk-in, itens do atendimento (adicionar, produto, editar),
  fechamento do atendimento, ajuste de estoque, despesa, PDV, cancelar venda,
  pagar comissões, código de autorização, excluir conta, "eu também atendo",
  avaliação e reagendamento do cliente, importação de clientes, ações do Admin
  (confirmar, aprovar beta, nova senha do beta, pesquisa);
- **trocam a tela pela de erro** (transição sem `catch`): caixa, marcar
  comissão paga, formas de pagamento, horário da unidade, meta mensal,
  agendamento público, pesquisa discreta.

Os de dinheiro (PDV, fechamento, caixa, comissões, despesa, estoque, cancelar
venda) pedem uma decisão antes de ganhar o `useEnvio`: depois de uma falha
ambígua (o pedido pode ter chegado), liberar o botão convida a lançar duas
vezes.
