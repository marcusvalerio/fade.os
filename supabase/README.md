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

## Fase 3 — Identidade da Barbearia + Agendamento do Cliente

Migrations: `20260908150000_phase3_public_slug_and_booking.sql` (schema +
camada pública) e `20260908150100_phase3_public_team_roster.sql`
(complemento: time geral para a página pública). Ambas aditivas, aplicadas
direto no projeto real (`xaxszgyvapvzwensbjjq`), mais uma correção pontual
aplicada depois (ver "bug encontrado" abaixo) já incorporada ao arquivo
local da primeira migration — não existe um arquivo de migration separado
para o fix porque ele foi feito antes de qualquer commit, direto no texto
da migration original.

### Slug

`company.slug` — `text not null`, `unique`, `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
and length(slug) between 1 and 63)`. Backfill automático rodou nas 3
empresas reais existentes (nenhuma tinha slug antes). Geração/edição
sempre passa por `public.set_company_slug(company_id, desired_slug,
auto_suffix)` (SECURITY DEFINER, mas com checagem explícita de
`auth.uid()` + `user_company_role` antes de qualquer escrita — o mesmo
padrão de `create_company_with_owner`): auto-sufixa (`-2`, `-3`...) na
criação (onboarding), erro amigável em vez de sufixo surpresa na edição
manual (Configurações → "Página pública"). `reserved_slug` é uma tabela de
lookup (RLS habilitada, sem nenhuma policy — só as funções SECURITY
DEFINER a leem, de propósito) com a lista de rotas da plataforma
(`login`, `agenda`, `configuracoes`, etc.) — um `trigger` em `company`
rejeita qualquer slug reservado antes mesmo de chegar no `set_company_slug`.
A mesma lista/normalização existe em `lib/slug.ts` só para preview
instantâneo no cliente; a fonte de verdade de unicidade é sempre o banco.

### Camada pública (visitante anônimo, sem `auth.uid()`)

Nenhuma tabela ganhou policy nova para `anon`. Em vez disso, um conjunto de
funções `SECURITY DEFINER` (`search_path` fixo, `EXECUTE` revogado de
`PUBLIC` e concedido só a `anon`/`authenticated`) resolve slug → empresa e
expõe só o que é público:

- `get_public_company(slug)`, `get_public_services(slug)`,
  `get_public_team(slug)`, `get_public_professionals(slug, service_id)` —
  leitura, sempre filtrando por `status='active'`/`is_public`/`active`
  conforme a tabela.
- `get_public_available_slots(slug, service_id, date, professional_id?,
  unit_id?)` — resolve o slug e **delega 100% para `get_available_slots()`
  da Fase 2** (chamada interna herda o privilégio do SECURITY DEFINER, não
  precisa de nenhuma policy pra `anon`). Nenhuma lógica de disponibilidade
  foi duplicada.
- `create_public_appointment(...)` — valida cada id recebido contra a
  empresa resolvida pelo slug (nunca confia em ids do cliente), deriva
  preço/duração do serviço no banco, reconfirma o horário exato contra o
  motor antes do insert, e a proteção final contra concorrência continua
  sendo a `exclusion constraint` já existente (`appointment_service_no_overlap`)
  — captura `exclusion_violation`/`unique_violation` e devolve
  `HORARIO_INDISPONIVEL` em vez de um erro técnico. Cliente é
  encontrado-ou-criado por telefone normalizado (`regexp_replace(phone,
  '\D','','g')`), escopado à empresa — nunca ao profissional.
- `get_public_appointment(token)` / `cancel_public_appointment(token)` —
  acesso do cliente ao próprio agendamento é só por
  `appointment.client_access_token` (`uuid` aleatório, `unique`, gerado na
  criação), nunca pelo id sequencial. Sem token, sem consulta — essa é a
  base segura exigida para visualizar/cancelar sem um sistema de auth de
  cliente completo (reagendamento fica para a Fase 4).

