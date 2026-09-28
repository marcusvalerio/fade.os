# Pilotos

Acompanhamento interno do uso real de uma barbearia por N dias (padrão 14).
Camada só de observação: a barbearia não vê nada e nenhum dado operacional é
alterado. Primeiro piloto: **Piloto Norte 21** — NORTE 21 BARBEARIA
(`fc0b2c5d-26bd-496d-bbf0-1a330ccc9a48`), de 29/09/2026 a 12/10/2026, Dia 0 em
28/09/2026.

Migration: `supabase/migrations/20260930160000_pilotos.sql` (aplicada sozinha,
sem `supabase db push`). Testes de banco: `supabase/tests/pilotos.sql`.

## Modelo

| Tabela | O quê |
|---|---|
| `piloto` | empresa, nome, objetivo, início, fim (máx. 90 dias), status `planejado → ativo → encerrado` (ou `cancelado`). Um piloto aberto por empresa. |
| `piloto_snapshot` | um retrato por dia (fuso de São Paulo): `dia_do_piloto` (0 = véspera/base), `final` (dia fechado), `atrasado`, `versao`, `metricas` (jsonb). |
| `piloto_atividade` | usuário × hora com sessão ativa. O Supabase não guarda histórico de login (`auth.audit_log_entries` vazio; `last_sign_in_at` é só o último), então o piloto registra de hora em hora. |

RLS ligado sem política e sem grant para `anon`/`authenticated`: só as funções
`admin_*` (que exigem `platform_admin` ativo) leem.

## Coleta (pg_cron)

| Job | Quando | O quê |
|---|---|---|
| `plataforma-piloto-coleta` | minuto 5 de cada hora | sessões da última hora → `piloto_atividade`; retrato parcial de hoje |
| `plataforma-piloto-fechamento` | 03:10 UTC (00:10 em São Paulo) | fecha os dias que passaram (inclusive atrasados) e muda o status pela data |

Os nomes `plataforma-*` fazem `verificar_plataforma()` avisar o Admin se um
deles falhar 3 vezes numa hora. Queda de uso **não** vira notificação.

Somente leitura: `piloto_metricas` é `STABLE` (o Postgres recusa escrita
dentro dela); as funções de coleta só escrevem nas três tabelas do piloto. O
teste confere a impressão digital (md5) de todas as tabelas operacionais da
empresa antes e depois, e que `pg_stat_xact_user_tables` não registra
nenhuma escrita fora do piloto.

## Métricas (versão 1)

Por dia: usuários (ativos, último acesso, dias sem acesso, 7 e 10+ dias, uso
por pessoa: horas com sessão e ações auditadas), profissionais (com login,
ativos, atendendo), clientes (novos, total, contas), agendamentos (criados,
para o dia, realizados, cancelados, não compareceu, passados sem fechamento),
atendimentos (abertos, concluídos, cancelados, abertos há +24 h), vendas
(concluídas, valor, balcão, canceladas, por forma de pagamento, estornos),
caixa (abertos, fechados, com diferença), comissões (geradas, pagas,
revertidas, a pagar), estoque (movimentações por tipo, abaixo do mínimo,
negativos), financeiro manual, notificações (geradas, lidas, abertas, push),
módulos (mesmas regras de `admin_matriz_de_uso`, via `uso_por_modulo`),
distribuição por hora (registros e sessões), incidentes (avisos da
plataforma ligados à empresa, falhas de push, jobs com falha), acumulados
(para comparar com o Dia 0) e inatividade (dia sem uso, dias sem operação).

"Estado" (estoque, atendimentos presos, caixa aberto, comissões a pagar) é o
do momento da captura; por isso o dia só fecha logo após a meia-noite. Erros
do Sentry por empresa aparecem na tela, lidos na hora (o banco não guarda
token do Sentry).

A Norte 21 carrega histórico de QA (ex.: 84 atendimentos "em andamento"). Ele
fica no Dia 0; o painel mede a evolução a partir dele.

## Admin

- `/admin/pilotos` — lista, criação de piloto (qualquer empresa ativa).
- `/admin/pilotos/[id]` — Dia X/N; indicadores do dia com variação contra o
  dia anterior e a média dos anteriores; desde o Dia 0; evolução dia a dia;
  módulos; horários e dias da semana; uso por pessoa; falhas e gargalos;
  "Atualizar agora" e "Encerrar" (auditados).
- Ficha da empresa: selo "Em piloto" com link.

Ações auditadas em `platform_audit_log`: `pilot_created`, `pilot_closed`,
`pilot_cancelled`, `pilot_snapshot_refreshed`.
