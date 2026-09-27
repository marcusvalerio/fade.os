# Observabilidade — Sentry

O Sentry é a única integração externa de observabilidade do CORTEX. Ele registra
erros do navegador, do servidor (Server Components, Route Handlers, Server
Actions, middleware) e do edge, com release, ambiente e rastros de navegação —
**sem dados pessoais**.

- Organização: `cortexos` (região US) · Projeto: `cortex-os`
- Painel: https://cortexos.sentry.io/issues/?project=cortex-os

## Arquivos

| Arquivo | Papel |
|---|---|
| `next.config.mjs` | `withSentryConfig` (source maps, release, túnel `/monitoramento`); injeta `NEXT_PUBLIC_CORTEX_AMBIENTE` (de `VERCEL_ENV`) e `NEXT_PUBLIC_CORTEX_RELEASE` (de `VERCEL_GIT_COMMIT_SHA`) |
| `instrumentation.ts` | carrega a config de servidor/edge; `onRequestError` captura o que estoura no Next |
| `sentry.server.config.ts`, `sentry.edge.config.ts` | `Sentry.init(opcoesDoSentry())` |
| `instrumentation-client.ts` | agenda o SDK do navegador para depois que a tela fica pronta; guarda erros que acontecem antes |
| `lib/observabilidade.ts` | opções comuns, `definirContexto`, `reportarErro` |
| `lib/observabilidade-limpeza.ts` (+ teste) | limpeza pura de eventos, breadcrumbs e spans |
| `lib/observabilidade-navegador.ts` | fachada leve do navegador (fila curta até o SDK subir) |
| `lib/observabilidade-sdk-navegador.ts` | o pedaço carregado sob demanda |
| `components/contexto-observabilidade.tsx` | marca o navegador com ids de usuário/empresa e papel |
| `app/global-error.tsx`, `app/error.tsx`, `app/(app)/error.tsx` | erros de renderização do navegador (os do servidor já chegam pelo `onRequestError`) |
| `lib/errors.ts` → `friendlyMessage` | erro inesperado que virou mensagem amigável é reportado (origem `acao` ou `configuracao`); regra de negócio e permissão **não** são |

## Ambientes e release

| Onde | `environment` | Envia? |
|---|---|---|
| Produção (Vercel) | `production` | sim, se `NEXT_PUBLIC_SENTRY_DSN` estiver definido |
| Preview (Vercel) | `preview` | sim, se `NEXT_PUBLIC_SENTRY_DSN` estiver definido |
| Local | `development` | **não**, a menos que `NEXT_PUBLIC_SENTRY_DEV=1` |

Release = commit do deploy. Cada deploy da Vercel gera uma release com o SHA; com
`SENTRY_AUTH_TOKEN` no build, os source maps sobem para ela e são apagados do
bundle público em seguida.

Amostragem de desempenho: 10% em produção, 30% em preview.

## Variáveis de ambiente

| Variável | Onde | Obrigatória | Observação |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel: Production + Preview | sim, para enviar | `https://20b99505ca6ed6fd98788cb63cb586b4@o4512099230482432.ingest.us.sentry.io/4512159586779136` — público por desenho (só diz para onde enviar) |
| `SENTRY_AUTH_TOKEN` | Vercel: Production + Preview (tipo *sensitive*) | para source maps | token de organização do Sentry com `project:releases` e `org:read`. Sem ele o build passa, só não sobe source maps |
| `SENTRY_ORG` / `SENTRY_PROJECT` | opcional | não | padrão `cortexos` / `cortex-os` |
| `SENTRY_API_TOKEN` | Vercel: Production (tipo *sensitive*) | para o Admin Saúde | token de leitura (`event:read`, `project:read`) — ver `docs/ADMIN.md`. Nunca vai ao navegador |
| `NEXT_PUBLIC_SENTRY_DEV` | só local | não | `1` liga o envio em development para testar |

> Estado em 27/09/2026: o projeto no Sentry existe e a integração foi validada
> localmente (eventos reais recebidos). **As variáveis ainda não estão na
> Vercel** — a sessão de desenvolvimento não tem permissão para criar variáveis
> de ambiente no projeto (403). Sem elas, preview e produção simplesmente não
> enviam nada; nada quebra.

Alternativa: a integração oficial Sentry ↔ Vercel (Vercel Marketplace) cria
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` e o DSN automaticamente e
associa cada deploy à release.

## O que nunca sai do CORTEX

Duas camadas:

1. **Coleta fechada no SDK** (`dataCollection`): sem cookies, sem corpo de
   requisição ou resposta, sem parâmetros de query, sem variáveis locais da
   pilha, sem dados de consulta ao banco, sem preenchimento automático de
   usuário; cabeçalhos só `user-agent`, `accept-language`, `referer`,
   `content-type`.
2. **Limpeza antes de enviar** (`beforeSend`, `beforeSendSpan`,
   `beforeBreadcrumb`, testada em `lib/observabilidade-limpeza.test.ts`):
   - e-mail, telefone, CPF, CNPJ (inclusive alfanumérico), JWT e `Bearer …`
     viram `[email]`, `[telefone]`, `[documento]`, `[token]`;
   - UUIDs em URL viram `:id` — o link de agendamento do cliente é um token;
   - valores de query string viram `[removido]`;
   - chaves com `senha`, `token`, `secret`, `key`, `cookie`, `auth`,
     `session`, `cpf`, `cnpj`, `document`, `phone`, `whatsapp`, `email` são
     removidas em qualquer nível;
   - `contexts.state` sai inteiro; o usuário vira só `{ id }`;
   - digitação (`ui.input`) não gera breadcrumb.

Contexto enviado: id do usuário, id da empresa, papel (`owner`, `admin`,
`professional`, `cliente`, `platform_admin`) e área (`produto`, `admin`,
`cliente`). Nunca nome, e-mail ou telefone.

Deliberadamente fora: **Session Replay** (gravaria a tela com nomes e telefones
de clientes) e o **widget de feedback** do Sentry (as pesquisas do CORTEX cobrem
isso, com público definido).

Recomendado no painel do Sentry (configuração do projeto, fora do código):
*Security & Privacy → Prevent Storing of IP Addresses* ligado. O Sentry deduz um
país/cidade aproximados pelo IP de envio.

## Peso no navegador

O SDK do navegador pesa ~65 kB. Carregado de forma direta, ele subia o JS
compartilhado de 103 kB para 170 kB em **toda** página, inclusive na de
agendamento do cliente. Por isso ele é baixado depois que a tela está pronta
(`requestIdleCallback`, no máximo 4 s):

- JS compartilhado com Sentry: **105 kB** (antes: 103 kB);
- erros anteriores ao carregamento ficam numa fila (até 30) e são entregues
  quando o SDK sobe, já com o contexto do usuário (validado: evento
  `origem: antes-do-sdk` recebido com usuário e empresa);
- a navegação entre telas é registrada a partir daí.

## Túnel

Eventos do navegador vão para `/monitoramento` no próprio domínio (bloqueadores
de anúncio derrubam o domínio do Sentry). A rota é excluída do middleware
(`middleware.ts`), para não passar pela sessão do Supabase.

## Como testar

```bash
NEXT_PUBLIC_SENTRY_DSN=<dsn> NEXT_PUBLIC_SENTRY_DEV=1 npx next dev
```

Dispare um erro e confira no painel com o filtro `environment:development`.
Os eventos de teste de 27/09/2026 (CORTEX-OS-1 a 4) foram resolvidos no painel
com um comentário de que eram teste.
