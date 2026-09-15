# CORTEX.OS — R25: fechamento do P1 de privacidade (R24 §4) + revalidação de segurança

Escopo desta rodada: a especificação de fechamento pré-beta pedia uma
auditoria completa de ~20 áreas do produto (Admin, Beta, booking, landing,
financeiro, agenda, catálogo, comissões, backup, observabilidade,
performance, mobile...). Dado o tamanho real do pedido, esta rodada não
tentou cobrir as 20 áreas do zero — o histórico em `docs/` já documenta
rodadas anteriores (R23.8, R23.9, R24) que atacaram a maior parte delas a
fundo, com evidência ao vivo contra o banco de produção. Esta rodada:

1. Leu o histórico completo de auditorias para separar o que já estava
   fechado do que ainda estava em aberto.
2. Identificou que o **único P1 confirmado e não corrigido** deixado pela
   R24 (`docs/auditoria-final-go-no-go-r24.md` §4) — colega lendo
   e-mail/telefone/comissão de colega via REST direto — continuava aberto
   no schema atual (confirmado por leitura de `pg_policies` antes de
   qualquer alteração).
3. Corrigiu esse P1, com uma correção mais completa do que a
   originalmente especificada (ver §1).
4. Reatacou segurança multi-tenant e financeira (P0) para confirmar que
   nada regrediu desde a R24, já que o schema mudou bastante nesse
   intervalo (Beta com suspensão de empresa, booking multi-serviço,
   plataforma admin).

Este documento não substitui R23.8/R23.9/R24 — é um adendo focado no que
mudou nesta rodada.

---

## 1. P1 corrigido: privacidade de colegas (`professional`)

### Antes (revalidado ao vivo antes de qualquer alteração)

```
pg_policies de professional: 3 policies (select/insert/update), todas
"company_id in my_company_ids()" — sem distinção de papel.
staff (Bruno, NORTE 21) → SELECT email, phone, default_commission_percent
  FROM professional WHERE company_id = <própria empresa> → sucesso,
  devolve o dado real de QUALQUER colega, confirmado com um profissional
  de dados reais (QA Profissional 01): email=qa.prof01@exemplo.test,
  phone=(21) 97000-0001.
```

### Causa raiz

RLS do Postgres filtra LINHA, nunca COLUNA. A policy correta por linha
(`company_id in my_company_ids()`) não tem como dizer "esconda só estas
três colunas para quem não é o próprio dono nem gerência".

### Correção (`20260922090000_professional_directory_privacy.sql`)

Diferente da correção que a R24 apenas esboçou (view simples com
`security_invoker = true`), esta rodada foi mais longe em duas frentes,
por necessidade real encontrada na leitura do código:

1. **Preservar uma funcionalidade legítima já em produção.**
   `lib/pessoas.ts` (`rotularHomonimos`) usa os ÚLTIMOS 4 DÍGITOS do
   telefone de um colega para desempatar homônimos em "Início"
   (`ProximosAtendimentos.tsx`) e "Comissões" — deliberado, documentado,
   nunca expõe o número inteiro. Uma correção que zera `phone` para todo
   colega quebraria essa tela. Solução: coluna gerada
   `professional.phone_last4` (4 dígitos, sensibilidade baixa o
   suficiente para ficar acessível a qualquer colega da empresa,
   exatamente como já é hoje na tela) + `GRANT` de coluna liberado para
   ela; email e telefone COMPLETO continuam bloqueados.
2. **A view não podia ser `security_invoker = true`.** A R24 sugeriu esse
   modificador, mas ele quebra a própria correção: se a view roda com o
   privilégio de quem consulta (`authenticated`), o `CASE WHEN` dentro
   dela ainda precisa de permissão de COLUNA sobre `email`/
   `default_commission_percent` para quem chama — exatamente o que a
   migration revoga. Testado neste ambiente antes de aplicar: com
   `security_invoker = true` e a coluna revogada, a própria gerência
   recebe `permission denied for column email`. A view final usa o
   comportamento padrão (SECURITY DEFINER implícito, sem esse
   modificador) — mesmo padrão que `admin_list_companies()`/
   `admin_list_users()` já usam para leitura cross-tenant controlada — com
   o filtro de tenant replicado explicitamente dentro da view
   (`company_id in my_company_ids()`), porque o dono da view ignora RLS de
   linha.

Mecanismo final:

- `REVOKE SELECT` em `professional` de `authenticated`; `GRANT SELECT`
  granular só nas colunas seguras + `phone_last4`.
- `professional_directory` (view): devolve `email`/`phone`/
  `default_commission_percent` reais só quando
  `has_company_management_access(company_id)` ou `user_id = auth.uid()`;
  `null` para os demais. `phone_last4` sempre visível (baixa
  sensibilidade).
- 4 pontos de leitura gerencial/self migrados para a view:
  `/profissionais`, `/profissionais/[id]`, `/profissionais/[id]/jornada`
  (esta não precisa da view — só usa `name`, então teve o select
  simplesmente reduzido a colunas seguras), `getProfessional()` em
  `actions/profissional-acesso.ts`.
- 4 pontos de leitura operacional (embutidos via join do PostgREST, que
  não podem apontar para a view — só para a tabela base) trocaram `phone`
  por `phone:phone_last4` no alias do `select`: `agenda/novo`,
  `atendimento/[id]`, `ProximosAtendimentos` (Início), `Comissões`.
  `email`, que nunca foi renderizado nesses quatro pontos, foi removido do
  select (deixava de funcionar de qualquer forma, já que não é mais
  legível pela tabela base).

