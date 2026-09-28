# Notificações do CORTEX

Infraestrutura de notificações: central no sistema (sino), push no aparelho
pelo Firebase Cloud Messaging, preferências por pessoa, avisos automáticos
dos eventos do CORTEX, comunicados do Admin e pesquisas enviadas com funil.

Nenhum segredo está neste documento. Onde aparece uma variável, o valor
vive na Vercel ou no Supabase Vault.

## 1. Arquitetura

```
evento do CORTEX (agenda, caixa, estoque, comissão, acesso, avaliação…)
  │  trigger no Postgres (ou lib/notificacoes/servidor.ts, ou comunicado do Admin)
  ▼
notificar(tipo, pessoa, empresa, público, …)          ← ponto único de criação
  │  confere: tipo existe · público permitido para o tipo · RBAC real
  │  (papel na empresa / conta de cliente) · preferência (obrigatórias
  │  ignoram) · chave única (o mesmo evento nunca duas vezes)
  ▼
notificacao  +  notificacao_entrega(in_app, entregue)
  │  push ligado e aparelhos ativos?
  ▼
notificacao_entrega(push, pendente) por aparelho   (ou sem_dispositivo)
  │  pg_net depois do commit · pg_cron a cada minuto · sino (polling)
  ▼
/api/notificacoes/processar (segredo) → fila (FOR UPDATE SKIP LOCKED)
  │  FCM HTTP v1 (JWT da conta de serviço, node:crypto)
  ▼
enviada · token_invalido (aparelho invalidado) · pendente (nova tentativa) · falhou
  │  erro inesperado / configuração → Sentry (sem token, sem chave)
```

Princípios:

- **O Supabase é a fonte de verdade.** A notificação existe no banco mesmo
  com push bloqueado, aparelho offline ou Firebase não configurado. O FCM é
  só um canal de entrega.
- **Eventos nascem no banco.** Muitas operações são RPCs chamadas direto do
  navegador; um trigger garante que nenhum caminho esquece de avisar.
- **Notificar nunca desfaz a operação.** Cada trigger engole o próprio erro
  e deixa um `WARNING` no log do Postgres.
- **Quem causou o evento não é avisado** do que acabou de fazer
  (exceção: estado de estoque, que interessa à gerência mesmo quando foi ela
  que vendeu a última unidade).
- **Canais:** `in_app` e `push` implementados; `email` já existe no
  `check` de `notificacao_entrega.canal` — um worker de e-mail entra sem
  mudar a modelagem.

## 2. Tabelas (Supabase)

| Tabela | O quê | Acesso |
|---|---|---|
| `notificacao_tipo` | Catálogo: categoria, linha de preferência, prioridade, obrigatória, públicos, se vai por push, se o Admin pode enviar | leitura para logados |
| `notificacao` | Uma por pessoa e evento: título, corpo, destino (só caminho interno), `lida_em`, `aberta_em`, `arquivada_em`, `chave_unica` | cada um lê só as suas (RLS) |
| `notificacao_entrega` | Uma por canal/aparelho: status, tentativas, erro curto | sem acesso direto (service role) |
| `notificacao_preferencia` | Liga/desliga por linha de preferência, por pessoa | leitura das próprias; escrita só por função |
| `notificacao_ajuste` | Push ligado (geral) e último estado de permissão do navegador | idem |
| `notificacao_dispositivo` | Aparelhos (vários por pessoa; token único) | leitura das próprias linhas, **sem a coluna token** |
| `notificacao_comunicado` | Comunicados do Admin (e pesquisas enviadas) | sem acesso direto (funções de admin) |
| `pesquisa_participacao` (+`recebida_em`, `iniciada_em`) | Funil da pesquisa | funções |

Ninguém escreve direto em nenhuma delas: `revoke` para `anon`/`authenticated`
e toda escrita passa por função `SECURITY DEFINER` que confere quem chama.

