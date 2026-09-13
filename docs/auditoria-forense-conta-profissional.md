# FADE.OS / CORTEX.OS — Auditoria forense: conta do profissional (barbeiro)

Modo: auditoria. Nenhuma linha de código, migration, permissão ou dado foi
alterada nesta rodada — cada achado abaixo foi **registrado**, nunca corrigido.
Onde uma correção já existe no histórico do projeto (rodadas anteriores,
documentadas em `docs/auditoria-final-pre-piloto.md` e
`docs/correcao-pos-teste-operacional.md`), ela é citada como evidência, não
repetida como se fosse nova.

Método: inspeção direta do banco de produção real (`xaxszgyvapvzwensbjjq`) —
`pg_policies`, `information_schema.role_table_grants`, corpo de funções e
triggers via `pg_get_functiondef`/`execute_sql` — só leitura de metadados,
mais leitura integral do código-fonte (`actions/`, `lib/`, `components/`,
migrations). Nenhuma linha de dado foi lida, alterada ou inserida. Todo achado
tem a query ou o arquivo:linha que o sustenta.

Toda vez que uma confirmação exigiria uma conta de barbeiro (`staff`) de
verdade logando pelo navegador, ou uma segunda sessão de banco simultânea, e
essas coisas não existem neste ambiente (ver §3), o item está marcado
**NÃO CONFIRMADO — limitação de ambiente**, nunca convertido silenciosamente
em "funciona" ou "está quebrado". Esta rodada não cria a conta de teste que
resolveria isso: rodadas anteriores deste mesmo projeto já haviam criado uma
conta assim, com o rótulo explícito de "workaround"; a instrução desta rodada
foi mais estrita ("NÃO CRIE WORKAROUND"), então a verificação aqui é por
inspeção de RLS/trigger/RPC no banco real — mais autoritativa que um clique de
UI para a pergunta "o banco impede?", mas não substitui um teste de tela.

---

## 1. Mapa do ciclo de vida do profissional

| Etapa | Onde vive | Evidência |
|---|---|---|
| Cadastro | `actions/profissionais.ts::createProfessionalRecord` | Zod (`professionalSchema`, reuso create/update) + `requireCompanyManager` |
| Vínculo com a empresa | `professional.company_id`, `professional.unit_id` | FK, sem UNIQUE em nome/e-mail/telefone (homônimos por design) |
| Vínculo com `auth.users` | `actions/profissional-acesso.ts::enableProfessionalAccess` → `syncAuthUser` | Supabase Auth Admin API, requer `SUPABASE_SERVICE_ROLE_KEY` |
| Credenciais | `professional_access.access_identifier` + `auth.users.encrypted_password` | `generate_temporary_password()`, `generate_unique_access_identifier()` (SQL) |
| Login | `/login`, `actions/auth.ts` (não lido linha a linha nesta rodada; ver §6) | Supabase Auth |
| Sessão | middleware Next.js + cookies do Supabase | Padrão do SDK, não teve migration própria auditada aqui |
| Autorização | `lib/permissions.ts` (`requireCompanyManager`, `requireOwnProfessionalOrManager`, `isManagerRole`) | Camada de aplicação — ver §7 sobre o espelho no banco |
| Escopo | `components/app-nav.tsx::SCOPE_ALLOWED_HREFS` (UI) + RLS por tabela (banco) | Ver matriz §7 |
| Agenda | `actions/agenda.ts`, `actions/disponibilidade.ts` | Não encontrado grep de `professional_service` em nenhum dos dois — ver achado §8 |
| Atendimento | `actions/atendimento.ts` + trigger `enforce_attendance_item_integrity` | Migration `20260912090000` — ver §4 |
| Venda | `actions/pdv.ts` + RPC `create_pdv_sale` | Mesma trigger acima cobre `attendance_item`; `sale`/`sale_item` diretos não têm trigger equivalente — ver §5 (achado novo) |
| Comissão | `commission` (tabela) + `mark_commission_paid` (RPC) | Ver §5 |
| Histórico | `sale`, `attendance`, `commission`, `financial_entry` — sem soft-delete próprio | Sem trigger de purga encontrado |
| Desativação | `disableProfessionalAccess` | Revoga `user_company_role`; bane no Auth só se não sobrar outro vínculo ativo (fix já documentado, `auditoria-final-pre-piloto.md`, P1 "ban global") |

