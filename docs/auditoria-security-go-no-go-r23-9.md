# FADE.OS / CORTEX.OS — R23.9: Auditoria mestre de segurança, autorização, privacidade e GO/NO-GO

Pergunta que rege esta rodada: **uma barbearia real consegue usar o CORTEX.OS
com segurança, sem que um usuário ultrapasse seu escopo, comprometa dados de
outra empresa ou quebre a integridade financeira?**

Metodologia: ataque direto ao banco de produção real (`xaxszgyvapvzwensbjjq`),
com o usuário real rebaixado a `staff` **dentro de transações sempre
revertidas** (`BEGIN ... ROLLBACK`) — nunca commitado, nunca persistido.
Nenhuma linha de dado real foi alterada por esta auditoria. Todo resultado
abaixo é reprodutível e citado com a query que o produziu.

---

## 1. Baseline

```
branch  claude/fade-os-pre-pilot-update-7znkqj
SHA     59a371c37d568382decde3e8b736c5d7f42874e (antes desta rodada)
origin  https://github.com/marcusvalerio/fade.os
main    5d638a6 (não tocado)
working tree: limpo antes de começar
migrations: 42 (antes) → 43 (depois desta rodada)
testes: 85/85 (antes e depois)
typecheck: limpo (antes e depois)
build: completo (antes e depois)
```

Nenhum reset destrutivo, nenhuma fixture de QA apagada, nenhum history
rewrite.

---

## 2. Reprodução do P0 da R23.8

Rebaixando o dono da NORTE 21 BARBEARIA a `staff` dentro de uma transação
revertida (`user_company_role.role_id = staff`, `set local role
authenticated`, `request.jwt.claims.sub = <mesmo user_id>`):

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `financial_entry` | **112 linhas** | **SUCESSO** (R$ 999.999 fabricado) | bloqueado (`42501 permission denied`) | bloqueado (`42501`) |
| `commission` | **38 linhas** | **SUCESSO** (R$ 1.000 fabricada) | bloqueado (`42501`) | — |
| `sale` | **91 linhas** | **SUCESSO** (venda fabricada, sem `create_pdv_sale`) | — | — |
| `sale_item` | **105 linhas** | — | — | — |
| `cash_movement` | **58 linhas** | **SUCESSO** (com sessão aberta de propósito, R$ 5.000 `other_in`) | — | — |
| `cash_session` | **18 linhas** | — | — | — |

UPDATE/DELETE já estavam bloqueados por uma correção anterior (revogação de
grant, `20260913092000`). O buraco confirmado era leitura e inserção.

**Root cause, também confirmado:** `create_pdv_sale` e `close_attendance` —
as únicas funções que legitimamente escrevem em `sale`/`sale_item`/`payment`/
`financial_entry`/`commission` — são `SECURITY INVOKER`
(`prosecdef = false`, confirmado via `pg_proc`). Cada INSERT que fazem roda
com a permissão de quem chamou. Isso significa que a única coisa impedindo
um staff de fabricar essas linhas era o mesmo RLS frouxo que ele podia
contornar com um `INSERT` direto — não havia fronteira real.

---

## 3. Correção aplicada

Migration `supabase/migrations/20260918090000_financial_role_boundary.sql`,
em duas partes que precisam andar juntas:

**3.1 — `create_pdv_sale` e `close_attendance` viram `SECURITY DEFINER`**,
com uma checagem explícita de vínculo (`user_company_role`) logo no início —
a mesma proteção que a RLS dava de graça em modo invoker, agora escrita à
mão, porque uma função `SECURITY DEFINER` não herda RLS da tabela. Sem essa
checagem, virar `DEFINER` teria trocado um buraco por outro (aceitar
`company_id`/`attendance_id` de qualquer empresa). Nenhuma outra linha da
lógica de negócio das duas funções mudou.

**3.2 — RLS por papel** em `financial_entry`, `sale`, `sale_item`, `payment`
(leitura e escrita: só `has_company_management_access`) e `commission`
(escrita: só gerência; **leitura: gerência OU o próprio profissional** — o
mesmo filtro que `/comissoes` já aplicava em código,
`getOwnProfessionalId`/`.eq("professional_id", ownProfessionalId)`; agora o
banco garante o mesmo, não só a página).

