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

Nenhum arquivo das migrations 1–3 foi alterado nesta rodada.

## Antes de aplicar em produção

Este ambiente não tem acesso de rede ao projeto Supabase real nem ao CLI
vinculado — as migrations **não foram aplicadas** ao banco vivo, só
commitadas. Antes de aplicar:

1. **Rode `PRE_FLIGHT_CHECK.sql`** (neste diretório) no SQL Editor do
   dashboard, bloco por bloco. É só leitura — não cria, altera ou apaga
   nada. Ele responde, com dados reais do seu banco, as perguntas que esta
   auditoria não pode responder sem acesso: as tabelas já existem, com que
   forma exata? já existe alguma policy/grant/function com o mesmo nome, de
   origem diferente? existe dado que quebraria uma constraint nova?

2. **O único ponto genuinamente arriscado da baseline**: a constraint de
   exclusão em `appointment_service` (`appointment_service_no_overlap`,
   bloco 4 do `PRE_FLIGHT_CHECK.sql`). Diferente do resto da baseline (que
   só cria o que ainda não existe), essa linha roda incondicionalmente e o
   Postgres valida TODA a tabela ao adicioná-la — se já existirem dois
   agendamentos ativos do mesmo profissional com horário sobreposto, a
   instrução falha. Isso é seguro (a transação da migration inteira faz
   rollback — nenhum dado é alterado, ela simplesmente não aplica até o
   conflito ser resolvido), mas é a única parte da baseline que pode
   *falhar* contra dados reais em vez de simplesmente não fazer nada. Rode
   o bloco 4 do pré-flight primeiro.

3. **`CREATE TABLE IF NOT EXISTS` não retrofita schema.** Se qualquer uma
   das 12 tabelas já existir em produção — o cenário esperado — a baseline
   não adiciona colunas, constraints ou defaults a ela, mesmo que a
   definição no arquivo seja diferente. A baseline documenta a forma que o
   código espera; ela não força o banco a bater com o arquivo. Use o bloco
   2 do pré-flight para comparar manualmente as colunas reais contra cada
   `CREATE TABLE` do arquivo antes de assumir que baseline e produção
   coincidem.

4. **`anon`/`public` nunca recebem grant destas migrations.** Todo `GRANT`
   daqui em diante é só para `authenticated`. Se o bloco 7 do pré-flight
   mostrar algum privilégio de `anon`/`public` nas tabelas de tenancy, é uma
   exposição pré-existente que estas migrations não removem sozinhas (não
   revogamos o que não concedemos) — decida deliberadamente se precisa de
   um `REVOKE` explícito numa migration própria antes de seguir.

Depois desses quatro pontos, aplicar é o de sempre:

```bash
# com o projeto já linkado (supabase link --project-ref <ref>)
supabase db push

# ou, direto no SQL Editor do dashboard, nesta ordem:
# 1. 20260905120000_baseline_schema.sql
# 2. 20260905120100_tenancy_bootstrap_and_rls.sql
# 3. 20260905120200_cross_tenant_integrity_triggers.sql
# 4. 20260906090000_appointment_attendance_cross_tenant_and_function_hardening.sql
```

## Mudança que a aplicação já precisa (já feita no código)

`actions/onboarding.ts` (`createCompanyStep`) chama
`supabase.rpc("create_company_with_owner", {...})` em vez de inserir
diretamente em `company`. Isso é obrigatório: depois da migration 2, o
INSERT direto em `company` e `user_company_role` fica bloqueado para
`authenticated` — só a função (SECURITY DEFINER) pode escrever nessas duas
tabelas na criação inicial.

## O que não foi (e não pôde ser) testado neste ambiente

Sem conexão com o Supabase real, não foi possível rodar as migrations nem
os 14 critérios de aceitação (bootstrap real, RLS ao vivo, tentativa de
cross-tenant real) contra um banco de fato. O que foi validado sem banco:
sintaxe SQL revisada manualmente arquivo por arquivo, `npm run build`/lint
limpos, e a lógica de cada trigger/policy raciocinada contra os dados que
`actions/*` efetivamente envia. Os testes reais da seção 36 do pedido
original continuam pendentes de um ambiente com acesso ao projeto.
