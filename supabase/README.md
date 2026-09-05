# Migrations do FADE OS

Este diretório passa a ser a fonte de verdade do schema do banco. Antes desta
rodada não havia migrations versionadas — o schema só existia no dashboard do
Supabase, o que impedia reproduzir o banco a partir do repositório (seção 23
do pedido de hardening).

## Arquivos

- `20260905120000_baseline_schema.sql` — reconstrói (de forma idempotente,
  `IF NOT EXISTS`) as tabelas, índices, constraints e triggers já usadas pelo
  código em `actions/*` e `lib/types.ts`. Não altera nem apaga dado nenhum.
- `20260905120100_tenancy_bootstrap_and_rls.sql` — a camada de segurança:
  endurece `my_company_ids()`, cria a função `create_company_with_owner`
  (bootstrap atômico de empresa + papel `owner`) e define/atualiza todas as
  RLS policies de tenancy. Corrige o ciclo descrito na tarefa: um usuário
  novo não tinha como criar o primeiro vínculo em `user_company_role`
  porque a policy de insert exigia já ter um vínculo.

## Como aplicar

Este ambiente de execução não tem acesso de rede ao projeto Supabase nem ao
Supabase CLI instalado, então as migrations **não foram aplicadas** ao banco
vivo — apenas commitadas. Para aplicar:

```bash
# com o projeto já linkado (supabase link --project-ref <ref>)
supabase db push

# ou, direto no SQL Editor do dashboard, nesta ordem:
# 1. 20260905120000_baseline_schema.sql
# 2. 20260905120100_tenancy_bootstrap_and_rls.sql
```

Antes de aplicar em produção, recomenda-se rodar `supabase db diff` (ou
comparar manualmente) contra o schema atual do dashboard, já que a baseline
foi reconstruída a partir do código-fonte, não exportada do banco.

## Mudança que a aplicação precisa (já feita neste commit)

`actions/onboarding.ts` (`createCompanyStep`) foi atualizado para chamar
`supabase.rpc("create_company_with_owner", {...})` em vez de inserir
diretamente em `company`. Isso é obrigatório: depois desta migration, o
INSERT direto em `company` e `user_company_role` fica bloqueado para o role
`authenticated` — só a função (SECURITY DEFINER) pode escrever nessas duas
tabelas na criação inicial.