---

## 2. `auth.users` / `SUPABASE_SERVICE_ROLE_KEY` — ambiente

Confirmado (sem imprimir o valor): `.env.local` tem
`SUPABASE_SERVICE_ROLE_KEY` com 21 caracteres, sem os dois pontos que um JWT
tem — é um placeholder, não uma chave real. `createAdminClient()` levanta
`ConfigurationError` diante disso (já documentado e testado em
`correcao-pos-teste-operacional.md`, P1 #3 "Ativação de acesso presa"), e
`friendlyMessage` traduz para uma mensagem sem detalhe de ambiente.

**Consequência para esta auditoria:** todo o caminho de PROVISIONAMENTO real
(criar a conta no Auth, primeiro login, troca de senha) está bloqueado neste
ambiente por configuração, não por bug. **NÃO CONFIRMADO — limitação de
ambiente**, com a ressalva de que o caminho de FALHA desse mesmo fluxo já foi
exercitado a fundo e corrigido (rollback de estado órfão, mensagem amigável) —
ver `correcao-pos-teste-operacional.md`.

Também confirmado nesta rodada: NORTE 21 BARBEARIA (empresa de QA) hoje só tem
conta `owner` — nenhum `staff` logável existe. Consistente com o item acima.

---

## 3. Validação de cadastro — paridade frontend/backend

`actions/profissionais.ts` + `lib/catalogo.ts`:

| Regra | Frontend (Zod) | Backend (banco) | Observação |
|---|---|---|---|
| Nome (tamanho) | `nomePessoaSchema` | nenhuma | Sem CHECK |
| Duplicata de nome/e-mail/telefone | permitida | permitida | Por desenho — mesmo padrão de `rotularHomonimos` usado em Clientes |
| Comissão 0–100% | `comissaoOpcionalSchema` | nenhuma | Sem CHECK em `default_commission_percent` |
| create/update usam o mesmo schema | sim | — | Paridade confirmada — não existe validação mais fraca no update |
| Papel de quem cria/edita | — | `requireCompanyManager` (Server Action) + RLS com `has_company_management_access` (banco) | **Duas camadas reais**, não só uma |

**Achado (P3, cosmético):** `default_commission_percent` aceita qualquer
número por REST direto (sem CHECK) — a validação 0–100% só existe em Zod. Não
é explorável para dano financeiro por si (a comissão em si é só um percentual
armazenado; o valor pago depende de `commission.amount`, calculado em
`close_attendance`/`create_pdv_sale`), mas é uma lacuna de robustez: um valor
como `-999` ou `99999` gravado direto por REST ficaria salvo sem erro.

---

## 4. Discurso do desconto/cortesia — mecanismo completo (confirmado)

Localizado nesta rodada: `actions/configuracoes.ts` + migration
`20260912090000_authorization_code_and_item_integrity.sql`.

- Um código por empresa (8 chars, alfabeto sem O/0 I/1 S/5), gerado por
  `regenerate_authorization_code` (só owner/admin), guardado **só como hash
  bcrypt** — sem policy de leitura, sem grant para `authenticated`.
- `authorize_operation(company_id, code, operation)`: exige vínculo real com
  a empresa (`user_company_role`), confere o hash, e marca a transação atual
  com `set_config('fade.authorized_operation', 'operation:company_id', true)`
  — **escopo de transação** (`is_local = true`), não de sessão. Isso significa
  que autorizar e escrever precisam acontecer na mesma chamada RPC; por isso
  `add_attendance_service_item`/`add_attendance_product_item`/
  `update_attendance_item` chamam `authorize_operation` e fazem o `insert`/
  `update` dentro da mesma função. Um `authorize_operation` isolado, seguido de
  um `INSERT` solto em outra requisição, **não funcionaria** (nova transação,
  sem a marca) — não é uma falha, é a garantia funcionando como desenhado.
- `assert_operation_authorized`: owner/admin passam pelo próprio papel;
  qualquer outro precisa da marca de transação exata.
- O código nunca é logado — `write_audit_log` grava só `authorized_at`, nunca
  o valor apresentado (confirmado por leitura do código; también já testado
  ao vivo em `auditoria-final-pre-piloto.md`, item `[G]`).
- **P3 observado, não achado de segurança:** não há rate-limit dedicado em
  `authorize_operation` além do custo do bcrypt e do espaço de busca
  (31^8 ≈ 8,5×10¹¹). Online, força bruta não é viável, mas nada impede um
  script tentando repetidamente — recomendável (não implementado aqui) um
  limite de tentativas por usuário/período.

**Confirmado, live, em `docs/auditoria-final-pre-piloto.md`:** desconto/
cortesia sem código bloqueados, código de empresa errada bloqueado, código
"discount" não autoriza cortesia, rotação de código invalida o anterior na
hora, staff não regenera código.

---

## 5. Achado novo — P0: dados financeiros sem controle de papel no banco

RLS multiempresa (`company_id IN my_company_ids()`) está corretamente aplicado
em toda tabela financeira. **Controle de PAPEL** (owner/admin vs. staff), que
existe para `professional`/`professional_access`/`professional_service`
(via `has_company_management_access`) e — depois da correção documentada em
`correcao-pos-teste-operacional.md` P0 #1 — para `company`, `unit`, `service`,
`product`, `professional_schedule`, `payment_method` etc., **não existe** para:

`financial_entry`, `commission`, `sale`, `sale_item`, `cash_movement`,
`cash_session`.

Confirmado nesta rodada, contra o banco real, com duas queries independentes:

```sql
-- pg_policies: SELECT e INSERT das seis tabelas usam só company_id
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('financial_entry','commission','sale','sale_item','cash_movement','cash_session');
-- resultado: toda policy (select/insert) tem qual/with_check =
--   "company_id IN (SELECT my_company_ids())" — nenhuma menciona role/papel.

-- information_schema.role_table_grants: authenticated tem SELECT e INSERT
-- diretos nas seis tabelas (sem UPDATE/DELETE, que foram revogados na
-- correção P1 "razão financeiro editável" já documentada).
```

**O que isso permite hoje, por REST direto, para qualquer `staff` autenticado
da empresa** (sem passar pelo app, sem ativar `isCompanyManager`):

1. **Confidencialidade:** ler o razão financeiro inteiro da empresa —
   toda venda, todo item de venda, toda `commission` de todos os colegas
   (não só a própria), todo `cash_movement`/`cash_session` de qualquer
   operador. Isto contradiz o desenho já documentado no próprio código —
   `lib/permissions.ts` comenta explicitamente "esconder o link na navegação
   não protege nada", reconhecendo que a Server Action/RLS é a fronteira
   real; aqui a fronteira real simplesmente não existe para leitura.
2. **Integridade:** inserir linhas em `sale`, `sale_item`, `commission` e
   `financial_entry` diretamente, sem passar por `create_pdv_sale` ou
   `close_attendance` — essas tabelas **não têm** um trigger equivalente ao
   `enforce_attendance_item_integrity` que existe só para `attendance_item`.
   `cash_movement` tem uma trava parcial (migration `20260915090000`: exige
   `cash_session` aberta e da mesma empresa, via
   `assert_cash_movement_session_open`), mas não valida o *valor* nem o
   *tipo* da entrada — um staff pode inserir um `cash_movement` do tipo
   `suprimento` ou `other_in` fabricado, com qualquer valor, contanto que
   aponte para uma sessão aberta da própria empresa.

**Classificação:** P0 (segurança) — vazamento de dado sensível (folha de
comissão de terceiros, faturamento completo) e corrupção financeira potencial
por caminho que contorna toda a aplicação, exatamente o padrão que o P0-1
original (`enforce_attendance_item_integrity`) foi desenhado para fechar,
mas que não foi estendido às tabelas financeiras propriamente ditas.

**Status:** 🔴 CONFIRMADO (evidência de banco real, não inferência de código).
**Corrigido nesta rodada:** não — instrução explícita "não implemente nada".

---

## 6. Login / primeiro acesso / sessão

`actions/auth.ts` e o fluxo de `/login` não foram lidos linha a linha nesta
rodada (orçamento da auditoria priorizou o eixo financeiro/autorização, que é
onde o achado novo apareceu). O que está confirmado por evidência indireta:

- `changeProfessionalPassword` (em `actions/profissional-acesso.ts`, lido
  integralmente em rodada anterior desta mesma auditoria) existe e é o
  caminho de troca de senha no primeiro acesso.
- `/mudar-senha-inicial` existe como rota estática (visto no build, seção 10).
- Login ponta-a-ponta com conta de barbeiro real: **NÃO CONFIRMADO —
  limitação de ambiente** (§2/§3).

Edge cases de login (senha errada, e-mail inexistente, conta desativada,
"esqueci a senha", expiração de sessão, aba dupla) **não foram exercitados**
nesta rodada — ficam como lacuna explícita, não como "confirmado que
funciona".

---

## 7. Grafo de identidade e matriz de escopo real

Papéis que **existem no banco**: `owner`, `admin`, `staff` (tabela `role`).
Qualquer termo como "gerente", "recepção", "barbeiro" usado neste documento ou
no produto é categoria de **frontend/negócio**, derivada desses três papéis —
nunca um papel de banco à parte. `isManagerRole` (`lib/permissions.ts`) trata
`owner` e `admin` como "gerente"; `staff` é sempre a categoria operacional.

| Tela | Ver (staff) | Criar/editar (staff) | Financeiro/comissão de outros | Precisa autorização |
|---|---|---|---|---|
| Início | sim | — | não (dashboard usa métricas agregadas, gate de página) | — |
| Agenda | sim | sim (próprios atendimentos) | não | — |
| Atendimento | sim | sim | não visível na UI | desconto/cortesia → código |
| Nova Venda (PDV) | sim | sim | não visível na UI | desconto/cortesia → código |
| Clientes | sim | sim | — | — |
| Catálogo (serviços/produtos) | leitura (para operar) | **não** (`ACESSO_ADMINISTRATIVO_NECESSARIO` no banco) | — | gerente |
| Equipe/Comissões | próprio contexto (UI) | **não** | **UI oculta, banco NÃO restringe leitura** (§5) | gerente |
| Caixa | abre/fecha/movimenta | sim | — | fechamento usa `close_cash_session` (SECURITY DEFINER, só checa empresa) |
| Financeiro | **UI oculta (`isCompanyManager`)** | — | **banco permite SELECT/INSERT direto** (§5) | gerente na UI, não no banco |
| Configurações | **UI oculta** | — | — | gerente |

A coluna "Financeiro/comissão de outros" é o achado do §5 materializado por
tela: a UI esconde corretamente, o banco não reforça.

---

## 8. Agenda — profissional × serviço na reserva

Nem `actions/agenda.ts` nem `actions/disponibilidade.ts` referenciam
`professional_service` (grep sem resultado). A validação profissional × serviço
confirmada nesta auditoria (§ anterior, trigger
`enforce_attendance_item_integrity`) vale para o **atendimento** (quando o
item é lançado), não para o **agendamento** (quando o horário é reservado).

**Leitura, não confirmada com teste vivo:** é possível marcar um agendamento
de um serviço que o profissional escolhido não executa
(`professional_service` sem vínculo) — a rejeição só acontece depois, ao
tentar lançar o item no atendimento. Isso é uma inconsistência de UX/dado
(P2) mais que uma falha de segurança: nenhum dinheiro ou dado sensível está
em jogo num agendamento inválido, e o atendimento real continua protegido.
**NÃO CONFIRMADO ao vivo** (exigiria criar um agendamento de teste) —
registrado como leitura de código.

---

## 9. Multi-tenancy — classificação P0–P3

Toda a bateria abaixo já está **CONFIRMADA ao vivo**, contra produção, em
`docs/auditoria-final-pre-piloto.md` (cenário `[G] cross-company`):

| Vetor | Resultado medido | Severidade se tivesse falhado |
|---|---|---|
| Leitura de produto/serviço/cliente/profissional de outra empresa | 0 linhas | P0 |
| Produto/serviço/profissional de empresa B usado em atendimento de A | rejeitado (`PRODUTO_INVALIDO`/`SERVICO_INVALIDO`) | P0 |
| Venda em unidade de empresa B | `UNIDADE_INVALIDA` | P0 |
| `adjust_stock` em empresa B | `FORBIDDEN` | P0 |
| Código de autorização de empresa B | `FORBIDDEN` | P0 |
| Slug de empresa B | `FORBIDDEN` | P1 |
| `UPDATE` direto em produto de empresa B | 0 linhas | P0 |

**Não coberto por esse teste anterior nem por este (achado novo do §5):**
leitura cross-tenant não foi o problema — o problema é leitura *cross-role
dentro da mesma empresa*, algo que o teste `[G]` (focado em isolamento entre
empresas) não foi desenhado para pegar. Os dois achados são independentes.

---

## 10. Desativação, exclusão física, concorrência

- **Desativação:** `disableProfessionalAccess` revoga `user_company_role` e só
  bane globalmente no Auth se não sobrar vínculo ativo em outra empresa — fix
  e teste já documentados (`auditoria-final-pre-piloto.md`, P1 "ban global").
- **Exclusão física:** nenhum caminho de `DELETE FROM professional` ou
  equivalente encontrado (grep sem correspondência de exclusão física de
  profissional nesta base). O ciclo de vida é desativar (`active=false` +
  revogar acesso), nunca apagar. `professional.company_id` cascateia só na
  exclusão da própria empresa. **Achado positivo**, não pendência.
- **Concorrência:** `apply_stock_delta` usa `for update` + `CHECK
  (current_stock >= 0)`; `close_cash_session`/`cancel_sale` usam `for no key
  update` sobre `cash_session` (migration `20260915090000`, lida nesta
  rodada) — trava tomada **antes** de somar os movimentos, o que corrige a
  janela de corrida que a própria migration documenta ter existido. Duas
  sessões de banco simultâneas de verdade **NÃO FORAM testadas nesta nem em
  rodada anterior** — o ambiente (MCP) não sustenta duas conexões
  concorrentes nem tem credencial de banco direta. **NÃO CONFIRMADO —
  limitação de ambiente**, com o que sustenta a garantia (lock + CHECK)
  identificado e citado.

---

## 11. Mensagens de erro

`lib/errors.ts::friendlyMessage`: mapeia por `DOMAIN_MESSAGES`/`CODE_MESSAGES`
conhecidos; RLS (`row-level security` na mensagem) vira "Você não tem
permissão para fazer isso."; falha de configuração (chave de serviço) vira
mensagem sem detalhe de ambiente; qualquer erro não mapeado cai no
`GENERIC_MESSAGE`. Não encontrado nenhum caminho que devolva `pgError.message`
cru ao usuário final. **CONFIRMADO por leitura de código.**

---

## 12. Trilha de auditoria (`audit_log`)

`INSERT`/`UPDATE`/`DELETE` diretos foram revogados de `authenticated`;
`write_audit_log` é `SECURITY DEFINER`, deriva o ator de `auth.uid()` e
**recusa ser chamada como RPC de primeiro nível** (só de dentro de outra
função PL/pgSQL) — já testado e documentado
(`correcao-pos-teste-operacional.md`, P1 #5). Confirmado nesta rodada, por
leitura de todo ponto que grava no log (`authorize_operation`,
`regenerate_authorization_code`, `close_cash_session`, `cancel_sale`): nenhum
grava senha, token, service role ou o código de autorização em texto puro —
sempre metadado (`authorized_at`, valores antes/depois de preço, motivo de
cancelamento).

---

## 13. Mobile / responsividade / UX

Já coberto e validado em rodadas anteriores deste mesmo projeto — 64
carregamentos (16 rotas × 2 temas × 2 viewports) com 0 overflow horizontal e 0
erro de JS (`correcao-pos-teste-operacional.md`, "Validação final"), e
varreduras dedicadas de responsividade em 375/390/1280/1440 registradas nas
rodadas de identidade visual (R23.x, tasks internas #61–#63). Esta auditoria
não repetiu esse trabalho — não há indício de regressão introduzida por
mudanças de schema/RLS desde então (nenhuma delas mexeu em componente ou
CSS).

---

## 14. Jornada "vida real" — status por trecho

| Trecho | Status |
|---|---|
| Criar profissional, gerar acesso | Caminho de falha testado a fundo (chave placeholder); caminho feliz **NÃO CONFIRMADO** |
| Primeiro login, trocar senha | **NÃO CONFIRMADO** — sem conta ativável |
| Operar agenda/atendimento/venda como staff | **CONFIRMADO** via `set local role authenticated` real (não é o mesmo que clicar na tela, mas é o mesmo papel que o PostgREST aplicaria) — `auditoria-final-pre-piloto.md` |
| Aplicar desconto/cortesia com e sem código | **CONFIRMADO** (mesma fonte) |
| Logout/login de novo | **NÃO CONFIRMADO** |
| Ser desativado e tentar continuar | **CONFIRMADO** a nível de banco (revogação de vínculo fecha RLS); tentativa de tela **NÃO CONFIRMADA** |
| Dois barbeiros, acesso cruzado | Isolamento **entre empresas CONFIRMADO**; isolamento **entre colegas da mesma empresa para dados financeiros NÃO EXISTE** (§5) |

---

## 15. Matriz final

| Área | Status | Evidência | Severidade | Observação |
|---|---|---|---|---|
| Bypass de preço/desconto/cortesia no atendimento | 🟢 | `enforce_attendance_item_integrity`, trigger ativo, testado ao vivo | — (P0 já corrigido) | Ver `auditoria-final-pre-piloto.md` |
| Escrita administrativa (catálogo/preço) por staff via REST | 🟢 | RLS por papel + `assert_admin_write`, testado ao vivo | — (P0 já corrigido) | Ver `correcao-pos-teste-operacional.md` |
| **Leitura/escrita de dados financeiros por staff via REST** | 🔴 | `pg_policies` + grants, lido nesta rodada | **P0** | Achado novo, não corrigido |
| Falsificação de `audit_log` | 🟢 | `write_audit_log` blindada, testado ao vivo | — (P1 já corrigido) | |
| Código de autorização (desenho e uso) | 🟢 | Lido integralmente + testado ao vivo | — | Sem achado |
| Ban global quebrando multiempresa | 🟢 | Corrigido e testado | — (P1 já corrigido) | |
| Isolamento entre empresas (RLS geral) | 🟢 | Testado ao vivo, 7+ vetores | — | |
| Professional × serviço no agendamento (não só no atendimento) | 🟡 | Leitura de código, sem vínculo encontrado | P2 | NÃO CONFIRMADO ao vivo |
| Comissão/venda sem CHECK de valor no INSERT direto | 🟠 | `pg_policies`, mesma raiz do achado do §5 | P1 (parte do P0 acima) | |
| Concorrência real (2 sessões) | ⚪ | Lock/CHECK identificados, não exercitados | — | NÃO CONFIRMADO — ambiente |
| Provisionamento real de conta (chave de serviço) | ⚪ | Placeholder confirmado | — | NÃO CONFIRMADO — ambiente |
| Login/primeiro acesso ponta a ponta | ⚪ | Não exercitado nesta rodada | — | NÃO CONFIRMADO — ambiente/escopo |
| Mensagens de erro amigáveis | 🟢 | Leitura de `lib/errors.ts` | — | Sem achado |
| Exclusão física de profissional | 🟢 | Não existe (só desativação) | — | Achado positivo |
| Mobile/responsividade | 🟢 | Rodadas anteriores, sem regressão desde então | — | |
| Comissão 0–150%/validação de cadastro | 🟡 | Zod ok, sem CHECK no banco | P3 | |
| Prefixo `"Fa"` fixo na senha temporária | 🟡 | Leitura de `generate_temporary_password` | P3 | Cosmético, não reduz entropia de forma relevante |
| Regressão (`tsc`/`test`/`build`) | 🟢 | Rodados nesta sessão, sem alterar código | — | 0 erros de tipo, 85/85 testes, build completo |

Legenda: 🟢 confirmado e correto · 🟡 confirmado, achado menor · 🟠 confirmado,
achado relevante mas mitigado em parte · 🔴 confirmado, achado crítico ·
⚪ não confirmado por limitação de ambiente/escopo.

---

## 16. Respostas diretas (fechamento)

1. **O sistema impede um staff de ver a folha de comissão de colegas?** Não —
   só a UI esconde; o banco permite `SELECT` direto em `commission` para
   qualquer membro da empresa (§5).
2. **O sistema impede um staff de ler o Financeiro por fora da tela?** Não,
   pela mesma razão.
3. **O desconto/cortesia sem autorização é bloqueado no banco, não só na
   tela?** Sim — confirmado, trigger + `assert_operation_authorized`.
4. **O preço do item pode ser inventado pelo cliente (app ou REST direto)?**
   Não para `attendance_item` (derivado do catálogo pelo trigger). **Sim**
   teoricamente para um `sale_item`/`financial_entry` inserido direto fora do
   fluxo de `create_pdv_sale`/`close_attendance` — mesma raiz do §5.
5. **Um staff pode virar admin sozinho?** Não encontrado nenhum caminho —
   `professional.company_id`/`user_company_role.role` só mudam por RPC/ação
   gerida por `has_company_management_access`.
6. **O código de autorização pode ser reaproveitado entre operações?** Não —
   escopo é `operação:empresa` dentro da mesma transação.
7. **Desativar em uma empresa afeta login em outra?** Não mais — corrigido e
   testado em rodada anterior.
8. **Existem papéis inventados (gerente/recepção/barbeiro) no banco?** Não —
   só `owner`/`admin`/`staff`; qualquer outro nome é categoria de produto.
9. **Existe exclusão física de profissional?** Não encontrada.
10. **A trilha de auditoria pode ser forjada?** Não — `write_audit_log` é a
    única porta e recusa chamada direta.
11. **Alguma mensagem de erro vaza detalhe cru do Postgres?** Não encontrada.
12. **A chave de serviço está configurada neste ambiente?** Não — placeholder,
    bloco conhecido e documentado.
13. **Existe conta de staff testável neste ambiente agora?** Não.
14. **Concorrência de estoque/caixa foi provada com 2 sessões reais?** Não —
    só o mecanismo (lock+CHECK) foi inspecionado.
15. **Profissional × serviço é validado no agendamento?** Não encontrado
    vínculo — só no lançamento do item de atendimento.
16. **Isolamento entre empresas está provado?** Sim, ao vivo, múltiplos
    vetores.
17. **Isolamento de papel DENTRO da mesma empresa está provado para dados
    financeiros?** Não — e o achado do §5 mostra que ele não existe.
18. **O sistema está pronto para operar com um piloto real hoje?** Ver
    veredito abaixo.

---

## 17. Veredito

**🟠 PRONTO COM BLOQUEIOS.**

O bypass de preço/desconto/cortesia (o P0 histórico deste projeto) está
genuinamente fechado no banco, com evidência ao vivo. Isolamento entre
empresas está sólido. Mas esta auditoria encontrou um **P0 novo, ainda não
corrigido**: qualquer `staff` autenticado pode, com uma chamada REST direta,
ler o razão financeiro inteiro da empresa (vendas, comissões de colegas,
movimentos de caixa) e inserir linhas fabricadas em `sale`, `sale_item`,
`commission` e `financial_entry` — contornando toda a aplicação. Isso
contradiz o próprio princípio de desenho já documentado no código
(`lib/permissions.ts`: "esconder o link na navegação não protege nada").
Até essa lacuna ser fechada (RLS por papel nas seis tabelas financeiras, no
mesmo padrão já aplicado a `professional`/`service`/`product`), o piloto
opera com um staff capaz de ver dados que a própria gerência da barbearia
espera manter privados entre a equipe.

Bloqueios adicionais para "pronto para produção" (não para o piloto, que pode
rodar com supervisão e este risco assumido conscientemente pelo dono):
provisionamento de conta de profissional nunca foi exercitado ponta a ponta
neste ambiente (chave de serviço é placeholder), e concorrência real de duas
sessões não foi provada — ambos são lacunas de **ambiente**, não evidência de
bug.
