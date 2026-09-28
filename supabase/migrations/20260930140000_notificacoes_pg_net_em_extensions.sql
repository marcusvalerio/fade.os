-- pg_net fora do schema public (linter do Supabase: extension_in_public).
-- A extensão não aceita SET SCHEMA; recriar é seguro porque nada depende
-- dela além de acordar_envio_push(), que chama net.http_post pelo nome em
-- tempo de execução (o schema "net" volta junto).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
