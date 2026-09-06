# Migrations do FADE OS

Este diretório é a fonte de verdade do schema do banco. **A partir da Fase
2, o projeto Supabase real (`FADE-OS`, ref `xaxszgyvapvzwensbjjq`, região
`sa-east-1`) está acessível a esta sessão via MCP, e todas as migrations
listadas abaixo já foram aplicadas nele** — não são mais um plano para uma
rodada futura com acesso.

## O banco real tem uma pré-história que este diretório não cobre

Antes de qualquer migration deste repositório existir, o projeto já tinha
duas camadas próprias, aplicadas diretamente (dashboard/CLI, sem os
arquivos deste diretório):

1. **`schema_inicial_fade_os`** (2026-07-06) — o cluster legado em
   português: `houses`, `profiles`, `servicos`, `clientes`, `agendamentos`,
   `atendimentos`, `caixa_movimentos`, `caixa_fechamentos`, `estoque`,
   `estoque_movimentos`, com tenancy via `meu_house_id()`/`meu_role()`.
   **Todas as tabelas estão vazias (0 linhas) hoje**, mas nada aqui foi
   tocado, lido além de introspecção, alterado ou removido — ver a seção
   dedicada mais abaixo.
2. **`001_foundation` .. `006_attendance_item_edit_lock`** (2026-09-05,
   madrugada) — uma segunda fundação, em inglês, que criou exatamente as
   tabelas que este diretório também assume que existem: `company`, `unit`,
   `professional`, `service`, `professional_service`, `client`,
   `appointment`, `appointment_service`, `attendance`, `attendance_item` —
   além de `app_user`, `role`, `permission`, `role_permission`, `sale`, e
   das funções `my_company_ids()`/`my_unit_ids()`, dos triggers de
   sincronismo `appointment_service.is_active` e de cálculo automático de
   comissão/venda.
3. **`20260907093001_drop_orphaned_write_policies`** e
   **`20260907093002_consolidate_identity_and_remove_dead_objects`**
   (mesma data das primeiras migrations deste repositório) — uma limpeza
   que endureceu a policy de `INSERT` de `company` (a de `001`/`004`
   permitia qualquer `authenticated` criar uma empresa direto, sem RPC),
   migrou `user_company_role.user_id` para referenciar `auth.users`
   diretamente (em vez de `app_user`), e removeu `permission`,
   `role_permission` e `sale` como "objetos mortos" — junto com as funções/
   triggers que só existiam para sustentá-los (`handle_new_auth_user`,
   `handle_new_company`, `handle_attendance_completed`,
   `calculate_attendance_item_commission`, `guard_attendance_item_update`,
   `guard_attendance_cancel`). O texto exato dessas duas migrations não
   está recuperável via `supabase_migrations.schema_migrations` (aplicadas
   sem o corpo salvo ali) — o que se sabe vem de comparar o schema antes/
   depois via introspecção direta (`pg_proc`, `pg_trigger`, `pg_policies`).

**Consequência prática para quem mexer neste schema depois:** a comissão
por atendimento **não é mais calculada automaticamente** — o trigger que
fazia isso foi removido junto com `sale`, e `actions/atendimento.ts` nunca
preencheu `commission_percent_snapshot`/`commission_amount` manualmente.
Isso é uma lacuna pré-existente, órfã dessa limpeza, não introduzida por
nenhuma migration deste diretório — fica registrado aqui para não ser
redescoberto do zero numa fase futura que mexer em comissão/venda.

Este diretório assume esse schema pré-existente como base e só adiciona
em cima — nunca reescreve nem reverte nada dessas três camadas anteriores.

## Arquivos deste diretório, em ordem