Migrations (aplicadas uma a uma pelo MCP — **não** usar `supabase db push`,
por causa da divergência de ledger documentada em `docs/ADMIN.md` §1):

| Arquivo | Conteúdo |
|---|---|
| `20260930100000_notificacoes_base.sql` | tabelas, RLS, `notificar()`, central, preferências, aparelhos, fila |
| `20260930110000_notificacoes_eventos.sql` | triggers dos eventos, lembretes e limpeza (pg_cron) |
| `20260930120000_notificacoes_despertar_envio.sql` | pg_net + pg_cron acordando o envio de push |
| `20260930130000_notificacoes_comunicados_e_pesquisas.sql` | comunicados, anti-spam, pesquisa enviada, funil |
| `20260930140000_notificacoes_pg_net_em_extensions.sql` | pg_net no schema `extensions` |

## 3. Tipos, categorias e prioridades

Espelho em `lib/notificacoes/catalogo.ts` (o teste `catalogo.test.ts` lê as
migrations e falha se os dois lados se separarem).

| Categoria | Tipos (público) | Push |
|---|---|---|
| Agenda | novo agendamento online (gestor) / na sua agenda (profissional) · confirmado (cliente) · cliente chegou (profissional) · cancelado (todos) · não compareceu (gestor) · reagendado (todos) · lembrete ~2 h antes (cliente) · pedido de avaliação (cliente) | sim, exceto não compareceu |
| Clientes | avaliação recebida (gestor, profissional do atendimento) · cliente criou conta (gestor) · importação concluída (resto da gerência) | avaliação |
| Financeiro | caixa fechado com diferença (importante) · caixa fechado por outra pessoa | diferença |
| Estoque | chegou ao mínimo · acabou (importante) — só quando **cruza** o limite, no máximo um aviso por item por dia | sem estoque |
| Equipe | comissão paga (profissional; um aviso por pagamento, mesmo em lote) · acesso mudou · profissional entrou/saiu (gestor) | comissão |
| Sistema | segurança (obrigatória) · manutenção (obrigatória, só Admin) · atualização importante (Admin) | segurança, manutenção |
| Produto | pesquisa · novidade · recurso beta (Admin) | pesquisa, beta |

Prioridades: `critical` (só manutenção enviada pelo Admin — nenhum evento
automático usa), `important` (cancelamento, sem estoque, caixa com
diferença, segurança), `normal`, `informational`. Importante/crítica vão por
push mesmo quando o tipo normalmente não iria.

Não geram aviso, de propósito: cada venda, cada ajuste de estoque que não
cruza o mínimo, edição de cadastro, abertura de caixa.

## 4. Preferências e papéis

- **Configurações → Notificações** (`/configuracoes/notificacoes`) para a
  equipe; **Minha conta → Notificações** (`/[slug]/minha-conta/notificacoes`)
  para o cliente.
- As linhas vêm de `minhas_preferencias_notificacao()`, que só devolve o que
  vale para o papel real da pessoa. Dono/gerência: agenda, clientes,
  financeiro, estoque, equipe, produto, sistema. Profissional: a própria
  agenda, avaliações dos seus atendimentos, comissões, produto, sistema.
  Cliente: os próprios horários, lembrete, avaliação, novidades.
- Obrigatórias (segurança, manutenção) aparecem ligadas e travadas; o banco
  recusa desligar (`PREFERENCIA_OBRIGATORIA`) e recusa preferência de outro
  papel (`PREFERENCIA_INDISPONIVEL`).
- A preferência é da pessoa (vale em todas as barbearias). Mesmo com uma
  preferência desligada por engano na interface, `notificar()` confere de
  novo no banco.

## 5. Firebase, FCM, VAPID e service worker

- **SDK modular** (`firebase/app`, `firebase/messaging`), carregado sob
  demanda em `lib/notificacoes/push-navegador.ts` — ninguém baixa o Firebase
  só por abrir uma tela (JS compartilhado continua 106 kB).