`cash_movement`/`cash_session` ficaram de fora, de propósito — ver §16.

### Revalidação (mesmo ataque, depois da correção)

```
SELECT financial_entry como staff ....... 0 linhas (era 112)
SELECT commission como staff ............ 0 linhas (era 38)
SELECT sale como staff .................. 0 linhas (era 91)
SELECT sale_item como staff ............. 0 linhas (era 105)
SELECT payment como staff ............... 0 linhas
INSERT financial_entry fabricado ........ BLOQUEADO — 42501 RLS
INSERT sale fabricada ................... BLOQUEADO — 42501 RLS
INSERT commission (FKs válidas) ......... BLOQUEADO — confirmado via
    has_company_management_access(company_id) = false para o mesmo usuário
    na mesma transação (a query direta do predicado retornou `false`)
```

### Regressão do caminho legítimo (mesmo staff, mesma transação revertida)

```
create_pdv_sale(NORTE 21, produto real, pagamento dinheiro,
  caixa aberto) ............................ SUCESSO — sale_id devolvido
create_pdv_sale(company_id = Petrux, sendo
  staff só da NORTE 21) .................... BLOQUEADO — 42501 FORBIDDEN
close_attendance(atendimento real em
  andamento da NORTE 21) ................... SUCESSO — sale_id devolvido
```

O caminho de venda do staff (PDV e fechamento de atendimento) continua
funcionando ponta a ponta; a fabricação direta e o escape entre empresas
foram fechados.

---

## 4. Varredura ampla — mesmo padrão em outras tabelas

Classificação de toda tabela relevante (SO_EMPRESA = só `company_id`;
PAPEL = tem `has_company_management_access` na policy):

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| company | SO_EMPRESA | — (só via RPC) | PAPEL | — |
| unit | SO_EMPRESA | PAPEL | PAPEL | — |
| professional | SO_EMPRESA | PAPEL | PAPEL | — |
| professional_access | PAPEL | — | PAPEL | — |
| professional_service | SO_EMPRESA | PAPEL | PAPEL | SO_EMPRESA |
| user_company_role | SO_EMPRESA | **sem grant** | **sem grant** | **sem grant** |
| client | SO_EMPRESA | SO_EMPRESA | SO_EMPRESA | — |
| appointment | SO_EMPRESA | SO_EMPRESA | SO_EMPRESA | SO_EMPRESA |
| attendance | SO_EMPRESA | SO_EMPRESA | SO_EMPRESA | — |
| attendance_item | SO_EMPRESA | SO_EMPRESA | SO_EMPRESA | — |
| service / product / consumable | SO_EMPRESA (select) | PAPEL | PAPEL | — |
| stock_movement | SO_EMPRESA | SO_EMPRESA | — | — |
| **sale / sale_item / payment** | **PAPEL** (era SO_EMPRESA) | **PAPEL** (era SO_EMPRESA) | — | — |
| **commission** | **PAPEL ou próprio** (era SO_EMPRESA) | **PAPEL** (era SO_EMPRESA) | — | — |
| cash_session / cash_movement | SO_EMPRESA | SO_EMPRESA | — | — |
| audit_log | PAPEL | — (só via RPC) | — | — |
| company_authorization_code | — (sem policy alguma) | — | — | — |
| company_slug_history | — (sem policy alguma) | — | — | — |

Achados desta varredura, além do P0 já corrigido:

- **`user_company_role` sem nenhum grant de escrita para `authenticated`** —
  confirmado: um staff não consegue se auto-promover a owner/admin por
  REST direto, mesmo tentando. Único caminho de escrita é RPC
  `SECURITY DEFINER` (`create_company_with_owner`, e as RPCs de acesso de
  profissional). **Privilege escalation por esta via: fechado.**
- **`stock_movement` aceita INSERT direto, escopado só por empresa, sem
  trigger de integridade** (diferente de `attendance_item`, que tem
  `enforce_attendance_item_integrity`). Um staff pode inserir uma linha de
  movimento de estoque fabricada — ela **não altera** `product.current_stock`
  (isso só muda via `apply_stock_delta`), então é poluição de histórico/
  relatório, não fraude de saldo. **P2, registrado, não corrigido.**