1. `20260905120000_baseline_schema.sql` — reconstrói (idempotente,
   `IF NOT EXISTS`) as tabelas/índices/constraints/triggers que
   `actions/*`/`lib/types.ts` esperam. Como as tabelas já existiam (via
   `001`-`003`), a maioria dos `CREATE TABLE` foi no-op — o que realmente
   aplicou foi a constraint de exclusão `appointment_service_no_overlap`
   (redundante com uma equivalente já criada em `003_agenda_atendimento`,
   sem conflito) e os triggers de imutabilidade.
2. `20260905120100_tenancy_bootstrap_and_rls.sql` — `my_company_ids()`,
   `create_company_with_owner` (RPC atômica de bootstrap) e as RLS
   policies de tenancy usadas por `lib/tenancy.ts`.
3. `20260905120200_cross_tenant_integrity_triggers.sql` — valida que
   `service_id`/`professional_id` dentro de `appointment_service`/
   `attendance_item` pertencem à mesma empresa da linha pai.
4. `20260906090000_appointment_attendance_cross_tenant_and_function_hardening.sql`
   — mesma auditoria, em `appointment.unit_id`/`client_id` e
   `attendance.unit_id`/`client_id`/`origin_appointment_id`.
5. `20260907090000_appointment_arrived_status.sql` — acrescenta `'arrived'`
   ao `appointment_status_check`.
6. `20260907090100_enable_realtime_operational_tables.sql` — inclui
   `appointment`, `appointment_service`, `attendance`, `attendance_item` na
   publication `supabase_realtime`, tabela por tabela dentro de um `DO`
   condicional (idempotente mesmo que alguma já seja membro).