**Hardening pontual encontrado ao inspecionar o schema antes de alterar**
(seção 22/23 da especificação): `get_available_slots()` (Fase 2) e
`create_company_with_owner()` tinham `GRANT EXECUTE` para `anon`/`PUBLIC`
concedido pelo default do Postgres, nunca revogado explicitamente. Não
vazava nada (RLS/validação interna já bloqueavam), mas ambos os grants
foram revogados nesta fase por não serem mais necessários — a camada
pública tem suas próprias funções agora. Documentado, não é uma correção
de bug de segurança explorável, é fechamento de superfície desnecessária.

**Exposição pré-existente, fora do escopo desta fase**: `anon`/`PUBLIC`
têm `GRANT` direto de `INSERT/SELECT/UPDATE/DELETE` em várias tabelas da
aplicação (`company`, `client`, `appointment`, etc.) — provavelmente o
default do projeto Supabase, anterior a qualquer migration deste repo.
Como RLS está habilitado em todas e nenhuma policy é concedida à role
`anon`, isso não expõe nada hoje (RLS nega por padrão), confirmado pelos
testes 29/30 abaixo. Revogar esses grants tabela-por-tabela é uma limpeza
maior (dezenas de tabelas, incluindo fora do que esta fase toca) — fica
como pendência de hardening documentada, não como "ainda inseguro".

### Rotas públicas

`app/[slug]/page.tsx` (perfil público), `app/[slug]/agendar/page.tsx` +
`BookingWizard.tsx` (fluxo completo serviço→profissional→data→horário→
dados→revisão→confirmação), `app/[slug]/agendamentos/[token]/page.tsx`
(ver/cancelar o próprio agendamento). `lib/supabase/middleware.ts` foi
ajustado: em vez de uma lista de rotas públicas, agora só as raízes
administrativas conhecidas (`/agenda`, `/clientes`, `/configuracoes`,
`/onboarding`, etc. + `/`) exigem sessão — qualquer outro caminho,
incluindo `/{slug}` dinâmico, é público por padrão. As rotas admin
existentes continuam todas no root sem prefixo (não migraram para
`/{slug}/admin` nesta fase — a arquitetura permite, mas mover páginas
inteiras ficou fora do escopo pedido).

### Testes (Supabase real, `xaxszgyvapvzwensbjjq`)

Os 34 cenários pedidos + os 4 passos do teste funcional completo (criar
empresa "Barbearia de Teste"/slug `barbeariadeteste`, profissional Carlos,
serviço Corte 45min, jornada 09:00–18:00 com intervalo 12:00–13:00,
agendamento pré-existente 10:00–10:45, reservar via
`create_public_appointment`, confirmar bloqueio, cancelar via token,
confirmar liberação) — **38/38 PASS**. Rodado como uma função temporária
(`pg_temp.run_phase3_tests()`, criada e usada dentro da mesma sessão SQL,
nunca persistida) que insere os dados de teste, roda as asserções
retornando um `setof text` (não `RAISE NOTICE`, que o client MCP não
captura), e ao final faz `DELETE` explícito de tudo que criou, em ordem de
dependência — não é rollback de transação, é limpeza real, confirmada
depois por contagem (`company`/`client`/`appointment` voltaram exatamente
ao estado anterior: 3 empresas reais, 0 resíduo).

Testes 29/30 (privacidade) rodaram literalmente como a role `anon`
(`SET LOCAL ROLE anon`) tentando `SELECT` direto em `client`/`company` e
chamar `get_available_slots()` sem passar pela camada pública — RLS
bloqueou a leitura direta (zero linhas) e o `REVOKE` bloqueou a chamada de
função (permissão negada), confirmando que a única porta de entrada
pública é mesmo a camada de funções desta fase.

**Bug real encontrado e corrigido antes do primeiro teste completar**:
`create_public_appointment` tinha `returning id, client_access_token into
...` — `client_access_token` é ao mesmo tempo uma coluna de
`public.appointment` e uma variável implícita de saída do próprio
`RETURNS TABLE` da função, então a referência era ambígua (erro Postgres
`42702`). Corrigido com `insert into public.appointment as a (...) ...
returning a.id, a.client_access_token` — o alias desambigua. Encontrado na
primeira execução dos testes (rollback intencional, nenhum dado real
afetado), corrigido, e só depois disso a bateria completa rodou e passou.

