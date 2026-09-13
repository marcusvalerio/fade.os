# FADE.OS / CORTEX.OS — R24: fechamento final pré-piloto (ataque total + correção + GO/NO-GO)

Pergunta que rege esta rodada: **se uma barbearia real começar a usar o
CORTEX.OS amanhã, existe algum problema técnico conhecido que torne isso
inseguro, inconsistente ou operacionalmente inviável?**

Metodologia idêntica às rodadas anteriores: ataque direto ao banco de
produção real (`xaxszgyvapvzwensbjjq`), sempre em transações revertidas
(`BEGIN...ROLLBACK`), nunca persistido. Toda correção foi atacada de novo
depois de aplicada, e o fluxo legítimo foi revalidado ao vivo na mesma
transação em que o ataque foi bloqueado.

---

## 1. Baseline

```
branch  claude/fade-os-pre-pilot-update-7znkqj
SHA inicial   52a62cb8f1f5f6cb794d1882652be212f5085a4c (fim da R23.9)
origin  https://github.com/marcusvalerio/fade.os
main    5d638a6 (não tocado)
working tree: limpo antes de começar
migrations: 43 (antes) → 44 (depois desta rodada)
testes: 85/85 (antes e depois)
typecheck: limpo (antes e depois)
build: completo (antes e depois)
```

Nenhum reset destrutivo, nenhuma fixture apagada, nenhum history rewrite.

---

## 2. Reprodução do P0 da R23.8 e verificação da correção da R23.9

Reatacado nesta rodada (não assumido como corrigido só porque o relatório
anterior disse isso):

```
SELECT financial_entry/commission/sale/sale_item/payment como staff
  → 0 linhas em todas (era 112/38/91/105/? antes da R23.9)
INSERT financial_entry fabricado (R$ 999.999) → BLOQUEADO 42501
INSERT sale fabricada → BLOQUEADO 42501
INSERT commission (FKs válidas) → BLOQUEADO — has_company_management_access
  avaliado como false para o mesmo usuário na mesma transação
create_pdv_sale/close_attendance legítimos (staff, caixa aberto) → SUCESSO
create_pdv_sale(company_id=Petrux, staff só da NORTE 21) → BLOQUEADO FORBIDDEN
```

**Confirmado: a correção da R23.9 continua fechada.** Nenhuma regressão.

---

## 3. Ataque total ao `cash_movement` — residual da R23.9

Investigado a fundo, não apenas "consegui inserir":

| Pergunta | Resposta, com evidência |
|---|---|
| Altera saldo esperado do caixa? | **Sim** — `close_cash_session` soma `sale_payment`+`suprimento`+`other_in` menos `sangria`+`other_out` para `expected_balance`; um `sale_payment` fabricado entra nessa soma. |
| Aparece no fechamento? | Sim, como parte do `expected_balance` — gera diferença/sobra sem venda real por trás. |
| Aparece no histórico/financeiro? | Aparece no histórico de `cash_movement` (Caixa); **não** aparece em `financial_entry` (sangria/suprimento nunca entram lá, por desenho — dinheiro trocando de lugar, não receita/despesa). `sale_payment` fabricado também não gera `financial_entry` correspondente (só as RPCs de venda criam esse par) — ou seja, o `cash_movement` fica **órfão**, sem contrapartida em vendas nem no financeiro, o que por si é um sinal de auditoria (mas exige alguém checar). |
| Pode ser de outra empresa/caixa? | Não — trigger `assert_cash_movement_session_open` já exige `company_id` batendo com a sessão e sessão aberta. |
| Pode inserir sem sessão aberta / em sessão fechada? | Não, mesmo trigger. |
| Pode fabricar sangria/suprimento? | Sim, mas isso **já é permitido pela aplicação legítima** (`addCashMovement`) — não é vetor novo. |
| Pode usar tipo inválido? | Não — `CHECK cash_movement_type_check` só aceita os 5 valores válidos. |