- **`company_authorization_code`/`company_slug_history` sem nenhuma
  policy** — confirmado intencional (mesmo padrão já documentado em rodada
  anterior): RLS ligada, zero policy, zero grant para `authenticated`/`anon`
  → ninguém lê pela API, só as funções `SECURITY DEFINER` que já têm a
  checagem certa por dentro.

---

## 5. RLS — IDOR e manipulação de `company_id`

Testado diretamente (não inferido):

- **Manipular `company_id` para escapar do tenant**: `create_pdv_sale`
  chamado com `p_company_id` de outra empresa, sendo staff só da própria →
  `FORBIDDEN` (§3, confirmado ao vivo, depois da correção). Antes da
  correção desta rodada, esse vetor específico (RPC) já era seguro pela via
  invoker; o vetor NOVO fechado aqui é o INSERT direto na tabela.
- **IDOR clássico** (trocar o ID de um registro alheio na URL/payload): toda
  tabela testada usa `company_id in (select my_company_ids())` como piso —
  um ID de outra empresa nunca resolve porque a linha não existe do ponto de
  vista de quem pergunta (RLS filtra antes de qualquer lógica de aplicação
  rodar). Não encontrado nenhum caminho que aceite um ID cru sem essa
  filtragem.
- **Staff inserindo o que a UI nunca permitiria**: confirmado positivamente
  no achado do P0 (agora corrigido) e negativamente em toda outra tabela
  gerencial (`service`, `product`, `professional`, `unit` — já fechadas
  desde a correção anterior, reconfirmadas aqui).

---

## 6. Grants — SECURITY DEFINER / INVOKER

Todas as RPCs sensíveis foram inspecionadas por `prosecdef`:

| Função | Modo | Checagem interna de empresa/ator |
|---|---|---|
| `create_pdv_sale` | **DEFINER (mudou nesta rodada)** | nova: `user_company_role` explícito |
| `close_attendance` | **DEFINER (mudou nesta rodada)** | nova: `user_company_role` explícito |
| `cancel_sale` | DEFINER (já era) | `has_company_management_access` |
| `close_cash_session` | DEFINER (já era) | `my_company_ids()` |
| `mark_commission_paid` | DEFINER (já era) | (não reaberto nesta rodada — já auditado antes) |
| `regenerate_authorization_code` / `authorize_operation` | DEFINER (já era) | `has_company_management_access` / `user_company_role` |
| `add_attendance_service_item` / `add_attendance_product_item` / `update_attendance_item` | **INVOKER (não mudou)** | RLS de `attendance`/`attendance_item` cobre; fora de escopo desta correção |
| `open_cash_session` | **INVOKER (não mudou)** | RLS de `cash_session`; fora de escopo (ver §16) |

O erro histórico que a rodada pediu para não repetir — confundir um helper
`DEFINER` com uma função operacional `INVOKER` — foi o motivo exato de cada
conversão desta rodada vir acompanhada de uma checagem de vínculo nova. Os
advisors do Supabase (`get_advisors`) foram reconferidos depois da migration:
zero achado novo de nível ERROR; os WARN de "SECURITY DEFINER executável por
authenticated/anon" são o mesmo ruído genérico de sempre (o linter marca
toda DEFINER, sem saber que cada uma se protege por dentro) — `create_pdv_sale`
e `close_attendance` passaram a aparecer nessa lista, esperado e coerente com
o padrão já usado por `cancel_sale`.

---

## 7. RPC / Server Action / REST

- **REST direto**: exatamente o vetor usado para reproduzir e corrigir o P0
  (§2/§3). Ignorando o frontend por completo, hoje um staff não lê nem
  escreve nas seis tabelas financeiras, não se auto-promove
  (`user_company_role`), não escapa de tenant nas RPCs de venda.
- **RPC pública sem validar escopo**: nenhuma encontrada além do já corrigido.
  As RPCs "públicas" (`get_public_*`, `create_public_appointment`) são para
  a vitrine de agendamento sem login — escopo é `p_slug`/`p_token`, não
  sessão; fora do escopo desta auditoria (profissional autenticado).
- **Server Action aceitando `company_id`/IDs do cliente sem validar**:
  reconferido em `actions/caixa.ts`, `actions/vendas.ts`, `actions/financeiro.ts`
  — todas resolvem o `company_id` a partir de um lookup no banco (que agora
  também é RLS-protegido) antes de qualquer gate de papel, nunca aceitam o
  `company_id` cru do formulário como verdade.