## Fase 4 — Gestão + Inteligência

Migrations: `20260908160000_phase4_operational_core.sql` (schema:
sale/sale_item/payment/cash_session/cash_movement/commission/
stock_movement/financial_entry/campaign/audit_log + attendance_item
virando polimórfico serviço/produto + triggers cross-tenant + RLS),
`20260908160100_phase4_functions.sql` (orquestração atômica:
close_attendance/cancel_sale/adjust_stock/open_cash_session/
close_cash_session/write_audit_log/get_dashboard_metrics, todas
`SECURITY INVOKER` — rodam com o privilégio de quem chama, RLS é a
barreira real, igual ao desenho de `get_available_slots` na Fase 2) e
`20260908160200_phase4_reserved_slugs.sql` (mais 4 rotas administrativas
reservadas). Todas aditivas, aplicadas no projeto real.

### Cadeia operacional

`close_attendance()` é o coração da fase: fecha um atendimento e, numa
transação só, cria a `sale` + `sale_item` (um por item do atendimento,
serviço ou produto), calcula e grava a `commission` de cada item de
serviço (`service.default_commission_percent` com fallback pro
`professional.default_commission_percent`), baixa o `stock_movement` +
`product.current_stock` de cada item de produto, grava os `payment`
informados (validando que o método está habilitado em `payment_method`),
lança a movimentação de `cash_movement` quando há uma sessão de caixa
aberta pra unidade, e cria o `financial_entry` de receita — tudo ou nada.
`cancel_sale()` é o espelho: nunca apaga histórico, sempre lança estornos
compensatórios (`financial_entry` categoria "estorno", `cash_movement`
saída) e reverte estoque/comissão via mudança de status, nunca DELETE.

Desconto/acréscimo global no fechamento é alocado proporcionalmente a
cada item (`item.final_price / subtotal`) antes de calcular a comissão —
a comissão sempre incide sobre o valor pós-desconto do item específico,
nunca sobre o preço de tabela.

### Consolidação (`get_dashboard_metrics`)

Fonte única de métricas reaproveitada por Dashboard, KPIs e Relatórios —
nenhuma das três telas recalcula nada por conta própria, todas chamam
`actions/dashboard.ts:fetchDashboardComparison()`. Definições implementadas
exatamente como o glossário da especificação: faturamento = soma de
`sale.total` com `status='completed'` no período; receita recebida = soma
de `payment.amount` com `status='confirmed'`; ticket médio = faturamento /
quantidade de vendas completed; clientes novos = primeiro atendimento
`completed` da vida do cliente caiu dentro do período; recorrentes = teve
atendimento completed no período E antes dele. Ocupação real vem de
`attendance_item.started_at/ended_at` (cronômetro real, nunca estimado);
ocupação planejada vem de `professional_schedule` expandido pelos dias do
período — **simplificação assumida deliberadamente**: não desconta ainda
`professional_block`/`professional_absence` da capacidade planejada
(ficaria mais preciso, mas o Dashboard já é utilizável sem isso; documentado
aqui em vez de escondido).

### Permissões

O sistema de roles (owner/admin/staff) não ganhou papéis novos nesta fase
— em vez de reescrever `role`/`user_company_role`, `lib/permissions.ts`
adiciona uma segunda camada: owner/admin continuam com acesso amplo, e um
usuário comum só vê o próprio contexto quando o registro `professional`
correspondente tem `user_id = auth.uid()` (Central do Barbeiro, Comissões
"minhas"). É uma decisão de escopo deliberada — o pedido de 5 papéis
(Admin/Gerente/Recepção/Barbeiro/Cliente) ficaria mais completo com um
role novo por papel, mas exigiria alterar policies em todas as tabelas
das 4 fases; o que foi implementado cobre a exigência de segurança central
("um barbeiro não vê dado de outro") sem esse raio de mudança.