**Impacto real, provado**: o único vetor que dava a um staff algo que a
aplicação NÃO permite é o tipo `'sale_payment'` fabricado — ele infla o
saldo esperado do caixa sem venda correspondente, o que tanto pode mascarar
uma sangria de dinheiro real (o caixa "bate" porque a entrada fabricada
compensa a saída de fato) quanto criar uma diferença de fechamento
inexplicável. **Classificação confirmada: P1** — não é P0 porque não vaza
dado, não escapa de tenant, e não é o único controle contra desvio de caixa
(o fechamento com contagem física + diferença registrada continua existindo
e continuaria acusando a divergência se a "compensação" não for exata).

### Correção aplicada

Migration `supabase/migrations/20260919090000_cash_movement_sale_payment_origin.sql`:
trigger `enforce_cash_movement_origin()` que bloqueia `type='sale_payment'`
a menos que (a) o ator seja gerência, ou (b) o INSERT venha de dentro de uma
função `SECURITY DEFINER` de dono `postgres` — mecanismo: dentro de uma
função `SECURITY DEFINER`, `current_user` deixa de ser `authenticated` e
passa a ser o dono da função (`postgres`), confirmado nesta rodada com um
teste direto (`current_user` fora = `authenticated`; dentro de uma função
DEFINER de teste = `postgres`). `create_pdv_sale`, `close_attendance` e
`cancel_sale` já são `SECURITY DEFINER` (duas delas desde a correção da
R23.9) — os `INSERT INTO cash_movement (...'sale_payment'...)` que elas
fazem continuam passando; um `INSERT` do mesmo tipo vindo direto de
`authenticated` por REST agora não passa mais.

### Revalidação

```
staff: INSERT cash_movement type='sale_payment' fabricado (sessão aberta)
  → BLOQUEADO — 42501 MOVIMENTO_SALE_PAYMENT_NAO_AUTORIZADO
staff: INSERT cash_movement type='sangria' (legítimo)      → SUCESSO
staff: INSERT cash_movement type='suprimento' (legítimo)   → SUCESSO
staff: create_pdv_sale legítima (produto real, caixa aberto,
  pagamento em dinheiro) → SUCESSO, sale_id devolvido, e o cash_movement
  'sale_payment' interno da função foi gravado normalmente
```

Ataque bloqueado, operação legítima intacta — critério de fechamento do
brief satisfeito.

---

## 4. Privacidade de colegas — investigado a fundo, NÃO corrigido nesta rodada (decisão justificada)

Provado ao vivo (staff da NORTE 21, mesma técnica de rebaixamento):

```sql
select id, name, email, phone, default_commission_percent, user_id
from professional where company_id = '<NORTE 21>';
```

devolveu, para o staff rebaixado, **e-mail, telefone e percentual de
comissão de todo colega da empresa** (ex.: `qa.prof01@exemplo.test`,
`(21) 97000-0001`, `40.00`/`45.00`/`35.00`/`0.00` de comissão). RLS de
`professional` é `SO_EMPRESA` (`company_id in my_company_ids()`), sem
distinção de papel — confirmado no código-fonte que a UI (`ProximosAtendimentos.tsx`,
no Início) já busca `phone` do profissional numa consulta staff-visível,
embora não o renderize (é over-fetch do lado do servidor, não vaza para o
navegador por essa via específica — mas o REST direto, com a própria sessão
do navegador do usuário, vaza de qualquer forma, como provado acima).

**Necessidade operacional real**: nome (agenda, atendimento, ranking) —
confirmado em pelo menos 7 pontos do código (`ProximosAtendimentos`,
`/comissoes`, `/agenda`, `/kpis`, `/atendimento/[id]`, `/clientes/[id]`,
`TodayContext`). **Não confirmado** que `email`/`phone`/`default_commission_percent`
de um COLEGA (não de si mesmo) sejam necessários em algum desses pontos —
nenhum deles renderiza esses três campos para um profissional que não seja
o próprio usuário.