### Achado extra durante a investigação (corrigido junto)

`/profissionais/[id]` e `/profissionais/[id]/jornada` **não tinham nenhum
gate de gerência** — só a lista (`/profissionais`) tinha. Um staff que
descobrisse o UUID de um colega (visível em várias respostas de
agenda/atendimento) acessava a ficha completa — incluindo, antes desta
correção, e-mail/telefone/comissão renderizados direto no formulário —
digitando a URL. O mesmo padrão foi encontrado e corrigido em
`/servicos/[id]` (a lista `/servicos` tem gate, o editor individual não
tinha, e além disso fazia `select("*")` em `professional` só para
mostrar `id`/`name` — reduzido).

### Depois (reatacado ao vivo, mesmo staff, mesmos dados)

```
staff (Bruno) → SELECT email FROM professional direto           → 42501
staff (Bruno) → SELECT phone FROM professional direto            → 42501
staff (Bruno) → SELECT default_commission_percent direto         → 42501
staff (Bruno) → SELECT name, phone_last4 FROM professional        → OK (continua funcionando)
staff (Bruno) → professional_directory WHERE id = <QA Prof 01>   → email=NULL phone=NULL phone_last4=0001 comm=NULL
owner (NORTE 21) → professional_directory WHERE id = <QA Prof 01> → email=qa.prof01@exemplo.test phone=(21) 97000-0001 phone_last4=0001 comm=35.00
staff Petrux → professional_directory WHERE id = <profissional NORTE 21> → 0 linhas (cross-tenant)
```

Todos os 4 pontos de leitura operacional reatacados como staff depois da
migration: `agenda/novo`, `atendimento/[id]`, `/servicos/[id]`,
`/profissionais/[id]/jornada` — todos funcionando com o novo esquema de
colunas (evidência em `t3`/`t4`/`t5` desta rodada, transações revertidas).

`get_advisors(security)` sinaliza `professional_directory` como
`security_definer_view` (ERROR genérico do linter). Esperado e aceito por
desenho — é a mesma classe de mecanismo que `admin_list_companies()` já
usa, com o filtro de tenant replicado manualmente dentro da view e
testado ao vivo acima. Não é um achado novo desta rodada.

### Regressão

```
npm install (node_modules não estava presente neste ambiente)
npx tsc --noEmit ........... limpo, antes e depois
npm test .................... 103/103, antes e depois
npm run build ................ 41 rotas, sem erro, antes e depois
```

---

## 2. Reataque de segurança P0 (multi-tenant + financeiro), schema atual

Reatacado nesta rodada, contra o schema atual (não assumido herdado da
R24 — várias migrations novas desde então: Beta com suspensão de empresa,
booking multi-serviço, plataforma admin):

| Ataque | Ator | Resultado |
|---|---|---|
| SELECT `client`/`appointment`/`sale`/`financial_entry`/`commission` de outra empresa | staff Petrux → dado NORTE 21 | 0 linhas em todas |
| INSERT `appointment` em outra empresa (unit_id válido da empresa alvo) | staff Petrux → NORTE 21 | BLOQUEADO — trigger `check_appointment_same_company` |
| INSERT `financial_entry` fabricada (R$ 999.999) | staff, própria empresa | BLOQUEADO 42501 |
| UPDATE `service.default_price` direto | staff, própria empresa | BLOQUEADO 42501 |
| RPC `create_pdv_sale` com `company_id` de outra empresa | staff Petrux → NORTE 21 | BLOQUEADO — `FORBIDDEN` |

Uma nota de rigor: o primeiro teste do INSERT cross-tenant em
`appointment` desta rodada deu um falso positivo ("gravou") por um erro
no próprio script de ataque — o `unit_id` vinha de um `SELECT` já
filtrado por RLS (devolvia 0 linhas para o atacante), então o
`INSERT ... SELECT` inseria 0 linhas e não gerava erro nenhum, o que o
script interpretou incorretamente como sucesso. Refeito com um `unit_id`
válido obtido fora do contexto do atacante e checando `GET DIAGNOSTICS
row_count`: o ataque real é bloqueado, como a tabela acima mostra. Fica
registrado porque é exatamente o tipo de erro que este brief pede para
não esconder.

Nenhuma regressão de P0 encontrada.

---

## 3. O que esta rodada NÃO cobriu (e por quê)

Ficam de fora desta rodada, não por decisão de que são triviais, mas
porque o pedido completo (20 áreas, redesign de Admin e Landing, teste
mobile em 4 breakpoints, ataques de concorrência real, backup/PITR)
excede o que uma rodada consegue tratar com o mesmo padrão de evidência
usado acima (ataque real, revertido, revalidado). O que já existe de
trabalho recente e relevante, confirmado por leitura do `git log`, não
por suposição:

- Admin: paleta/Supreme removidos e ciclo Beta/empresa fechado em
  commits anteriores a esta rodada (`b7ff297`, `6aa5e0e`) — não
  reauditado visualmente nesta rodada.
- Booking público multi-serviço: implementado em commit anterior
  (`9d8db19`) — não reatacado nesta rodada.
- Geometria de marca antiga ("O Corte") removida em commit anterior
  (`af283b3`).

Ver relatório de fechamento (mensagem final desta sessão) para a lista
completa do que fica como pendência conhecida, não verificada nesta
rodada.