### Testes (Supabase real)

25/25 checks executados via função temporária (mesmo padrão da Fase 3):
atendimento com serviço+produto, cronômetro calculando duração real a
partir de timestamps (não setInterval), abertura/duplicação de caixa,
close_attendance criando venda+itens+comissão+baixa de estoque+
pagamento+financeiro atomicamente, get_dashboard_metrics batendo com os
dados reais recém-criados, cancel_sale revertendo estoque/comissão/
pagamento e lançando o estorno sem apagar nada, fechamento de caixa sem
divergência (o estorno em dinheiro voltou pro saldo), ajuste manual de
estoque, auditoria registrada, triggers cross-tenant rejeitando
unidade/serviço de outra empresa, RLS bloqueando leitura direta de `sale`
como `anon`. Limpeza real ao final (DELETE explícito, não rollback),
confirmada por contagem — nenhum resíduo, dados reais pré-existentes
inalterados.

### O que ficou deliberadamente mais enxuto nesta fase

Campanhas de CRM (tabela `campaign` criada e com RLS, sem UI de
CRUD ainda), visualização dedicada de `audit_log` (os eventos são
gravados corretamente, só não há tela própria pra navegá-los — hoje são
consultáveis via SQL/Supabase Studio), geração de PDF em Relatórios usa
impressão do navegador (`window.print()`) em vez de uma biblioteca de PDF
(nenhuma existe no projeto — não seria honesto adicionar uma dependência
nova só para simular a funcionalidade). Nada disso está mockado — é
trabalho real que ficou de fora do escopo desta rodada por tempo, não
dado fictício.

## Prova de Fogo 1 — Consolidação (Bloco A: PDV)

Migration: `20260909100000_provadefogo1_pdv.sql`. Aditiva.

Descoberta ao inspecionar antes de alterar: `sale.client_id` era
`NOT NULL` — a Fase 4 sempre associava a venda ao cliente do atendimento
de origem (também `NOT NULL`), o que bloqueava exatamente o caso "cliente
não quer se identificar" que o PDV precisa suportar. Corrigido soltando o
`NOT NULL` e reescrevendo `check_sale_same_company()` para validar o
cliente só quando presente (unidade continua sempre obrigatória).

`create_pdv_sale()` é o equivalente de `close_attendance()` para venda
avulsa de produto: mesmo núcleo comercial da Fase 4 (`sale`/`sale_item`/
`payment`/`stock_movement`/`cash_movement`/`financial_entry`), nenhuma
tabela nova. Nunca cria `commission` (não há profissional envolvido num
item de PDV). `cancel_sale()` — já existente, sem nenhuma alteração —
cancela vendas de PDV normalmente, porque já trabalha genericamente por
`sale_item` em vez de assumir uma origem de atendimento.

15/15 checks executados no Supabase real: venda sem atendimento, venda
sem cliente, múltiplos produtos, baixa de estoque real, pagamento real,
entrada no caixa aberto, lançamento financeiro, nenhuma comissão gerada,
venda de atendimento continuando a funcionar, faturamento consolidado
sem dupla contagem (PDV + atendimento somados corretamente em
`get_dashboard_metrics`), estoque insuficiente rejeitado, cliente
identificado funcionando, produto de outra empresa rejeitado,
cancelamento revertendo estoque e pagamento. Dados de teste removidos ao
final, confirmados por contagem.

### Outras correções desta rodada (fora do PDV)

`getCurrentCompany()` usava "primeiro vínculo do usuário" como decisão de
tenancy — o padrão que a Prova de Fogo pede para eliminar. Substituído por
uma "empresa ativa" explícita: cookie `fade_active_company`, sempre
revalidado contra `user_company_role` do próprio usuário antes de usar
(nunca confia cegamente no cookie), com fallback para o vínculo mais
antigo só quando não há cookie válido — esse fallback continua
determinístico, documentado, e nunca cruza usuários. `actions/company-
context.ts:setActiveCompany()` é a única forma de mudar de empresa, e só
grava o cookie depois de confirmar o vínculo no banco.

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