- **Permissão só por clique.** Nunca ao entrar. O convite aparece na central
  e nas preferências: “Quer receber lembretes de agenda e avisos importantes
  do CORTEX?” [Permitir notificações] [Agora não]. “Agora não” esconde por
  14 dias neste navegador. Bloqueado: explica como reativar por navegador/
  sistema. iPhone fora da Tela de Início: explica como adicionar.
- **Token:** registrado com rótulo do aparelho (“Chrome no Mac”);
  conferido uma vez por dia e quando o navegador renova a inscrição; o
  antigo é removido quando o Firebase gera outro; até 10 aparelhos ativos
  por pessoa. Ao **sair** (qualquer botão Sair) o token deste navegador é
  apagado; se outra conta entrar no mesmo navegador, o token antigo é
  descartado antes de qualquer coisa.
- **Service worker** `public/firebase-messaging-sw.js`: próprio, sem
  `importScripts` de outro domínio e sem configuração embutida. Escopo
  `/firebase-cloud-messaging-push-scope` (não controla páginas nem
  intercepta requisições). Mensagens são só de dados; o worker desenha a
  notificação, entrega à aba aberta (primeiro plano → toast + sino, sem
  notificação duplicada) e leva o clique a `/notificacoes/abrir/<id>`.
- **`/notificacoes/abrir/<id>`** confere a dona, marca aberta e lida e
  redireciona para o destino gravado no banco. Só caminho interno — nenhum
  redirecionamento para fora do CORTEX.
- **Envio (servidor):** `lib/notificacoes/fcm.ts` assina um JWT RS256 com a
  conta de serviço (sem `firebase-admin`), troca por access token (cache de
  ~1 h) e chama a API HTTP v1. `UNREGISTERED`/`SENDER_ID_MISMATCH`/token
  malformado → aparelho invalidado e outras entregas dele canceladas;
  429/5xx → nova tentativa (até 5, por 1 dia); 401/403 → configuração.

## 6. Serviço central (servidor)

`lib/notificacoes/servidor.ts`:

| Função | Uso |
|---|---|
| `notificarUsuario(userId, publico, empresaId, n)` | uma pessoa |
| `notificarGestores(empresaId, n, excluir?)` | dono e gerência |
| `notificarProfissional(profissionalId, n, excluir?)` | quem atende |
| `notificarCliente(clienteId, n, excluir?)` | cliente com conta |
| `entregarPushPendentes()` | processa a fila de push |
| `estadoDoEnvioPush()` | push configurado? (sem expor valor) |

`n = { tipo, titulo, corpo, url?, dados?, chave, prioridade? }`. Uma
funcionalidade nova só precisa dizer “aconteceu X” com uma chave; quem
recebe, se recebe, canal e push são decididos no banco. Broadcast não passa
por aqui: só pelo Admin (§7).

## 7. Admin — comunicados

**Beta e produto → Notificações** (`/admin/notificacoes`):

- Campos: título (≤ 90), mensagem (≤ 300), categoria (novidade, recurso
  beta, atualização importante, manutenção), prioridade (permitidas por
  categoria), destino (Todos, Donos, Administradores, Profissionais,
  Clientes; todas as barbearias ou selecionadas), ação (caminho interno),
  data de envio (vazio = agora), status (rascunho → agendado → enviado,
  ou cancelado).
- Prévia de alcance calculada pelo banco com as mesmas regras do envio;
  confirmação antes de enviar.
- Por comunicado: pessoas, leram, abriram, push entregues, limitados.
- Anti-spam no banco: produto (pesquisa, novidade, beta) no máximo **2 por
  pessoa a cada 7 dias** (o resto conta como “limitados”) e **3 comunicados
  de produto por dia** na plataforma; `critical` só em manutenção.
