# domain/

Reservado para a Domain layer (ARCH 5 — Domain isolation).

Vazio de propósito nesta fase (ARCH 1). Quando chegar a hora, é aqui que
entram os agregados/tipos de domínio (Agendamento, Atendimento, Venda,
Sessão de Caixa, Comissão) e as regras que hoje são TypeScript puro sem
equivalente no banco (segmentação de cliente, insights operacionais) —
consolidadas numa única implementação em vez de espalhadas.

A parte transacional do domínio (agendamento, atendimento, venda, caixa,
catálogo) já vive isolada da UI hoje — só que em SQL, dentro de RPCs
`SECURITY DEFINER` e triggers do Postgres, não neste diretório. ARCH 1-3
não move nada disso: a auditoria arquitetural foi explícita que copiar
regra de negócio de SQL para TypeScript não é o objetivo — o Repository
(ARCH 2) chama a RPC, não a reimplementa.