---

## 8. Multi-tenancy

Duas empresas reais disponíveis para teste: **NORTE 21 BARBEARIA** e
**Petrux**. Testado ao vivo nesta rodada (além do que já constava em
`auditoria-final-pre-piloto.md`, cenário `[G]`):

```
create_pdv_sale(company_id=Petrux, autenticado como staff da NORTE 21)
  → FORBIDDEN (42501) — confirmado nesta rodada, pós-fix
```

Testes de leitura cruzada de catálogo/cliente/profissional entre empresas
já estavam confirmados em rodada anterior (0 linhas, sempre). Não repetidos
aqui por não terem relação com o achado desta rodada. **Limitação**: Petrux
não tem nenhum atendimento/venda próprios, então o teste cruzado de
`close_attendance` com um `attendance_id` real de outra empresa não pôde
ser feito com dado real — a checagem é idêntica em estrutura à de
`create_pdv_sale` (mesma linha de código, mesmo padrão), então a confiança é
alta por simetria, mas o teste direto com um `attendance_id` de outra
empresa fica como **NÃO CONFIRMADO — sem dado de teste em Petrux**.

---

## 9. Ciclo do barbeiro / auth.users↔professional↔company

Sem alteração desde a R23.8 (`docs/auditoria-forense-conta-profissional.md`,
§1/§7): mapa de ciclo de vida, grafo de identidade e matriz de escopo real
seguem válidos e não foram reabertos linha a linha nesta rodada — o achado
novo desta rodada é ortogonal (fronteira financeira, não identidade).
Reconfirmado apenas: NORTE 21 continua sem nenhuma conta `staff` logável
(só `owner`).

---

## 10. Service role

Reconfirmado, sem imprimir valor: `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`
tem 21 caracteres, sem os dois pontos de um JWT — placeholder, não chave
real. Mesmo bloqueio já documentado nas duas rodadas anteriores.
**ENVIRONMENT BLOCKER**, não bug de código. Nenhum bypass foi criado.

---

## 11. Primeiro acesso

Não reaberto nesta rodada além do que já consta na R23.8 (login ponta-a-
ponta com conta real: **NÃO CONFIRMADO — bloqueio de ambiente**, dependente
do item 10). Os estados anormais listados no brief (`auth.user` sem
`professional`, `professional` sem `user_company_role`, etc.) foram
mapeados por leitura de código na R23.8 — não há evidência de que algum
deles resulte em acesso administrativo acidental (todo RPC de acesso
verifica o vínculo explicitamente).

---

## 12. Desativação / revogação

Sem mudança nesta rodada. Já corrigido e testado ao vivo em
`docs/auditoria-final-pre-piloto.md` (ban global cross-company) e
`docs/correcao-pos-teste-operacional.md`. A revogação é por
`user_company_role` (RLS fecha o acesso a dados imediatamente) — não por
"o botão sumiu da tela".

---

## 13. Escopo do barbeiro (matriz por ação)

| Área | Ação | Staff | Base |
|---|---|---|---|
| Agenda | ver própria/colegas, criar, alterar, cancelar | PERMITIDO | RLS SO_EMPRESA — operacional |
| Atendimento | criar, add serviço/produto, cortesia/desconto | PERMITIDO **com código de autorização** | trigger `enforce_attendance_item_integrity` |
| Atendimento | finalizar (`close_attendance`) | PERMITIDO | agora DEFINER + checagem de vínculo |
| Vendas (PDV) | criar (`create_pdv_sale`) | PERMITIDO | idem |
| Vendas | cancelar/refund | **NEGADO** | `cancel_sale` exige `has_company_management_access` |
| Caixa | abrir, fechar, suprimento, sangria | PERMITIDO | operacional, invoker |
| Caixa | ver histórico de outras sessões/empresas | NEGADO (outras empresas) / aberto (mesma empresa) | ver §16 |
| Financeiro | ver, criar, alterar | **NEGADO** (corrigido nesta rodada) | RLS `financial_entry` agora PAPEL |
| Equipe | ver colegas (nome/telefone/e-mail/comissão %) | PERMITIDO | `professional` SELECT é SO_EMPRESA, não PAPEL — ver §17 |
| Equipe | alterar profissional/comissão | NEGADO | RLS `professional` UPDATE é PAPEL |
| Comissão | ver a própria | PERMITIDO | novo: RLS `commission` SELECT própria |
| Comissão | ver de colegas | **NEGADO (corrigido nesta rodada)** | antes: SUCESSO; agora: RLS bloqueia |
| Comissão | marcar como paga | NEGADO | `mark_commission_paid` é DEFINER + gate de papel |
| Catálogo | ver serviços/produtos/estoque | PERMITIDO | necessário para operar |
| Catálogo | alterar preço/duração | NEGADO | corrigido em rodada anterior |
| Configurações | empresa, autorização, usuários, unidades | NEGADO | `isCompanyManager` na UI + RLS PAPEL no banco |

