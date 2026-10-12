# Analytics próprio do CORTEX

Coleta própria, sem Google Analytics nem ferramenta externa. Três áreas separadas:

| Área | Onde fica | Status |
|---|---|---|
| **Site (aquisição)** | `/`, `/beta`, `/login` — `components/aquisicao/medicao.tsx` + `lib/analytics/regras.ts` | Medição pronta no navegador; **coleta persistente PENDENTE (requer Supabase)** |
| **Produto** | Derivado das tabelas operacionais que já existem (agenda, atendimento, venda, caixa, `audit_log`) | Leituras do Admin já existem (Produto, Pilotos); marcos por empresa e fotografia diária **PENDENTES (requerem Supabase)** |
| **Negócio** | Planos, conversão, retenção | Sem cobrança hoje; estrutura só quando houver plano pago |

## O que é medido no site

Eventos (lista fechada em `EVENTOS`): `session_start`, `page_view`, `cta_click` (link para `/beta`), `whatsapp_click` (link `wa.me`), `beta_request_started` / `beta_request_completed`, `signup_started`, e — pelo servidor, quando a coleta existir — `signup_completed` e `login`. Nenhum outro clique é registrado, e nada roda dentro do produto nem nas páginas das barbearias (`/[slug]`).

## O que NUNCA é guardado

- IP
- User-Agent completo (só a categoria: celular/tablet/computador, navegador, sistema)
- Query string (só os cinco `utm_*`, limpos e com até 100 caracteres)
- Referrer completo (só o domínio, sem `www.`)
- Nome, e-mail, telefone ou qualquer dado digitado em formulário

## Consentimento, GPC e DNT

- Faixa discreta: **Aceitar | Recusar**. A escolha fica no cookie `cortex-analytics` (13 meses) — só a escolha, sem identificador.
- **Aceitar**: pode existir um identificador aleatório de visitante (para distinguir novo de recorrente).
- **Recusar ou não responder**: a visita conta de forma anônima, só com o identificador de sessão da aba (`sessionStorage`, some ao fechar, nova sessão após 30 min parado). Sem recorrência.
- **GPC (`navigator.globalPrivacyControl`) ou DNT ligados**: valem como recusa, e a faixa nem aparece.

## Ambientes

Só `fadeos-five.vercel.app` (`DOMINIO_DE_PRODUCAO`) é tráfego real. Preview (`*.vercel.app`) e localhost são **teste**: hoje os eventos ficam só em `window.__cortexAquisicao` na própria aba, para conferência; com a coleta ativa, serão marcados como teste e ficam fora dos números.

## Retenção (a aplicar com a coleta)

| Dado | Prazo |
|---|---|
| Eventos brutos | 180 dias |
| Sessões | 13 meses (o identificador de visitante é apagado ao fim) |
| Agregados diários | sem prazo |

Limpeza automática por job diário.

## PENDENTE — REQUER ACESSO AO SUPABASE

1. Migration `analytics_base`: schema `analytics` fora da API pública, tabelas de sessão, evento, visitante, atribuição e agregado diário, e uma função de ingestão executável só pelo servidor.
2. Rota `POST /api/a` (validação, filtro de robôs, limite por sessão) e envio via `sendBeacon`. Hoje `COLETA_PERSISTENTE = false`.
3. Eventos do servidor: `signup_completed`, `login`, vínculo sessão → pedido Beta → empresa.
4. Jobs de retenção e agregação.
5. `/admin/aquisicao`: trocar "coleta não ativada" pelos números reais. Etapas do Beta em diante já são reais.