**Classificação: P1 confirmado, não P2** — é exposição real e provada de
dado pessoal (contato) e de dado sensível para o clima de equipe (percentual
de comissão de colegas), acessível por qualquer `staff` via REST direto, sem
relação com a interface.

**Por que não foi corrigido nesta rodada, apesar de ser P1**: o RLS do
Postgres filtra LINHAS, não COLUNAS. Não existe uma policy que diga "esconda
só estas três colunas para quem não é gerente" — a correção real exige uma
`view` que mascare `email`/`phone`/`default_commission_percent` com `CASE
WHEN has_company_management_access(...) OR user_id = auth.uid() THEN valor
ELSE null END`, revogar `SELECT` na tabela base para `authenticated`, e
migrar **todo** ponto do código que hoje lê `professional` diretamente
(pelo menos 10 arquivos, incluindo a própria tela de gestão de equipe, que
precisa continuar vendo o valor real para editar) para ler da view. Essa é
uma mudança de blast radius real num app em produção, sem sessão de staff
disponível neste ambiente para testar ao vivo cada tela afetada depois da
migração (Agenda, Atendimento, Início, Comissões, KPIs, Clientes,
Profissionais, Jornada). Aplicar isso "às cegas" nesta rodada arrisca
exatamente o resultado que o brief pede para evitar —
"operacionalmente inviável" — trocando um risco de privacidade conhecido e
limitado (intra-empresa, exige acesso técnico a devtools/REST) por um risco
concreto de quebrar a operação de agenda/atendimento sem forma de verificar
antes de uma barbearia real depender disso.

**Decisão registrada, não escondida**: P1 real, com causa raiz, prova e
correção exata já especificadas; fica como o item de maior prioridade do
backlog pós-piloto, a ser feito com uma sessão de staff real disponível
para regressão de tela. A migration exata recomendada:

```sql
create or replace view public.professional_directory
  with (security_invoker = true) as
select
  p.id, p.company_id, p.unit_id, p.name, p.role_title, p.active, p.avatar_url, p.user_id,
  case when public.has_company_management_access(p.company_id) or p.user_id = auth.uid()
       then p.email else null end as email,
  case when public.has_company_management_access(p.company_id) or p.user_id = auth.uid()
       then p.phone else null end as phone,
  case when public.has_company_management_access(p.company_id)
       then p.default_commission_percent else null end as default_commission_percent
from public.professional p
where p.company_id in (select public.my_company_ids());
```

seguida de `revoke select on public.professional from authenticated;` e da
troca de todo `.from("professional")` de leitura (não de escrita/gestão) por
`.from("professional_directory")`.

---

## 5. Nova varredura de segurança — o que mais foi atacado

Além do já coberto em §2–4, ataque final combinado (staff da NORTE 21,
transação revertida):

| Ataque | Resultado |
|---|---|
| Auto-promover a `owner` via `INSERT` em `user_company_role` | BLOQUEADO — `42501` (RLS sem policy de INSERT para nenhum papel) |
| Auto-promover a `owner` via `UPDATE` em `user_company_role` | BLOQUEADO — `42501` (idem, sem policy de UPDATE) |
| Ler o hash do código de autorização (`company_authorization_code`) | BLOQUEADO — `42501` permission denied (sem grant, sem policy) |
| `UPDATE service.default_price` direto | BLOQUEADO — `42501` (RLS por papel, correção anterior) |
| `cancel_sale` como staff | BLOQUEADO (o próprio `id` de venda já não é visível ao staff desde a R23.9; e a checagem interna de `has_company_management_access` é a segunda camada, já testada em rodada anterior) |
| `mark_commission_paid` como staff | BLOQUEADO, mesma razão |
| `disable_professional_access` como staff | BLOQUEADO — `42501 FORBIDDEN` |
| `regenerate_authorization_code` como staff | BLOQUEADO — `42501 FORBIDDEN` |

