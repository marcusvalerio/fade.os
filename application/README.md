# application/

Fronteira da Application layer (ARCH 1 — Foundation).

Hoje só contém o contrato `Result<T>` (`result.ts`), compartilhado por
Use Cases/Services que ainda não existem. As Server Actions em `actions/`
continuam onde estão — nada foi movido para cá nesta fase.

A partir de ARCH 4, os Use Cases que hoje vivem misturados dentro dos
arquivos de `actions/*.ts` (validação + chamada de Repository/Identity +
regra de orquestração) passam a morar aqui, com a Server Action virando
uma casca fina que só invoca o Use Case correspondente.
