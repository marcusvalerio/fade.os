# Migrations do FADE OS

Este diretório é a fonte de verdade do schema do banco. Antes da primeira
rodada de hardening não havia migrations versionadas — o schema só existia
no dashboard do Supabase, o que impedia reproduzir o banco a partir do
repositório (seção 23 do pedido original).

## Arquivos, em ordem

1. `20260905120000_baseline_schema.sql` — reconstrói (de forma idempotente,
   `IF NOT EXISTS`) as tabelas, índices, constraints e triggers já usadas
   pelo código em `actions/*` e `lib/types.ts`. Não altera nem apaga dado
   nenhum de tabela já existente — ver **Antes de aplicar** abaixo para a
   única exceção que merece atenção.
2. `20260905120100_tenancy_bootstrap_and_rls.sql` — a camada de segurança:
   endurece `my_company_ids()`, cria `create_company_with_owner` (bootstrap
   atômico de empresa + papel `owner`) e define todas as RLS policies de
   tenancy. Corrige o ciclo em que um usuário novo não tinha como criar o
   primeiro vínculo em `user_company_role` porque a policy de insert exigia
   já ter um vínculo.
3. `20260905120200_cross_tenant_integrity_triggers.sql` — fecha a lacuna em
   que `appointment_service`/`attendance_item` validavam a linha pai
   (appointment/attendance) mas não que `service_id`/`professional_id`
   dentro da linha pertencem à mesma empresa.
4. `20260906090000_appointment_attendance_cross_tenant_and_function_hardening.sql`
   — mesma auditoria, um nível acima: `appointment.unit_id`/`client_id` e
   `attendance.unit_id`/`client_id`/`origin_appointment_id` agora também são
   validados contra `company_id` da própria linha. Também revoga `EXECUTE`
   de `PUBLIC` nas funções de trigger (higiene — ver comentário no arquivo)
   e documenta a conclusão sobre `professional.user_id` (não tem regra de
   tenancy própria porque nenhum fluxo de negócio hoje depende dela).
5. `20260907090000_appointment_arrived_status.sql` — adiciona `'arrived'`
   (cliente chegou e está aguardando) ao conjunto de status válidos de
   `appointment`, entre `confirmed` e `in_progress`. Recria
   `appointment_status_check` com o mesmo nome — só substitui de fato a
   constraint em produção se ela já se chamar exatamente isso (ver risco no
   bloco 9 do pré-flight).
6. `20260907090100_enable_realtime_operational_tables.sql` — inclui
   `appointment`, `appointment_service`, `attendance` e `attendance_item` na
   publication `supabase_realtime`, para a Agenda e o Atendimento
   atualizarem a UI via `postgres_changes` sem polling. Cada tabela é
   adicionada individualmente dentro de um `DO` que verifica
   `pg_publication_tables` antes — a migration é segura de rodar mesmo que
   alguma dessas tabelas já seja membro (ao contrário de um `ALTER
   PUBLICATION ... ADD TABLE a, b, c` direto, que falharia inteiro nesse
   caso).