- Duas barreiras de autorização: `requirePlatformAdmin()` na ação e
  `is_platform_admin()` em cada função; tudo auditado em
  `platform_audit_log` (`notification_campaign_*`,
  `survey_notification_created`).
- Arquitetura pronta para segmentação: o destino é resolvido por
  `comunicado_destinatarios(papeis, empresas, …)`; um filtro novo (usa o
  módulo X, nunca fez Y) entra ali sem mudar o resto.

## 8. Pesquisas enviadas e funil

- Na pesquisa publicada (**Pesquisas → a pesquisa**), “Enviar como
  notificação”: título e mensagem do aviso, barbearias, data. Uma vez por
  pesquisa. Só o público dela recebe (gestor/profissional/cliente pelo papel
  real); quem já respondeu ou dispensou não recebe.
- O aviso abre `/pesquisa/<id>` (equipe) ou
  `/<slug>/minha-conta/pesquisa/<id>` (cliente) — página só da pergunta; o
  cartão discreto não aparece ao mesmo tempo.
- Funil por pesquisa e por público: **receberam o aviso** (`recebida_em`) →
  **viram** (`exibida_em`) → **começaram** (`iniciada_em`, primeiro toque na
  resposta) → **responderam**. Pesquisa de produto é categoria própria
  (`produto.pesquisa`), separada de novidades.

## 9. Sentry

Capturado (com usuário, empresa e papel já definidos no contexto da página,
mais `origem`/`operacao`, tipo e categoria da notificação):

| Origem | Quando |
|---|---|
| `push.firebase_init` | SDK do Firebase não inicializou |
| `push.token`, `push.renovar_token`, `push.remover_token`, `push.trocar_conta` | falha ao obter/atualizar/apagar token |
| `push.permissao` | pedido de permissão falhou |
| `push.registrar_aparelho` | registro do aparelho recusado |
| `push.service_worker` | erro dentro do service worker (repassado pela aba) |
| `push.configuracao` | conta de serviço ausente/ilegível/recusada (um aviso por lote) |
| `push.envio`, `push.fila`, `push.registrar` | envio que falhou de vez, fila, gravação do resultado |
| `notificacao.criar` | erro ao criar notificação a partir do servidor |
| `notificacoes.listar`, `notificacoes.preferencias` | leitura da central/preferências |
| `notificacoes.abrir` | erro inesperado ao abrir pelo clique |
| `notificacoes.comunicado_enviar`, `notificacoes.pesquisa_enviar` | envio do Admin |
| `pesquisa.responder` | falha ao registrar resposta |

Nunca vai ao Sentry: token de aparelho, chave privada, JSON da conta de
serviço, segredo do endpoint, senha. Além do filtro que já existia,
`lib/observabilidade-limpeza.ts` apaga blocos PEM (inteiros ou com `\n`
literal), tokens FCM (`…:APA91b…`) e qualquer sequência longa com cara de
credencial (testado). Token inválido é resultado esperado e não vira erro.

## 10. Configuração necessária

### Vercel (Production e Preview)

