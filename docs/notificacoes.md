# Notificações — o que existe hoje e a arquitetura para depois

Estado: **não há notificação automática no CORTEX**. Nada é enviado sozinho —
nem push, nem e-mail transacional de agenda, nem WhatsApp. Firebase não é
usado e não foi implementado nesta rodada, de propósito.

## O que existe hoje (e funciona)

| Momento | O que o CORTEX faz | Quem envia |
|---|---|---|
| Agendamento criado pela equipe | Monta a mensagem de confirmação e abre o WhatsApp (`wa.me`) | A pessoa da barbearia, no WhatsApp dela |
| Cliente para chamar (passou do ritmo) | Mensagem de retorno pronta, só para quem deu consentimento | A barbearia |
| Aprovação do Beta (admin) | Mensagem com o acesso pronta para o WhatsApp | A equipe do CORTEX |
| Recuperação de senha, confirmação de e-mail | E-mail do Supabase Auth | Automático (Supabase) |
| Mudanças na agenda / atendimento abertos na tela | Atualização em tempo real (Supabase Realtime) enquanto a tela está aberta | — |

Consentimento: `client.communication_consent`. Sem ele, a ficha e a lista de
Clientes não oferecem o botão de WhatsApp. A importação de planilha só marca
consentimento quando a planilha diz "sim".

## Arquitetura proposta (não implementada)

Princípio: **um evento, vários canais, sempre a partir do banco**. O mesmo
fechamento que hoje grava venda/caixa/comissão numa transação passa a gravar
também um registro de "notificação a enviar"; quem envia é um processo à
parte, que pode falhar e tentar de novo sem afetar a operação.

```
transação do domínio (ex.: create_appointment, reschedule_my_appointment)
        │  insert
        ▼
notification_outbox (company_id, kind, recipient, channel, payload, status,
                     attempts, next_attempt_at, created_at)
        │  lido por
        ▼
worker (Supabase Edge Function agendada / cron) ──► provedor do canal
        │                                           • e-mail: Resend
        │                                           • WhatsApp: API oficial (Meta) ou BSP
        │                                           • push web: Web Push (VAPID), sem Firebase
        ▼
status = sent | failed (com motivo) · auditoria em audit_log
```

Decisões:

1. **Outbox no Postgres**, escrito dentro da mesma transação do evento. Sem
   evento "fantasma" se a transação falhar; sem perder evento se o provedor
   estiver fora.
2. **Consentimento e preferência no banco**, conferidos pelo worker no
   momento do envio (o cliente pode retirar o consentimento entre o evento e o
   envio).
3. **Push web com Web Push padrão (VAPID)** para equipe no celular —
   funciona em Android e, com a página instalada na tela inicial, em iOS
   16.4+. Não exige Firebase.
4. **WhatsApp automático só com a API oficial** e templates aprovados; até
   lá, continua o `wa.me` com envio humano.
5. **Janela de silêncio** por barbearia (não enviar de madrugada) e limite
   por cliente por dia.
6. **Isolamento**: outbox com RLS por empresa; o worker usa service role só
   no servidor e nunca expõe o conteúdo ao front.

Primeiros eventos candidatos, pela ordem de valor:

1. Lembrete de horário (24h e 2h antes) para o cliente com consentimento.
2. Aviso à equipe quando o cliente muda ou cancela pela própria conta
   (hoje a mudança aparece na agenda e na auditoria, sem aviso ativo).
3. Aviso ao dono de caixa fechado com diferença.
