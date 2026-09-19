# Página pública, agendamento e confirmação via WhatsApp

Documenta o estado real de três partes tratadas como um único fluxo de
produto: a vitrine pública da barbearia (`/{slug}`), o agendamento público
(`/{slug}/agendar`) e a confirmação de agendamentos via WhatsApp dentro da
Agenda (`/agenda`). Auditado antes de qualquer alteração, como as demais
frentes documentadas (`docs/ADMIN.md`).

---

## 1. Achado crítico: drift entre migrations e banco real (de novo)

Como já havia acontecido com o CORTEX ADMIN, uma auditoria só contra
`supabase/migrations/*.sql` teria concluído que o carrinho de múltiplos
serviços do agendamento público estava quebrado: `getPublicProfessionalsMulti`,
`getPublicAvailableSlotsMulti` e `createPublicAppointmentMulti`
(`actions/public.ts`) chamam `get_public_professionals_multi`,
`get_public_available_slots_multi` e `create_public_appointment_multi` —
nenhuma dessas três existe em migration versionada.

Uma consulta direta ao banco de produção (`xaxszgyvapvzwensbjjq`, via MCP)
confirmou que **as três existem e funcionam ao vivo**, com a assinatura
exata que o código já esperava. Nada foi alterado nesta rodada por causa
disso — nenhum arquivo de `BookingWizard.tsx`/`actions/public.ts` que
dependa dessas RPCs foi tocado além do indicador de progresso (cosmético).
Fica registrado, de novo, como pendência real: uma migration futura deveria
capturar o que já existe, sem mudar comportamento.

---

## 2. Arquitetura de informação

```
CORTEX.OS
│
└── Experiência pública          RLS por is_platform_admin() não se aplica
    ├── /{slug}                  Vitrine da barbearia
    ├── /{slug}/agendar          Agendamento público (carrinho de serviços)
    └── /{slug}/agendamentos/[token]   "Meu agendamento" (cancelar, avaliar)

CORTEX.OS (tenant)
└── /agenda                      Confirmação via WhatsApp (V1, sem API oficial)
```

Nenhuma rota nova foi criada — todas já existiam. O trabalho desta rodada
foi: completar o conteúdo real que faltava na vitrine, tornar o fluxo de
agendamento mais claro (indicador de progresso), e adicionar a confirmação
via WhatsApp na Agenda.

---

## 3. Página pública (`/{slug}`)

| Conteúdo | Estado antes | Estado depois |
|---|---|---|
| Nome, capa/logo, endereço, Instagram | Real | Inalterado |
| WhatsApp/telefone | Real, mas texto puro (não clicável) | **Real e clicável** — `wa.me` com mensagem pré-preenchida (`lib/whatsapp.ts`) |
| Serviços (nome/preço/duração/descrição) | Real | Inalterado |
| Equipe | Real | Inalterado |
| Horário de funcionamento | Real (mesma fonte do motor de disponibilidade) | Inalterado |
| Avaliação/reputação | Dado real existia (`attendance_rating`) mas nunca era agregado nem exibido | **Nova RPC** `get_public_company_rating` (SECURITY DEFINER, mesmo padrão das demais `get_public_*`) — média + contagem; a seção só aparece quando `rating_count > 0` |
| Formas de pagamento | Dado real existia (`payment_method`, usado só no PDV) mas nunca exposto publicamente | **Nova RPC** `get_public_payment_methods` — reaproveita `PAYMENT_METHOD_LABEL` já existente em `lib/payment-methods.ts` |

Migration nova, mínima e aditiva (nenhuma tabela, nenhuma RLS/policy
alterada): `supabase/migrations/20260927090000_public_page_rating_and_payment_methods.sql`.
Aplicada ao banco de produção via MCP e commitada no repositório — ao
contrário do drift do item 1, esta desta vez fica registrada desde o início.

---

## 4. Fluxo de agendamento público (`/{slug}/agendar`)

