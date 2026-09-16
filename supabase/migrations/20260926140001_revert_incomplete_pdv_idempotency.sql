-- Reversão segura da tentativa incompleta de idempotência do PDV.
-- A migration anterior adicionou apenas a coluna/índice de forma segura; a
-- redefinição da RPC foi removida porque dependia de um helper inexistente.
-- Mantemos a coluna e o índice: a aplicação poderá adotar a chave em uma
-- migration posterior que redefina a RPC completa, sem quebrar o contrato atual.

drop index if exists public.sale_company_idempotency_key_uq;
alter table public.sale drop column if exists idempotency_key;