| Variável | Tipo | Onde conseguir |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | pública | já cadastrada |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | pública | Firebase → Configurações do projeto → Seus apps → app Web |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | pública | idem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | pública | idem |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | pública | idem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | pública | idem |
| `FIREBASE_SERVICE_ACCOUNT` | **sensitive** | Firebase → Contas de serviço → Gerar nova chave privada (colar o JSON inteiro) — ou as três abaixo |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | **sensitive** | do mesmo JSON |
| `NOTIFICACOES_SEGREDO` | **sensitive** | gerar (ex.: `openssl rand -hex 32`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **sensitive** | já usada pelo projeto; o envio de push precisa dela |

Nunca `NEXT_PUBLIC_FIREBASE_PRIVATE_KEY`, `NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL`
ou qualquer parte da conta de serviço com `NEXT_PUBLIC_`.

### Supabase (SQL Editor, uma vez)

```sql
select vault.create_secret('https://<domínio de produção>', 'notificacoes_url');
select vault.create_secret('<mesmo valor de NOTIFICACOES_SEGREDO>', 'notificacoes_segredo');
```

Sem isso, o push ainda sai, mas só quando alguém está com o CORTEX aberto
(o sino processa a fila a cada ~minuto). Com isso, sai logo depois do
evento e o pg_cron repete a cada minuto o que ficou pendente.

### Firebase

- App Web registrado (feito) e par de chaves Web Push (feito).
- Cloud Messaging API (V1) ativa no projeto (padrão em projetos novos).
- Domínio de produção nos domínios autorizados não é necessário para FCM.

### Sentry

Nada novo além do que `docs/observabilidade.md` já pede
(`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_API_TOKEN`).
Sugestão: um alerta para `origem:push.configuracao` (push parado por
configuração).

## 11. Agendados (pg_cron)

| Job | Quando | O quê |
|---|---|---|
| `notificacoes-lembretes-agenda` | a cada 10 min | lembrete ~2 h antes (janela de 20 min; chave evita repetir) |
| `notificacoes-envio-push` | a cada minuto | acorda o envio se houver push pendente |
| `notificacoes-comunicados-agendados` | a cada 5 min | envia comunicados agendados |
| `notificacoes-limpeza` | 04:17 UTC | entregas > 30 dias; notificações lidas/arquivadas > 180 dias; aparelhos inválidos > 60 dias |

## 12. Troubleshooting

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Preferências dizem “Ainda não disponível neste ambiente” | faltam as `NEXT_PUBLIC_FIREBASE_*` do app Web | cadastrar na Vercel e refazer o deploy |
| Permitiu, mas nada chega no aparelho | conta de serviço ausente | Sentry `push.configuracao`; `notificacao_entrega` fica `pendente` |
| Push chega só com alguém usando o sistema | Vault sem `notificacoes_url`/`notificacoes_segredo`, ou segredo diferente da Vercel | conferir §10; `/api/notificacoes/processar` responde 401 com segredo errado |
| Aparelho parou de receber | token invalidado (desinstalou, limpou dados, revogou) | `notificacao_dispositivo.motivo_invalido`; a pessoa liga de novo em Preferências |
| “Bloqueado neste navegador” | permissão negada no navegador | seguir o texto da tela (cadeado → Notificações → Permitir) |
| iPhone não oferece | Safari só entrega push para o site na Tela de Início (iOS 16.4+) | Compartilhar → Adicionar à Tela de Início |
| Pessoa não recebeu um comunicado | preferência desligada, limite semanal de produto, ou papel fora do destino | colunas “limitados”/“ignorados” do comunicado |
| Evento não gerou aviso | quem causou não é avisado; ou preferência desligada; ou tipo sem público para aquele papel | `WARNING notificacao …` no log do Postgres indica falha real |

Consultas úteis (service role):

```sql
-- fila de push
select status, count(*) from notificacao_entrega where canal = 'push' group by 1;
-- últimos erros de entrega (sem token)
select e.status, e.erro, e.tentativas, n.tipo from notificacao_entrega e join notificacao n on n.id = e.notificacao_id
 where e.canal = 'push' and e.status in ('falhou', 'token_invalido') order by e.atualizada_em desc limit 20;
```

## 13. Limitações conhecidas

- E-mail não implementado (canal previsto na modelagem).
- WhatsApp continua pelo aparelho (`wa.me`), sem API.
- Um token de aparelho vale para a conta que o registrou por último no
  navegador; quem tiver o token de outra pessoa (só o próprio navegador tem)
  poderia reassociá-lo — risco aceito, igual ao modelo do FCM.
- Comunicados agendados não passam pelo limite diário de produto no momento
  do disparo (o limite é conferido ao agendar/enviar manualmente).
- Preview e produção compartilham o mesmo banco: o endereço no Vault aponta
  para um deploy só (o de produção).