**Não foi reconstruído do zero.** A auditoria mostrou uma implementação real
e funcional, mais rica do que um "5 passos lineares" simples: um carrinho de
serviços (múltiplos serviços no mesmo agendamento) com uma etapa de
profissional que **é pulada automaticamente** quando só existe uma pessoa
capaz de realizar todos os serviços escolhidos. Refazer isso como 5 passos
fixos teria removido uma funcionalidade real para caber numa descrição —
o que a própria tarefa pede para não fazer ("não invente regras", "reutilize
a infraestrutura existente").

O que foi feito: um indicador de progresso ("Passo X de Y") que reflete a
sequência real de passos, incluindo o pulo condicional do profissional —
`stepsSequence` em `BookingWizard.tsx` é recalculado a partir do número
real de profissionais elegíveis, não um número fixo inventado. Os
títulos duplicados ("1. O que você quer fazer?") viraram uma única fonte
(`STEP_TITLE`), sem número embutido no texto — o número agora vive só no
indicador.

Nenhuma regra de disponibilidade foi tocada — permanece inteiramente no
banco (`get_available_slots`/`create_public_appointment*`), como já era.

### Estados verificados
"Sem horários disponíveis" (quando o dia já não tem mais horário) e
carrinho com múltiplos serviços acionando corretamente a etapa de
profissional foram confirmados ao vivo (QA visual, ver seção 8) — nenhum
agendamento real de teste foi criado (evitado deliberadamente, para não
gravar dado de teste na empresa real usada para QA).

---

## 5. Status de confirmação — não é um campo novo

Antes de considerar qualquer migration, o modelo de `appointment.status` foi
lido por inteiro:

```
scheduled | confirmed | arrived | in_progress | completed |
cancelled_by_client | cancelled_by_company | no_show
```

**`confirmed` já existe**, distinto de `scheduled` — é exatamente o
conceito de "aguardando confirmação": todo agendamento em `scheduled` ainda
não foi confirmado pela equipe. **Nenhuma coluna nova, nenhuma migration**
foi necessária para a funcionalidade de WhatsApp — "aguardando confirmação"
é lido diretamente de `status === 'scheduled'`.

O que **não existe** e não foi criado: confirmação iniciada pelo próprio
cliente (hoje só a equipe confirma, manualmente, na Agenda), tabela de
lembretes enviados, histórico de tentativas de contato. Fica documentado
como lacuna, não simulado.

---

## 6. WhatsApp + Agenda

`lib/whatsapp.ts` (novo) — `whatsAppUrl(phone, message)` e `firstName(fullName)`,
extraídas de `lib/beta-credentials-message.ts` (onde esse padrão já existia
e roda em produção, na aprovação de Beta) para serem reaproveitadas também
pela Agenda, em vez de reescritas. `lib/beta-credentials-message.ts` continua
funcionando exatamente igual — agora só reexporta as duas funções.

Na Agenda (`app/(app)/agenda/page.tsx`):

- Um aviso aparece quando há agendamentos em `scheduled` no dia visualizado:
  "N atendimento(s) para {hoje/amanhã/data} aguardando confirmação", com
  `[Ver pendentes]` e `[Enviar lembretes]` — ambos levam à mesma lista
  filtrada (`?pendentes=1`), porque **não existe envio em massa real**: cada
  WhatsApp é aberto e enviado por uma pessoa, um de cada vez. Isso é dito
  explicitamente na tela, não escondido.
- Cada linha com status `scheduled` ganha um botão **WhatsApp**, que monta
  a mensagem com dados reais (nome do cliente, nome da empresa, dia, hora,
  serviço) e abre `wa.me` numa aba nova. Sem telefone válido, mostra
  "Sem WhatsApp" em vez de um link quebrado.
- V1, como pedido: nenhuma API oficial do WhatsApp, nenhum token armazenado,
  nenhum envio automático, nenhuma integração fictícia. `whatsAppUrl` só
  monta o link; quem decide enviar é sempre uma pessoa.

---

## 7. Estado real por área

| Área | Estado |
|---|---|
| Vitrine pública — conteúdo | **REAL**, agora completo (rating + pagamento adicionados) |
| Agendamento público — fluxo | **REAL, funcional**, com indicador de progresso novo |
| Disponibilidade (profissional × serviço × jornada × bloqueios × overlap) | **REAL**, inalterada |
| Confirmação de agendamento | **REAL** (status `confirmed` já existente), sem confirmação iniciada pelo cliente |
| WhatsApp na Agenda | **REAL**, V1 (link `wa.me`, sem API oficial) |
| Multi-serviço (RPCs `_multi`) | **REAL no banco, ausente das migrations locais** (drift documentado, não corrigido nesta rodada) |

---

## 8. QA visual

Testado ao vivo (Playwright, sem autenticação — a vitrine e o agendamento são
públicos por natureza):

- `/norte-21-barbearia` em 1440/1024/768/390/375/320 — zero overflow, zero
  erro de console real (só `ERR_CERT_AUTHORITY_INVALID`, artefato do proxy
  TLS deste ambiente de execução ao carregar imagens do Supabase Storage,
  não um erro de código).
- Link de WhatsApp do cabeçalho confirmado como `wa.me` real com mensagem
  codificada corretamente, incluindo o nome real da empresa.
- `/norte-21-barbearia/agendar` em 390px e 320px: seleção de múltiplos
  serviços, indicador de progresso mudando corretamente de "Passo 1 de 5"
  para "Passo 2 de 6" ao detectar mais de um profissional elegível, estado
  vazio "Sem horários disponíveis" — todos sem overflow.
- Nenhum agendamento de teste foi de fato confirmado (evitado
  deliberadamente para não gravar dado fictício na empresa real de QA).

**Não testado ao vivo**: a Agenda autenticada (banner de pendentes, botão
WhatsApp por linha) — exigiria uma sessão real de dono/gerente, que esta
sessão não está autorizada a criar. Validado por leitura de código e
`tsc`/`build`, mesma limitação já registrada em `docs/ADMIN.md`.