7. `20260908090000_phase1_barbearia_nasce.sql` — Fase 1 do produto ("A
   Barbearia Nasce"). Só aditiva, como as anteriores:
   - `company` ganha `whatsapp`, `logo_url`, `postal_code`, `city`, `state`,
     `onboarding_completed_at`.
   - `unit` ganha `phone`, `status` (`active`/`inactive`, default `active`)
     e `business_hours_note` (texto livre — não é o motor de disponibilidade,
     só uma nota de funcionamento).
   - `professional` ganha `avatar_url`, `role_title` (função operacional,
     ex. "Barbeiro" — não confundir com o papel de acesso em
     `user_company_role`) e `unit_id`. Profissionais já existentes são
     preenchidos com a unidade mais antiga da própria empresa (nunca de
     outra); a coluna fica nullable (uma empresa sem unidade não pode
     travar a migration), mas ganha o mesmo trigger de integridade
     cross-tenant das demais tabelas com `unit_id`.
   - `service` ganha `description`.
   - Tabelas novas, todas com RLS + trigger de integridade cross-tenant
     (`unit_id` precisa ser da mesma `company_id`): `product` (venda),
     `consumable` (material de consumo — deliberadamente uma tabela
     separada de `product`), `payment_method` (enum fixo de 5 métodos,
     único por `(company_id, method)`) e `cash_register` (só a existência
     do caixa por unidade — sem abertura/fechamento/sangria, isso é de uma
     fase futura).
   - `company`/`unit` ganham policy de `UPDATE` (não existia — o onboarding
     original só criava, nunca editava depois).
   - Bucket `avatars` no Storage (logo da empresa, foto do profissional):
     leitura pública, escrita restrita a quem tem acesso à empresa dona do
     arquivo (o path do objeto sempre começa com o `company_id`).

Nenhum arquivo das migrations 1–6 foi alterado nesta rodada.

## Antes de aplicar em produção

Este ambiente **continua sem acesso de rede ao projeto Supabase real** (o
domínio do projeto é bloqueado pela política de egress da organização —
confirmado nesta sessão, mesma conclusão das rodadas anteriores) nem ao CLI
vinculado. As sete migrations **não foram aplicadas** ao banco vivo, só
commitadas e validadas localmente (ver **O que foi testado** abaixo). Antes
de aplicar:

1. **Rode `PRE_FLIGHT_CHECK.sql`** (neste diretório) no SQL Editor do
   dashboard, bloco por bloco. É só leitura — não cria, altera ou apaga
   nada. Blocos 1–8 cobrem as migrations 1–4; blocos 9–10 cobrem as
   migrations 5–6; blocos 11–12 (novos) cobrem a migration 7.

2. **O ponto genuinamente arriscado da baseline**: a constraint de exclusão
   em `appointment_service` (`appointment_service_no_overlap`, bloco 4 do
   `PRE_FLIGHT_CHECK.sql`). Diferente do resto da baseline (que só cria o
   que ainda não existe), essa linha roda incondicionalmente e o Postgres
   valida TODA a tabela ao adicioná-la — se já existirem dois agendamentos
   ativos do mesmo profissional com horário sobreposto, a instrução falha.
   Isso é seguro (a transação da migration inteira faz rollback — nenhum
   dado é alterado), mas é a única parte da baseline que pode *falhar*
   contra dados reais em vez de simplesmente não fazer nada. Rode o bloco 4
   do pré-flight primeiro.

3. **`CREATE TABLE IF NOT EXISTS` não retrofita schema.** Se qualquer uma
   das 12 tabelas já existir em produção — o cenário esperado — a baseline
   não adiciona colunas, constraints ou defaults a ela, mesmo que a
   definição no arquivo seja diferente. Use o bloco 2 do pré-flight para
   comparar manualmente as colunas reais contra cada `CREATE TABLE` do
   arquivo antes de assumir que baseline e produção coincidem.

4. **`anon`/`public` nunca recebem grant destas migrations.** Todo `GRANT`
   daqui em diante é só para `authenticated`. Se o bloco 7 do pré-flight
   mostrar algum privilégio de `anon`/`public` nas tabelas de tenancy, é uma
   exposição pré-existente que estas migrations não removem sozinhas —
   decida deliberadamente se precisa de um `REVOKE` explícito.

5. **`appointment_status_check` pode já existir com outro nome** (bloco 9
   do pré-flight). A migration 5 só substitui a constraint de fato se ela se
   chamar exatamente `appointment_status_check` em produção — do contrário,
   a nova constraint passa a coexistir com a antiga (Postgres aplica todos
   os `CHECK` com `AND`), e uma linha com `status = 'arrived'` violaria a
   antiga. Confirme o nome antes de aplicar.

6. **`supabase_realtime` pode já ter alguma dessas tabelas** (bloco 10 do
   pré-flight, informativo — a migration 6 já lida com isso sozinha, ver
   acima).

7. **Bucket `avatars` pode já existir com outra configuração** (bloco 11 do
   pré-flight). A migration 7 faz `insert ... on conflict (id) do nothing`
   — se um bucket `avatars` já existir como privado (`public = false`), ele
   continua privado; a leitura pública que o app espera não vai funcionar
   até isso ser ajustado manualmente.

8. **`unit.status`/`professional.unit_id` em dado pré-existente** (bloco 12
   do pré-flight). Diferente de `appointment_status_check`, aqui não há
   risco de nome de constraint duplicado — mas vale conferir que nenhuma
   `unit` real já tinha uma coluna `status` com valores fora de
   `active`/`inactive` antes de assumir que o `check` novo não vai barrar
   nada em produção.

Depois desses pontos, aplicar é o de sempre:

```bash
# com o projeto já linkado (supabase link --project-ref <ref>)
supabase db push

# ou, direto no SQL Editor do dashboard, nesta ordem:
# 1. 20260905120000_baseline_schema.sql
# 2. 20260905120100_tenancy_bootstrap_and_rls.sql
# 3. 20260905120200_cross_tenant_integrity_triggers.sql
# 4. 20260906090000_appointment_attendance_cross_tenant_and_function_hardening.sql
# 5. 20260907090000_appointment_arrived_status.sql
# 6. 20260907090100_enable_realtime_operational_tables.sql
# 7. 20260908090000_phase1_barbearia_nasce.sql
```

## Mudança que a aplicação já precisa (já feita no código)

`actions/onboarding.ts` (`createCompanyStep`) chama
`supabase.rpc("create_company_with_owner", {...})` em vez de inserir
diretamente em `company`. Isso é obrigatório: depois da migration 2, o
INSERT direto em `company` e `user_company_role` fica bloqueado para
`authenticated` — só a função (SECURITY DEFINER) pode escrever nessas duas
tabelas na criação inicial.

## Server Actions: validação explícita de tenancy

RLS continua sendo a barreira real (nenhuma checagem em código a
substitui). As checagens abaixo são defesa em profundidade: falham rápido
com uma mensagem amigável em vez de depender de um `UPDATE`/`INSERT`
silenciosamente não afetar nenhuma linha ou de um erro cru de Postgres.
Toda action que recebe um id de linha própria (não uma chave estrangeira
recém-aceita de outra tabela) agora resolve o `company_id` dessa linha e
chama `requireCompanyAccess` antes de mutar:

- `actions/clientes.ts` — `updateClientRecord`
- `actions/profissionais.ts` — `updateProfessionalRecord`,
  `toggleProfessionalActive` (helper `requireProfessionalCompany`
  compartilhado entre as duas)
- `actions/servicos.ts` — `updateServiceRecord`
- `actions/agenda.ts` — `updateAppointmentStatus`
- `actions/atendimento.ts` — `startAttendanceFromAppointment`,
  `markItemStarted`, `markItemEnded`, `completeAttendance`,
  `cancelAttendance`, `updateAttendanceItem` (helpers
  `requireAttendanceCompany`/`requireAttendanceItemCompany`
  compartilhados; o segundo também confirma que o item pertence de fato ao
  atendimento informado, não só a *algum* atendimento da empresa)

Todas lançam `TenancyError` (mesma classe usada em `lib/tenancy.ts`), cuja
mensagem já é segura de mostrar ao usuário — `friendlyMessage` a repassa
sem alteração.

Já tinham checagem explícita antes desta rodada (sem mudança):
`createClientRecord`, `createProfessionalRecord`, `createServiceRecord`,
`createAppointment`, `createWalkInAttendance`, `addAttendanceItem`,
`toggleProfessionalOnService`, `linkProfessionalToService`,
`createUnitStep`, `createProfessionalStep`, `createServiceStep`.
`createCompanyStep` não precisa (é o próprio bootstrap, antes de existir
qualquer vínculo).

## O que foi testado, e onde

Sem conexão com o Supabase real (bloqueio de rede confirmado nesta
sessão), a validação de verdade rodou contra um **Postgres 16 local**
(mesma técnica da rodada anterior): schema `auth` mínimo
(`auth.users` + `auth.uid()` lendo uma GUC de sessão), roles `authenticated`/
`anon`, publication `supabase_realtime` criada manualmente (ela é
provisionada automaticamente pelo Supabase hospedado, não existe num
Postgres genérico).

As sete migrations foram aplicadas em sequência, do zero, sem erro,
inclusive contra um mock mínimo de Supabase Storage criado só para este
teste (schema `storage`, tabelas `buckets`/`objects`, função
`storage.foldername` — o suficiente para testar as policies do bucket
`avatars`, mas não uma reprodução completa do serviço real). A migration 6
foi aplicada duas vezes de propósito para confirmar que o `DO` condicional
é idempotente (segunda execução: no-op, sem erro).

Dez cenários da rodada anterior (bootstrap, isolamento, triggers
cross-tenant de appointment/attendance, overlap de horário, status
`arrived`) foram *re-executados* para confirmar que a migration 7 não
regrediu nada — todos **PASS** de novo. Mais dezesseis cenários novos,
específicos da Fase 1, todos **PASS**:

1. Campos novos de `company` (whatsapp/cep/cidade/estado) persistem via
   `UPDATE` comum do dono.
2. Usuário B não consegue editar a `company` de A (nova policy
   `company_update`).
3. `unit.status` nasce `active` por padrão.
4. Nova policy `unit_update` funciona para o dono da unidade.
5. `unit.status` rejeita valor fora de `active`/`inactive`.
6. `professional.unit_id` persiste quando aponta pra unidade da própria
   empresa.
6b. `professional.unit_id` de **outra** empresa é rejeitado — gap
    encontrado durante o próprio teste (a migration não tinha essa trigger
    na primeira versão) e corrigido antes de seguir:
    `trg_professional_unit_same_company` foi adicionado.
7. `product` com `unit_id` de outra empresa rejeitado
   (`trg_product_same_company`).
8. `consumable` com `unit_id` de outra empresa rejeitado
   (`trg_consumable_same_company`).
9. Isolamento de leitura em `product`: B não vê produto de A.
10. `payment_method` com `upsert` em `(company_id, method)` é idempotente.
11. `payment_method` rejeita método fora do enum de 5 valores.
12. `cash_register` é criado vinculado à unidade certa.
13. Upload em `avatars/{company_id}/...` aceito para o dono daquela
    empresa.
14. Upload cruzado (usuário B tentando escrever na pasta de A) rejeitado.
15. Leitura do bucket `avatars` é pública, sem `SET ROLE` nenhum.

Ao final, o bloco de teste força um `RAISE EXCEPTION` proposital para
desfazer (`ROLLBACK`) tudo que os cenários inseriram — o banco de teste
local terminou vazio (confirmado por contagem em `company`, `unit`,
`product` e `auth.users`), e o database/instância Postgres local inteiros
foram descartados ao final (`DROP DATABASE` + parada do serviço). Nada
disso tocou o projeto Supabase de produção, que nunca foi alcançado.

## O que continua pendente, e por quê

- **Aplicar as migrations no Supabase real.** Bloqueado por rede nesta
  sessão (e nas anteriores) — precisa rodar de um ambiente com acesso ao
  projeto, seguindo o checklist acima.
- **Rodar os mesmos cenários contra o Supabase real**, não só localmente —
  a validação local prova a lógica das migrations, não substitui confirmar
  RLS/realtime/Storage no serviço hospedado de fato (o mock de Storage
  usado aqui é simplificado; o bucket, as policies e o upload de verdade
  só ficam confirmados contra o Supabase real).
- **`app_user` e o "cluster legado"** — existem apenas no Supabase real, não
  em `actions/*`, `lib/*`, `supabase/migrations/*` nem no histórico do git
  deste repositório, e este ambiente não teve acesso de rede para
  inspecioná-los diretamente. Segundo o dono do projeto: `app_user` tem 1
  registro real, e há um cluster legado com nomes em português (`houses`,
  `profiles`, `clientes`, `servicos`, `agendamentos`, `atendimentos`,
  `estoque`, entre outros) que antecede as migrations deste diretório.
  **Nada nesses objetos foi tocado nesta rodada nem em nenhuma anterior** —
  nenhuma tabela, view, função ou linha foi removida, alterada ou lida.
  Ficam intactos até uma decisão explícita do dono do projeto sobre o que
  fazer com eles (migrar dado real para o schema atual, aposentar, ou
  manter como está); esta rodada não teve escopo nem instrução para decidir
  isso sozinha, e as migrations em `supabase/migrations/` seguem
  independentes desse cluster (não leem nem escrevem nada nele).