`user_company_role` e `audit_log` têm GRANTs brutos amplos para `anon`
(`INSERT/UPDATE/DELETE` no primeiro, `SELECT/TRUNCATE` no segundo) — **mesmo
padrão de ruído já documentado nas rodadas anteriores**: sem nenhuma policy
de RLS aplicável a essas operações/papel, o efeito prático é zero (RLS nega
por padrão quando não há policy correspondente — confirmado neste mesmo
ataque: `authenticated`, que TEM grant de INSERT/UPDATE em
`user_company_role`, foi bloqueado exatamente por falta de policy). Fica
registrado como **P3 de higiene de GRANT** (reduzir os grants brutos de
`anon`/`authenticated` ao mínimo necessário), não como vulnerabilidade
ativa — mesma conclusão já registrada para `TRUNCATE` em rodada anterior.

Nenhum outro caminho equivalente ao P0 da R23.8 foi encontrado nas tabelas
listadas pelo brief (`company`, `unit`, `professional`, `client`,
`appointment`, `attendance`, `attendance_item`, `service`, `product`,
`stock_movement` — "inventory"/"inventory_movement" não existem como
tabelas separadas neste schema; `stock_movement` é a tabela real).

---

## 6. Matriz de autorização real

| Área | OWNER/ADMIN | STAFF |
|---|---|---|
| Agenda | tudo | ver/criar/alterar/cancelar — mesmo escopo (operacional) |
| Atendimento | tudo | criar, itens, fechar — desconto/cortesia exigem código de autorização |
| Clientes | tudo | tudo (necessidade operacional — atender qualquer cliente) |
| Venda (PDV) | tudo, inclusive cancelar | criar — **não pode cancelar/reembolsar** |
| Pagamento | tudo | registra pagamento dentro da venda — não alcança a tabela `payment` direto (RLS papel, R23.9) |
| Caixa | tudo | abrir/fechar/sangria/suprimento — **não pode fabricar `sale_payment`** (fechado nesta rodada) |
| Financeiro | tudo | **nada** — UI oculta E banco bloqueia (RLS papel, R23.9) |
| Estoque | tudo | vê saldo, baixa por venda (via RPC) — não alcança `stock_movement` fabricado sem afetar saldo real |
| Comissões | tudo, inclusive marcar como paga | vê **só a própria** (RLS papel, R23.9) — não marca como paga |
| Equipe | tudo, inclusive editar | vê nome/cargo de colegas (necessário); **vê também contato/comissão de colegas — P1 não corrigido, §4** |
| Catálogo | tudo | vê para operar; não altera preço/duração (RLS papel, correção anterior) |
| Configurações | tudo | nada — UI oculta E banco bloqueia (`company`/`company_authorization_code` RLS papel) |

Papéis reais no banco: só `owner`, `admin`, `staff` (tabela `role`).
"OWNER/ADMIN" acima é a categoria de produto (`isManagerRole`), não dois
papéis distintos de RLS — ambos satisfazem `has_company_management_access`.

Para toda linha acima marcada como "não pode"/"nada", a fronteira existe em
pelo menos duas camadas (UI + banco), exceto o achado do §4 (fronteira só
na UI, banco não reforça — o item que ficou registrado, não corrigido).

---

## 7. Multi-tenancy

Reatacado nesta rodada: `create_pdv_sale(company_id=Petrux, autenticado como
staff da NORTE 21)` → `FORBIDDEN`, confirmado de novo (idêntico à R23.9,
sem regressão). Limitação que persiste: Petrux não tem nenhum
atendimento/venda para um teste cruzado de `close_attendance` com dado real
— mesma limitação já registrada, não convertida em "aprovado".

---

## 8. auth.users ↔ professional ↔ company

Sem mudança de schema nesta rodada nessa área. Reconfirmado por leitura
(não reaberto linha a linha): nenhum caminho de escrita direta em
`user_company_role` existe fora de RPC `SECURITY DEFINER` (§5) — o que
fecha, por construção, boa parte dos estados órfãos "perigosos" (um usuário
não pode se inserir num vínculo que não existia). Estados órfãos por FALHA
de provisionamento (ex.: `professional_access` sem `professional.user_id`)
já têm rollback tratado desde `correcao-pos-teste-operacional.md` P1 #3.