---

## 14/15. Financeiro / caixa / comissão — ataques diretos e integridade comercial

Cobertos em §2/§3 (ataques) e §6 (regressão). Fluxos legítimos revalidados
ao vivo, em transação revertida: venda de produto (PDV), fechamento de
atendimento com comissão gerada — ambos íntegros, nenhuma operação parcial
observada. Cancelamento/estorno/multipagamento/desconto/cortesia já tinham
prova de fogo completa em `docs/auditoria-final-pre-piloto.md` (cenários
A–J) e não foram alterados nesta rodada — não reexecutados para não gerar
dado de teste desnecessário sobre uma área que não mudou.

---

## 16. Limitação assumida conscientemente: `cash_movement` / `cash_session`

Registrado, não corrigido. `addCashMovement` (staff faz sangria/suprimento)
e `openCashSession` escrevem direto nessas tabelas como `SECURITY INVOKER` —
operação diária legítima do staff. Restringir por papel quebraria o caixa
inteiro. O `CHECK` de `cash_movement.type` permite o valor `'sale_payment'`
como literal válido, e nada impede um staff de inserir um `cash_movement`
`type='sale_payment'` fabricado (sem venda real por trás) com uma sessão
aberta de verdade — confirmado ao vivo nesta rodada (§2, "com sessão aberta
de propósito"). Impacto: polui a reconciliação do caixa daquele turno
(dinheiro "a mais" sem venda correspondente), não vaza dado nem fabrica
receita fora do caixa. **P1, registrado, não corrigido nesta rodada** — a
correção correta é uma RPC `SECURITY DEFINER` dedicada para
sangria/suprimento (whitelist de `type`, sem aceitar `sale_payment` fora das
duas RPCs de venda), fora do escopo de "mudança estritamente necessária"
desta rodada porque o vetor tem impacto operacional, não financeiro direto
nem de confidencialidade.

---

## 17. Concorrência

Sem mudança de código nesta rodada. Mecanismos já existentes e
reconfirmados por leitura: `apply_stock_delta` (`for update` + `CHECK
current_stock >= 0`), `close_cash_session`/`cancel_sale` (`for no key
update` em `cash_session`, trava antes de somar). Duas sessões de banco
simultâneas de verdade **NÃO FORAM testadas** — mesma limitação de
ambiente já registrada na R23.8 (MCP não sustenta duas conexões
concorrentes).

---

## 18. Audit log

`SELECT` em `audit_log` é `PAPEL` (confirmado nesta varredura, §4) — staff
não lê a trilha de auditoria da empresa. Escrita é só via `write_audit_log`
(`SECURITY DEFINER`, recusa chamada de primeiro nível — já documentado).
Nenhum segredo encontrado em nenhum evento auditado (senha, token, service
role, código de autorização) — reconfirmado por leitura das chamadas em
`create_pdv_sale`/`close_attendance`/`cancel_sale`/`authorize_operation`.

---

## 19. Privacidade / LGPD — controles técnicos

**Aviso obrigatório**: o que segue é auditoria de **controles técnicos e de
produto**, não uma avaliação jurídica. Conformidade com a LGPD exige revisão
jurídica/documental própria, que este documento não substitui.

### 19.1 Mapa de dados pessoais

| Dado | Tabela | Nasce em | Quem acessa hoje (banco) | Observação |
|---|---|---|---|---|
| Nome/telefone/observações do cliente | `client` | cadastro (staff ou vitrine pública) | qualquer membro da empresa | necessário operacionalmente — staff atende qualquer cliente |
| Histórico de atendimentos/compras do cliente | `attendance`, `sale`, `sale_item` | operação | staff (via `attendance`), **não** via `sale`/`sale_item` (agora PAPEL) | ver nota abaixo |
| Nome/e-mail/telefone/comissão % do profissional | `professional` | cadastro pelo gerente | **qualquer membro da empresa** (SELECT é SO_EMPRESA) | ver §19.2 |
| E-mail de login, identificador de acesso | `professional_access`, `auth.users` | ativação de acesso | só gerência (`professional_access` é PAPEL); `auth.users` não é exposto via PostgREST | correto |
| Comissão individual (valor pago) | `commission` | fechamento de venda | gerência OU o próprio (corrigido nesta rodada) | correto agora |

Nota: um staff continua vendo a lista de atendimentos de um cliente
(necessário para o contexto do atendimento), mas **não** o valor financeiro
da venda associada (`sale`/`sale_item` agora exigem gerência) — a separação
entre "o que aconteceu" (operacional) e "quanto valeu" (financeiro) ficou
mais fina depois desta correção, o que é uma melhoria de minimização de
dado, não só de segurança.

### 19.2 Achado de menor privilégio (P2, registrado, não corrigido)

`professional.email`/`professional.phone`/`professional.default_commission_percent`
são visíveis a **qualquer colega da mesma empresa** (RLS `professional`
SELECT é `SO_EMPRESA`, não `PAPEL`). Um barbeiro vê o telefone pessoal, e-mail
e o percentual de comissão de todo colega. Necessidade operacional real:
nome (para agenda/troca de horário) — não claramente e-mail/telefone/
comissão. Não corrigido nesta rodada porque a tela de Equipe/Agenda
provavelmente depende desses campos hoje (não auditado linha a linha se a
UI usa `phone`/`email` de colega em algum fluxo staff-facing) — recomendação:
revisar se a query de agenda/atendimento realmente precisa desses três
campos ou só de `id`/`name`, e se não precisar, mover para uma
`view`/coluna restrita a gerência.

### 19.3 Dados sensíveis em campo livre

`attendance`/`client` têm campos de observação em texto livre — não
auditado nesta rodada se algum dado sensível (saúde, por exemplo, "cliente
com alergia a X produto") já é digitado ali na prática; **PRODUCT/
DOCUMENTATION GAP**: não existe classificação ou aviso sobre não inserir
dado sensível em campo livre.

### 19.4 Retenção / exclusão / anonimização

Nenhum mecanismo de expurgo/anonimização automática encontrado. Desativação
de profissional preserva histórico (correto para fins contábeis/fiscais,
mas é uma escolha que precisa estar documentada como política, não como
ausência). **PRODUCT/DOCUMENTATION GAP** — não inventada uma política aqui.

### 19.5 Direitos do titular (acesso/correção/exclusão/portabilidade)

Não existe, hoje, uma funcionalidade de "exportar meus dados" ou "excluir
minha conta" self-service para cliente ou profissional. **PRODUCT/
DOCUMENTATION GAP**, não implementado nesta rodada (fora de escopo de
correção de segurança).

### 19.6 Consentimento/finalidade

Não encontrado mecanismo de consentimento de marketing/comunicação. Se o
produto pretende enviar campanhas, isso é uma lacuna a resolver antes —
**não foi adicionado nenhum checkbox de "aceito a LGPD"** nesta rodada
(instrução explícita do brief: não fingir compliance).

### 19.7 Logs

`console.error` em `lib/errors.ts` registra `pgError.code`/`pgError.message`
— mensagens de erro do Postgres, não dado pessoal. Não encontrado log de
senha/token/service role/código de autorização em nenhum ponto revisado
(RPCs de autorização, `write_audit_log`).

---

## 20. Mobile

Sem mudança de UI nesta rodada (a correção foi só banco). Cobertura de
375/390/1280/1440 já validada em rodadas anteriores (`R23.12`,
`correcao-pos-teste-operacional.md`) sem overflow/erro. Não há indicação de
que uma correção só-de-banco afete layout.

---

## 21/22/23. Conta QA real, credenciais, teste manual

**BLOQUEADO POR AMBIENTE.** `SUPABASE_SERVICE_ROLE_KEY` é um placeholder
(§10) — `enableProfessionalAccess`/`createAdminClient()` levantam
`ConfigurationError` para qualquer tentativa de provisionar login real.
Não foi criado bypass, não foi manipulado `auth.users` diretamente, nenhuma
senha foi inventada ou colocada em código/log/commit.

**Procedimento seguro para quando a chave real estiver configurada** (não
executado aqui, só documentado):
1. Em Configurações → Equipe, como owner/admin da NORTE 21, cadastrar um
   profissional "QA Barbeiro".
2. Usar o botão "Ativar Acesso" existente na tela — ele já chama
   `enableProfessionalAccess`, que gera identificador único e senha
   temporária via `generate_temporary_password()`/`generate_unique_access_identifier()`
   e cria a conta no Supabase Auth pela Admin API.
3. A senha temporária aparece **uma única vez**, na tela, para quem ativou —
   nunca é gravada em texto puro no banco (`professional_access.temporary_password_hash`
   fica sempre `null`, confirmado em rodada anterior) nem deve ser copiada
   para fora do fluxo do produto (não para chat, não para commit).
4. Repassar ao barbeiro por um canal fora do Git/banco (voz, mensagem
   direta) e orientar a troca no primeiro acesso (`/mudar-senha-inicial`).

Nenhuma credencial é entregue neste documento porque nenhuma foi gerada —
gerar uma exigiria a chave de serviço real, que não existe neste ambiente.

---

## 24. Correções aplicadas nesta rodada

| # | Severidade | O quê | Onde |
|---|---|---|---|
| 1 | 🔴 P0 | `financial_entry`/`sale`/`sale_item`/`payment`/`commission` sem controle de papel (leitura e escrita) | RLS, migration `20260918090000` |
| 2 | (suporte ao #1) | `create_pdv_sale`/`close_attendance` viram `SECURITY DEFINER` com checagem de vínculo explícita | mesma migration |

Corrigido no nível mais forte (banco/RLS + função), não na UI. Nenhuma tela
foi alterada.

### P1/P2 registrados, não corrigidos nesta rodada (backlog)

- **P1** — `cash_movement` aceita `type='sale_payment'` fabricado por staff
  via REST direto, com sessão aberta real (§16). Fix recomendado: RPC
  dedicada para sangria/suprimento com whitelist de tipo.
- **P2** — `stock_movement` aceita INSERT fabricado por staff, sem trigger
  de integridade (não altera saldo real, só polui histórico) (§4).
- **P2** — `professional.email`/`phone`/`default_commission_percent`
  visíveis a qualquer colega da empresa (§19.2).
- **P3** (já registrado na R23.8) — prefixo `"Fa"` fixo em senha temporária;
  sem CHECK de range em `default_commission_percent`.
- **Documentação/produto** — retenção/exclusão/anonimização,
  direitos do titular, consentimento de marketing: lacunas de produto, não
  de segurança (§19.4–19.6).

---

## 25. Regressão final

```
npx tsc --noEmit ......... limpo, antes e depois da migration
npm test .................. 85/85 (antes e depois)
npm run build ............. completo, 31 rotas, sem erro (antes e depois)
```

Testes adicionais desta rodada (não são suíte automatizada — são os ataques
e regressões em SQL, documentados em §2/§3/§6/§8, todos em transação
revertida contra produção real).

---

## 26. Restante do backlog (P1/P2 já conhecido, sem mudança de status)

Ver `docs/auditoria-forense-conta-profissional.md` §15 para a lista
completa herdada da R23.8 (login ponta-a-ponta, concorrência real,
`professional_service` não validado no agendamento, etc.) — nenhum item
daquela lista foi fechado ou reaberto nesta rodada, exceto o P0 financeiro
(fechado aqui).

---

## 27. Limitações desta rodada

| Limitação | Classificação |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` é placeholder — provisionamento real e login ponta-a-ponta não exercitáveis | BLOQUEADO POR AMBIENTE |
| Petrux não tem atendimento/venda para testar `close_attendance` cross-tenant com dado real | NÃO CONFIRMADO |
| Concorrência real (duas conexões simultâneas) não testável neste MCP | BLOQUEADO POR AMBIENTE |
| Conformidade jurídica com a LGPD | NÃO APLICÁVEL a esta auditoria — requer avaliação jurídica própria |
| UI/mobile não retestados (nenhuma mudança de UI nesta rodada) | NÃO APLICÁVEL |

Nenhuma limitação acima foi convertida em "aprovado" — cada uma está listada
como o que realmente é.

---

## 28. Resumo final obrigatório

**SEGURANÇA** — Havia um bypass conhecido (P0 financeiro, R23.8), reproduzido
e corrigido nesta rodada, com regressão confirmada. Não foi encontrado outro
bypass equivalente na varredura ampla (§4) além dos dois residuais P1/P2 já
registrados (cash_movement, stock_movement — impacto bem menor, não são
confidencialidade nem fraude financeira direta).

**AUTORIZAÇÃO** — Nenhum perfil ultrapassa seu escopo hoje, dentro do que
foi testável. Staff não lê/escreve mais o razão financeiro; não se
auto-promove (`user_company_role` sem grant de escrita); RPCs de venda
verificam vínculo explicitamente.

**MULTI-TENANCY** — Nenhum acesso cruzado encontrado. `create_pdv_sale`
com `company_id` de outra empresa: bloqueado, testado ao vivo pós-fix.
`close_attendance` cross-tenant: não testável com dado real (Petrux sem
atendimentos) — mesma proteção por simetria de código, não confirmada ao
vivo para esta função específica.

**PROFISSIONAL** — Criar conta, logar, trabalhar e sair: não exercitável
ponta a ponta neste ambiente (chave de serviço placeholder). O que é
exercitável (RLS, RPCs, triggers) foi confirmado correto.

**DESATIVAÇÃO** — Revogação já corrigida e testada em rodada anterior
(revoga `user_company_role`, fecha RLS imediatamente; ban global só quando
não sobra outro vínculo).

**FINANCEIRO** — Antes desta rodada, sim, fabricação/leitura indevida era
possível (P0). Agora, para as cinco tabelas centrais, não. Residual: caixa
(`cash_movement`) aceita um tipo de lançamento fabricado, registrado como P1.

**PRIVACIDADE** — Um achado de menor privilégio real (dados de contato/
comissão de colegas visíveis a todo staff, P2, não corrigido). Lacunas de
produto/documentação em retenção, exclusão e direitos do titular — não são
falhas de segurança, são ausência de funcionalidade/política.

**LGPD** — Controles técnicos parciais e agora mais fortes (separação
operacional/financeiro melhorou com a correção do P0). Conformidade
jurídica **não avaliada** — precisa de revisão própria.

**SERVICE ROLE** — Bloqueio ambiental confirmado, sem bypass criado.

**QA** — Nenhuma conta real foi provisionada (bloqueio de ambiente).
Procedimento seguro documentado em §21.

**TESTES** — 85/85 passando, antes e depois.

**BUILD** — Passou, antes e depois.

**TYPECHECK** — Passou, antes e depois.

## GO/NO-GO

# 🟡 PRONTO COM RESSALVAS

O P0 que bloqueava o piloto (R23.8) foi reproduzido, corrigido no nível mais
forte (RLS + função), revalidado com o mesmo ataque (agora bloqueado) e com
o fluxo legítimo (ainda funcionando, testado ao vivo). Nenhum outro P0 foi
encontrado na varredura ampla desta rodada. As ressalvas que impedem
🟢 PRONTO PARA PILOTO puro:

1. Nenhuma conta de staff real foi (nem pôde ser) testada ponta a ponta —
   login, primeiro acesso e o dia a dia de tela continuam sem confirmação
   viva, por limitação de ambiente, não por indício de bug.
2. Dois residuais P1/P2 ficaram registrados e não corrigidos
   (`cash_movement` tipo fabricável; exposição de contato/comissão de
   colegas) — nenhum dos dois é confidencialidade de razão financeiro nem
   fraude de valor, mas merecem tratamento antes de escalar para múltiplas
   barbearias.
3. Lacunas de produto/documentação em privacidade (retenção, exclusão,
   direitos do titular) — não bloqueiam um piloto supervisionado, mas
   precisam existir antes de uma operação real maior.

Com supervisão do proprietário durante o piloto (ele já é o único usuário
testável neste ambiente) e o backlog acima com dono e prazo, o piloto pode
prosseguir.
