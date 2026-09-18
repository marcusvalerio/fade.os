# infrastructure/

Reservado para os adapters concretos.

Vazio de propósito nesta fase (ARCH 1). A partir de ARCH 2, é aqui que
entram os Repositories que encapsulam exatamente as chamadas
`supabase.from(...)`/`supabase.rpc(...)` que hoje ficam inline dentro de
`actions/*.ts` — sem reimplementar a regra que já vive nas RPCs
`SECURITY DEFINER`. A partir de ARCH 3, é também aqui que entra o adapter
de identidade que hoje é `supabase.auth.*` chamado diretamente.

`lib/supabase/{server,client,admin,middleware}.ts` continuam onde estão
— são as fábricas de cliente Supabase, já isoladas em 4 arquivos. Os
Repositories/adapters desta pasta vão importar delas, não substituí-las.