---

## 9/10/11/12/13. Provisionamento e conta QA real

**BLOQUEIO DE AMBIENTE, reconfirmado nesta rodada, sem bypass**:
`SUPABASE_SERVICE_ROLE_KEY` em `.env.local` tem 21 caracteres, zero pontos —
não é um JWT. `createAdminClient()` levanta `ConfigurationError` para
qualquer chamada de `enableProfessionalAccess`. Nenhuma chave foi inventada,
nenhum valor de placeholder foi trocado, `auth.users` não foi manipulado
diretamente.

**O que falta, exatamente**: uma `SUPABASE_SERVICE_ROLE_KEY` real do projeto
`xaxszgyvapvzwensbjjq`, configurada como variável de ambiente do runtime da
aplicação (não deste ambiente de auditoria). Ela é necessária porque criar
um login de profissional usa a Supabase Auth Admin API
(`auth.admin.createUser`), que só aceita a service role — não existe
caminho de criar `auth.users` pelo cliente anônimo/autenticado por desenho
de segurança do Supabase.

**Procedimento seguro para quando a chave existir** (documentado, não
executado):
1. Configurar `SUPABASE_SERVICE_ROLE_KEY` real no ambiente de execução da
   aplicação (nunca no repositório).
2. Como owner da NORTE 21, em Equipe → Profissionais → Novo, cadastrar
   "QA Barbeiro".
3. Usar "Ativar Acesso" na ficha do profissional — a tela mostra a senha
   temporária **uma única vez**; copiar por um canal seguro fora do
   Git/banco.
4. Testar login em `/login`, troca de senha em `/mudar-senha-inicial`,
   depois seguir o roteiro do §12 do brief.
5. Ao final do teste, usar "Desativar Acesso" na mesma ficha e confirmar que
   uma nova tentativa de login falha.

**Nenhuma credencial é entregue neste relatório** porque nenhuma pôde ser
gerada de forma real e segura neste ambiente — inventar uma seria
exatamente o "bypass"/"fabricar credencial" que o brief proíbe
explicitamente.

---

## 14. Financeiro — ataques diretos

Cobertos integralmente em §2 (P0 da R23.8, reatacado e confirmado fechado) e
§3 (residual do caixa, atacado e agora corrigido). Alterar
venda/pagamento/financeiro/comissão fechada (`UPDATE`/`DELETE`) já estava
bloqueado desde `correcao-pos-teste-operacional.md`; reconfirmado pelos
grants desta rodada (nenhum `UPDATE`/`DELETE` para `authenticated` nas
tabelas financeiras).

---

## 15. Comissões