7. `20260908090000_phase1_barbearia_nasce.sql` — Fase 1 ("A Barbearia
   Nasce"): `company` ganha whatsapp/logo/cep/cidade/estado/
   onboarding_completed_at; `unit` ganha phone/status/business_hours_note;
   `professional` ganha avatar_url/role_title/unit_id (com backfill e
   trigger cross-tenant); `service` ganha description; tabelas novas
   `product`, `consumable`, `payment_method`, `cash_register`; policies de
   `UPDATE` novas em `company`/`unit`; bucket `avatars` no Storage.
8. `20260908120000_phase2_availability_engine.sql` — **aplicada por engano
   com o corpo vazio** (erro operacional ao chamar a ferramenta de
   migration nesta sessão). Fica registrada assim no histórico por
   transparência; não fez nada.
9. `20260908120001_phase2_availability_engine_actual.sql` — Fase 2 (Motor
   de Disponibilidade), o conteúdo real do que a migration 8 deveria ter
   sido. Ver seção própria abaixo.

Nenhum arquivo 1–7 foi alterado nesta rodada.

## Fase 2 — Motor de Disponibilidade

### Schema novo

- **`professional_schedule`** — jornada semanal do profissional: uma linha
  por `(professional_id, weekday)`, `weekday` na convenção do Postgres
  (`extract(dow from date)`: 0=domingo..6=sábado). Ausência de linha, ou
  `active=false`, significa "não trabalha nesse dia".
- **`professional_schedule_break`** — intervalos (almoço etc.) dentro do
  dia de trabalho, zero ou mais por `professional_schedule`.
- **`unit_business_hours`** — jornada de funcionamento da unidade, mesma
  convenção de `weekday`. A disponibilidade real de um profissional é
  sempre a interseção entre a própria jornada e isto — nunca ultrapassa
  nenhuma das duas.
- **`professional_block`** — bloqueios pontuais (reunião, compromisso,
  manutenção), timestamptz, com `status` (`active`/`cancelled`).
- **`professional_absence`** — férias, folga excepcional, afastamento,
  feriado individual — período ou intervalo específico, timestamptz.

RLS em todas: mesmo padrão de `professional_service`/`attendance_item` já
usado no projeto — a tabela não guarda `company_id` próprio, o acesso é
validado via `EXISTS` contra o `professional`/`unit` dono da linha.

### A função: `get_available_slots`

```sql
get_available_slots(p_company_id, p_unit_id, p_service_id, p_date, p_professional_id default null)
returns table (professional_id, professional_name, slot_start, slot_end)
```

Pontos de design deliberados:

- **`SECURITY INVOKER`, não `DEFINER`.** A função só lê o que RLS já
  deixaria o chamador ler. Passar um `company_id`/`unit_id` de outra
  empresa não vaza nada — as subconsultas em `service`/`unit`/
  `professional` simplesmente não retornam linha nenhuma para esse
  usuário, e a função devolve zero horários (não um erro que revelaria
  que a empresa existe).
- **Granularidade de slot centralizada**: `v_slot_step_minutes constant int
  := 15` é a ÚNICA definição disso no sistema inteiro (seção 8 do pedido).
- **Fuso horário**: `date + time` em Postgres é interpretado no timezone da
  sessão (UTC no Supabase), não no horário local da barbearia — sem
  ancorar isso explicitamente, toda jornada ficaria sistematicamente
  deslocada em relação aos `appointment_service.starts_at` reais (esses
  sim, `timestamptz` corretos, gerados a partir de `datetime-local` do
  navegador). A função ancora em `'America/Sao_Paulo'`
  (`v_business_timezone`, também uma única constante) — uma simplificação
  deliberada de MVP para um produto hoje inteiramente pt-BR, documentada
  no próprio arquivo; a fase que precisar de multi-fuso troca essa
  constante por uma coluna em `company`/`unit`.
- **O que conta como "ocupando agenda"**: só `appointment_service.is_active
  = true`. Essa coluna já era mantida em sincronia com `appointment.status`
  por um trigger pré-existente (`sync_appointment_service_active`, de
  `003_agenda_atendimento`) — cancelamento/no-show zeram `is_active`
  automaticamente. A função não duplica essa lógica, só lê o resultado.
- **Múltiplos serviços**: a função calcula um serviço por chamada, de
  propósito — o domínio (`appointment_service` com várias linhas por
  `appointment`) já suporta múltiplos serviços/profissionais por
  agendamento; compor várias chamadas para um carrinho com Corte+Barba é
  responsabilidade de quem consome a função (Fase 3/4), não do motor.

## Server Actions novas (`actions/disponibilidade.ts`)

Mesmo padrão de tenancy do resto do projeto — toda action resolve o
`company_id` da linha (via `professional_id`/`unit_id`/`schedule_id`
recebido) e chama `requireCompanyAccess` antes de mutar:
`setProfessionalScheduleDay`, `addScheduleBreak`, `removeScheduleBreak`,
`setUnitBusinessHoursDay`, `createProfessionalBlock`,
`cancelProfessionalBlock`, `createProfessionalAbsence`,
`deleteProfessionalAbsence`, e `getAvailableSlots` (wrapper fino sobre a
RPC — nunca recalcula nada em TypeScript).

## O que foi testado, e onde

**A validação principal desta fase rodou contra o Supabase real**, via
`execute_sql` do MCP, não só localmente — conforme pedido explicitamente
para a Fase 2. Técnica: `SET ROLE authenticated` + `set_config
('request.jwt.claim.sub', <uuid>, true)` dentro de um `DO` block, exatamente
o que `auth.uid()` do Supabase lê (confirmado lendo o código-fonte da
função antes de assumir isso).

Duas empresas de teste (`Fase2 Teste A`/`B`), cada uma com seu próprio
`auth.users` sintético, foram criadas via `create_company_with_owner` real,
usadas para os 24 cenários pedidos, e **desfeitas com um `RAISE EXCEPTION`
proposital no fim do bloco — rollback automático de tudo**, confirmado
depois por contagem (`company`/`auth.users`/`professional_schedule`/
`unit_business_hours`/`professional_block`/`professional_absence`, todos
zerados) e por conferir que as 3 empresas e os demais dados reais
pré-existentes continuavam com a mesma contagem de antes.

Os 24 cenários pedidos, todos **PASS** na segunda rodada (a primeira
pegou um bug real de teste, não do motor — ver abaixo):

1. Profissional trabalhando normalmente. 2. Fora da jornada (sem
`professional_schedule` pro dia). 3. Intervalo de almoço respeitado. 4.
Unidade fechada (sem `unit_business_hours` pro dia). 5. Serviço
incompatível com o profissional. 6/7/8. Serviços de 30/45/60 min geram o
último horário coerente com a duração. 9. Agendamento existente bloqueia o
horário. 10. Cancelar o agendamento libera o horário de novo (via o
trigger `sync_appointment_service_active` já existente). 11. Bloqueio
manual funciona. 12. Ausência bloqueia o dia inteiro. 13. Folga
(`schedule.active=false`) zera os horários. 14. Horário exatamente no
limite da jornada (17:15+45min=18:00 exato) é válido. 15. Serviço que
ultrapassa o fim da jornada é rejeitado. 16. Serviço que ultrapassa o
fechamento da unidade é rejeitado (a unidade fechando mais cedo que a
jornada do profissional limita de verdade). 17. Dois `appointment_service`
sobrepostos: a exclusion constraint pré-existente rejeita. 18. Usuário de
outra empresa consultando a disponibilidade de A recebe zero (RLS). 19.
Dois profissionais diferentes habilitados no mesmo serviço aparecem os
dois. 20. Um profissional habilitado em vários serviços. 21. Um único
`appointment` com duas linhas `appointment_service` (serviços e
profissionais diferentes) — a base já suporta múltiplos serviços por
agendamento. 22. Nenhum horário disponível (unidade fechada). 23/24.
Primeiro e último horário do dia coerentes com jornada + almoço.

**Bug real encontrado e corrigido durante o próprio teste, antes de
aplicar em produção**: a primeira versão de `professional_schedule` /
`product`/`consumable`/`cash_register` tinha trigger de integridade
cross-tenant para `unit_id`, mas `professional.unit_id` (da Fase 1) não
tinha — um `professional_id` de uma empresa podia (na teoria, RLS ainda
protegeria a leitura) referenciar `unit_id` de outra. Adicionado
`trg_professional_unit_same_company`, testado (cenário 6b, cross-tenant
rejeitado), e só depois disso a migration foi aplicada.

**Bug real de teste (não do motor) encontrado na primeira rodada**: o
teste do cenário 23 ("primeiro horário do dia") esperava 09:00 mas recebeu
10:45 — porque o próprio cenário 21 (multi-serviço) tinha reservado
09:00–09:30 do mesmo profissional minutos antes, e o cenário 17 reservado
10:00–10:45. A função respondeu corretamente ao estado real da agenda; o
teste que estava com uma expectativa desatualizada. Corrigido limpando as
reservas de teste antes de medir primeiro/último horário.

## `app_user` e o cluster legado (`houses`, `profiles`, `servicos`...)

Sem mudança desde a Fase 1: nada foi tocado, lido além de introspecção
read-only, alterado ou removido. Ambos seguem existindo exatamente como
estavam — `app_user` com 1 registro real, cluster legado com 0 linhas em
todas as tabelas. Ficam intactos até decisão explícita do dono do projeto.

## PRE_FLIGHT_CHECK.sql

Escrito antes de haver acesso ao Supabase real, para ser rodado manualmente
no SQL Editor **antes** de aplicar as migrations 1–7. Isso já não é mais o
fluxo desta sessão (as migrations foram aplicadas diretamente, uma a uma,
com introspecção real do schema antes de cada uma — não pelo script). Fica
mantido no repositório como **documentação histórica e ferramenta
diagnóstica manual** — ainda útil se alguém precisar inspecionar o schema
pelo SQL Editor do dashboard sem acesso MCP —, não como um gate obrigatório
desta ou de fases futuras.