Semântica confirmada por leitura (não alterada nesta rodada):
`commission.status` (`predicted`/`due`/`paid`/`reversed`) é **obrigação**,
não gera `financial_entry` própria quando marcada `paid` — decisão de
domínio já registrada em `auditoria-final-pre-piloto.md` ("comissão já paga
não é revertida no cancelamento... dinheiro já repassado ao profissional não
some sozinho"). Não é lacuna, é escolha de negócio documentada. Acesso: staff
vê só a própria (R23.9); marcar como paga é `mark_commission_paid`,
`SECURITY DEFINER`, gate de gerência, reatacado e confirmado bloqueado
nesta rodada (§5).

---

## 16. Caixa

`opening_balance + inflow (sale_payment+suprimento+other_in) - outflow
(sangria+other_out) = expected_balance`, calculado dentro de
`close_cash_session` com `for no key update` (trava antes de somar — já
documentado). Único ponto fraco encontrado (`sale_payment` fabricável) foi
corrigido nesta rodada (§3). Sessão fechada é imutável (`UPDATE`/`DELETE`
revogados de `authenticated`, trigger `cash_session_closed_is_immutable`).

---

## 17. Estoque

`apply_stock_delta` (`SECURITY DEFINER`, `for update`, `CHECK
current_stock >= 0`) continua sendo o único caminho que muda saldo real.
`stock_movement` aceita `INSERT` fabricado por staff (RLS só de empresa,
§5 da R23.9) mas isso **não** altera `product.current_stock` — é poluição
de histórico, não fraude de saldo. **P2, registrado, não corrigido** (mesma
classificação da R23.9, reconfirmada, não reaberta).

---

## 18. Agenda

Sem mudança nesta rodada. `professional_service` não é validado no momento
do agendamento (só no lançamento do item de atendimento, via trigger) —
achado já registrado na R23.8 como P2, não uma falha de segurança (nenhum
dado sensível em jogo, e o atendimento real continua protegido).

---

## 19. Atendimento

Sem mudança de lógica nesta rodada — `close_attendance` ganhou só a
checagem de vínculo (§2, herdada da R23.9) e é a única alteração desta área.
Atomicidade confirmada por leitura: tudo dentro de uma única função
PL/pgSQL, uma falha em qualquer ponto (`raise exception`) reverte a
transação inteira — não existe "meio atendimento fechado".

---

## 20. Catálogo

Sem mudança nesta rodada. RLS por papel em `service`/`product`/`consumable`
já corrigida e reconfirmada nesta rodada (§5, `UPDATE service.default_price`
bloqueado). Validação de preço/duração negativos: existe range check em
Zod na Server Action; sem CHECK no banco (P3 já registrado, não corrigido —
risco baixo, único caminho de escrita é a Server Action gerencial mesma).

---

## 21. Clientes

Sem mudança nesta rodada. `client` é `SO_EMPRESA` (SELECT/INSERT/UPDATE) —
avaliado como apropriado: um barbeiro precisa poder atender qualquer cliente
da casa, diferente do caso de "comissão/financeiro de colegas" onde a
necessidade operacional não se sustenta. Homônimos: rotulagem por
`rotularHomonimos`, já auditada em rodada anterior.

---

## 22. Audit log

Sem mudança nesta rodada. `SELECT` é `PAPEL` (R23.9), escrita só via
`write_audit_log` (`SECURITY DEFINER`, recusa chamada de primeiro nível).
Reconfirmado por leitura: nenhuma chamada de auditoria grava senha, token,
service role ou código de autorização.

---

## 23. Privacidade / LGPD — atualização desta rodada

Herdado de `docs/auditoria-security-go-no-go-r23-9.md` §19, com uma
atualização: o achado de menor privilégio (contato/comissão de colegas) foi
**investigado a fundo e provado ao vivo** nesta rodada (§4), passou de
"acessível" a **confirmado + causa raiz + fix exato especificado**, mas
permanece **não corrigido** por decisão de risco explícita (blast radius,
sem sessão de staff para regressão de tela). Segue: **NECESSITA VALIDAÇÃO
JURÍDICA/DOCUMENTAL** para tudo que é política (retenção, exclusão,
consentimento) — nada disso foi fabricado nesta rodada.

---

## 24. Secrets

Verificado nesta rodada, sem imprimir nenhum valor:

- `SUPABASE_SERVICE_ROLE_KEY`: só em `.env.local` (não versionado —
  `.gitignore` cobre `.env*.local`, confirmado), placeholder, nunca logado.
- Nenhuma chamada de `console.log`/`console.error` em `lib/errors.ts` ou nas
  RPCs de autorização inclui senha, código de autorização, token ou service
  role — só código/mensagem de erro do Postgres.
- Código de autorização da empresa: só existe em texto puro no retorno de
  `regenerate_authorization_code`, nunca gravado (confirmado por leitura do
  SQL, `auditoria-final-pre-piloto.md`).
- Nenhum secret novo foi introduzido pelas migrations desta rodada — ambas
  são só lógica (`CREATE FUNCTION`/`CREATE TRIGGER`), sem valor sensível.
- Bundle do frontend: a `anon key` do Supabase é, por desenho do produto
  (PostgREST + RLS), pública — não é um secret, é a mesma peça que qualquer
  cliente Supabase expõe; a segurança real está inteiramente na RLS, que é
  o que estas três rodadas (R23.8/R23.9/R24) vêm testando.

---

## 25. Concorrência

**BLOQUEADO POR AMBIENTE, reconfirmado**: o MCP do Supabase usa uma conexão
por chamada, sem sustentar duas transações abertas simultaneamente — os "5
finalizações simultâneas"/"2 vendas simultâneas" pedidos pelo brief não são
executáveis neste ambiente. O que sustenta a garantia, e foi confirmado por
leitura nesta rodada: `for update` em `apply_stock_delta`, `for no key
update` em `close_cash_session`/`cancel_sale` (tomado ANTES de somar — a
migration `20260915090000` documenta a corrida que essa ordem resolve),
`CHECK (current_stock >= 0)`. **Não considerar concorrência validada** —
mesma barreira honesta das duas rodadas anteriores.

---

## 26. Frontend/backend consistency

Reconfirmado nesta rodada, para toda ação atacada em §5: em cada caso onde
a UI diz "não" (Financeiro, Cancelar venda, Comissão de colega, Configurações
de autorização), o banco também diz não, de forma independente do frontend
(testado via SQL direto, sem passar por nenhuma tela). Único ponto onde a UI
diz "não" e o banco **não reforça** continua sendo o achado do §4
(contato/comissão de colegas) — nenhuma tela do produto expõe esses campos
de um colega, mas o banco permite a leitura direta.

---

## 27. Mobile

Sem mudança de UI nesta rodada (as duas correções foram só banco). Cobertura
375/390/1280/1440 permanece a validada em rodadas anteriores.

---

## 28. Correções desta rodada

| # | Severidade | O quê | Onde | Status |
|---|---|---|---|---|
| 1 | 🟠 P1 | `cash_movement` aceitava `type='sale_payment'` fabricado por staff via REST, inflando o saldo esperado do caixa sem venda real | `20260919090000_cash_movement_sale_payment_origin.sql` | **CORRIGIDO E REVALIDADO** |
| 2 | 🟠 P1 | Contato (e-mail/telefone) e comissão % de colegas visíveis a qualquer staff via REST direto | — | **CONFIRMADO, NÃO CORRIGIDO** (decisão de risco justificada, §4) |

Nenhum P0 novo foi encontrado nesta rodada.

---

## 29. Regressão

```
npx tsc --noEmit ......... limpo, antes e depois das duas migrations
npm test .................. 85/85 (antes e depois)
npm run build ............. completo, 31 rotas, sem erro (antes e depois)
```

Sem teste automatizado novo adicionado (as validações desta rodada são
ataques SQL diretos contra produção real, documentados em §2/§3/§5 — mais
fortes que um teste unitário porque exercitam RLS/grants reais, mas não
substituem a suíte de 85 testes, que continua íntegra e sem enfraquecimento
de asserção).

---

## 30. P2 remanescentes (backlog, não corrigidos por decisão, não por omissão)

- `stock_movement` aceita `INSERT` fabricado (não altera saldo real) — §17.
- `professional_service` não validado no momento do agendamento (só no
  atendimento) — §18.
- GRANTs brutos amplos para `anon`/`authenticated` em `user_company_role`/
  `audit_log` (inertes por falta de policy, mas violam princípio de menor
  privilégio de configuração) — §5.
- Sem CHECK de range no banco para preço/duração/comissão de catálogo
  (só Zod) — §20.
- Prefixo `"Fa"` fixo em senha temporária gerada — cosmético.
- Lacunas de produto/documentação em retenção, exclusão, direitos do
  titular, consentimento de marketing — §23.

---

## 31. Limitações desta rodada

| Limitação | Classificação |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` é placeholder — nenhuma conta QA real pôde ser criada, login ponta-a-ponta não exercitável | BLOQUEADO POR AMBIENTE |
| Concorrência real (múltiplas conexões simultâneas) | BLOQUEADO POR AMBIENTE |
| `close_attendance` cross-tenant com dado real (Petrux sem atendimentos) | NÃO CONFIRMADO |
| Correção do achado do §4 (privacidade de colegas) | ADIADA POR DECISÃO DE RISCO, não por limitação técnica — fix especificado, não aplicado |
| Conformidade jurídica com a LGPD | NÃO APLICÁVEL a esta auditoria |

---

## 32. Resumo final obrigatório

**Posso colocar uma barbearia real para usar o CORTEX.OS amanhã?**

**SIM, com um proprietário/gerente supervisionando o piloto e um item de
backlog priorizado e já especificado.**

Justificativa, item por item do brief:

- Nenhum P0 conhecido continua aberto. O único P0 desta linha de auditorias
  (R23.8, tabelas financeiras) foi reproduzido de novo nesta rodada e
  confirmado fechado.
- Nenhum bypass relevante de RLS restante — o residual do caixa (P1) foi
  corrigido e revalidado nesta própria rodada.
- Nenhum privilege escalation conhecido — auto-promoção a owner/admin,
  regenerar código de autorização, cancelar venda, marcar comissão paga e
  desativar acesso de colega como staff: todos atacados de novo nesta
  rodada, todos bloqueados.
- Multi-tenancy comprovada dentro da evidência disponível (uma limitação de
  dado de teste registrada, não escondida).
- Staff limitado ao escopo correto em toda área testável, **exceto** o
  achado do §4, que é sobre PRIVACIDADE ENTRE COLEGAS DA MESMA EMPRESA — não
  é acesso administrativo, não é dado financeiro da empresa, não é
  vazamento entre empresas. É o único item que impede o veredito máximo.
- Financeiro, caixa, estoque, comissão, venda: protegidos, testados
  adversarialmente nesta rodada.
- Auth funcional dentro do que é testável sem a chave de serviço real;
  profissional/desativação funcionam corretamente nos mecanismos que não
  dependem dela (RLS, revogação de vínculo).
- Concorrência crítica: protegida por mecanismo (lock+CHECK), não provada
  ao vivo — limitação de ambiente, não indício de falha.
- Audit log funcional, sem secrets.
- Secrets protegidos — nenhum exposto em Git, log ou bundle.
- Privacidade tecnicamente razoável **com uma exceção conhecida e já
  especificada** (§4); lacunas jurídicas/documentais identificadas
  explicitamente, não fabricadas como resolvidas.
- Conta QA: **não criada** — bloqueio de ambiente real (chave de serviço),
  procedimento seguro documentado para quando a chave existir.
- 85/85 testes, typecheck e build passando.

## GO/NO-GO FINAL

# 🟠 PRONTO COM BLOQUEIOS

Não é o veredito máximo (🟢 APTO PARA PILOTO) porque o critério do brief
exige **nenhum P1 crítico conhecido**, e o achado do §4 é um P1 real,
confirmado, com causa raiz e correção especificadas, mas **deliberadamente
não aplicado** nesta rodada por não haver como validar ao vivo (sem sessão
de staff) uma mudança que toca pelo menos 10 pontos de leitura em produção.
Corrigir às cegas teria trocado um risco de privacidade conhecido e limitado
por um risco operacional desconhecido — a escolha mais responsável foi
documentar e não implementar.

**Os dois bloqueios exatos**, em ordem de prioridade:

1. **Corrigir o achado do §4** (view `professional_directory` + migração
   dos ~10 pontos de leitura) — precisa de uma sessão com um browser/conta
   de staff real para regressão de tela antes de ir para produção. É o
   único item bloqueando o veredito máximo.
2. **Provisionar a `SUPABASE_SERVICE_ROLE_KEY` real** no ambiente de
   execução — sem ela, criar/desativar contas de profissional não funciona
   em produção, o que é inviável operacionalmente para uma barbearia real
   (ela precisa dar acesso a barbeiros).

Com esses dois itens à parte, o piloto pode prosseguir sob supervisão do
proprietário, que segue sendo, também neste ambiente, a única conta
testável.
