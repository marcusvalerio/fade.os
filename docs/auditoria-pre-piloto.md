# FADE.OS — Auditoria pré-piloto (FASE 0)

Auditoria do estado real do repositório **e do banco de produção**
(projeto Supabase `FADE-OS`, ref `xaxszgyvapvzwensbjjq`, região `sa-east-1`),
feita em 2026-09-07 lendo o schema vivo, não as migrations do GitHub.

A regra que orientou toda a auditoria: **uma migration existir no GitHub não
significa que ela foi aplicada.** Todo item abaixo foi verificado contra
`pg_proc`, `information_schema.columns`, `pg_constraint`,
`supabase_migrations.schema_migrations` e `pg_policies` do banco real.

---

## P0 — impede operação

### P0.1 — `public.professional_access` não existe em produção

`list_tables` no banco real não retorna `professional_access`. As quatro
migrations do BLOCO B (`20260909190000`, `20260909200000`, `20260910000000`,
`20260910010000`) estão no repositório e **nenhuma foi aplicada**.

Consequência direta: toda consulta a `professional_access` falha. Isso inclui
o middleware (`lib/supabase/middleware.ts:48`), que roda em **todas** as rotas
privadas — é a origem do erro de produção relatado.

### P0.2 — RPCs do BLOCO B não existem em produção

Ausentes de `pg_proc`, todas chamadas pela aplicação:

| RPC | Chamada em | Efeito da ausência |
|---|---|---|
| `get_professional_login_email` | `actions/auth.ts:34` | login profissional impossível |
| `has_company_management_access` | `lib/supabase/middleware.ts:75` | middleware não distingue owner/admin |
| `enable_professional_access` | `actions/profissional-acesso.ts:110` | não é possível criar acesso |
| `disable_professional_access` | `actions/profissional-acesso.ts:41,131` | não é possível desativar |
| `reset_professional_access` | `actions/profissional-acesso.ts:150` | não é possível resetar |

### P0.3 — A ordem das migrations do BLOCO B é inaplicável

`20260909190000_professional_login_lookup.sql` cria
`get_professional_login_email`, cujo corpo (`language sql`) referencia
`public.professional_access` — mas a tabela só é criada em
`20260910000000`. Com `check_function_bodies` no padrão (`on`), a migration
anterior **falha**. Ou seja: mesmo aplicando o repositório em ordem, o BLOCO B
não sobe.

### P0.4 — `pgcrypto` está no schema `extensions`, não em `public`

`20260910000000_bloco_b_professional_access.sql` define
`public.hash_password()` chamando `crypt()`/`gen_salt()` sem qualificar o
schema, e `enable_professional_access` roda com
`set search_path = public, pg_temp`. Como `pgcrypto` está instalado em
`extensions` (verificado em `pg_extension`), essas chamadas nunca resolveriam
em produção.

Decisão tomada na FASE 1: **remover a dependência**. A credencial efetiva
pertence ao Supabase Auth; guardar um bcrypt da senha temporária no banco não
tem utilidade e é material sensível a mais. A coluna
`temporary_password_hash` é preservada (não-destrutivo) mas passa a ser
sempre `null`.

### P0.5 — Preço da venda vem do cliente

`public.create_pdv_sale` (produção) lê `unit_price` do JSON enviado pelo
navegador e nunca o confronta com `product.sale_price`. O mesmo vale para
`actions/atendimento.ts`: `addAttendanceItem` e `addAttendanceProductItem`
gravam `original_price` direto do formulário, sem comparar com
`service.default_price` / `product.sale_price`.

Um cliente modificado fecha uma venda de R$ 200 por R$ 1 — e o registro fica
consistente no banco, porque o backend nunca teve a informação correta.

### P0.6 — Venda concluída sem pagamento

Tanto `create_pdv_sale` quanto `close_attendance` aceitam
`p_payments = '[]'` e ainda assim gravam `sale.status = 'completed'`. A
verificação `abs(v_payment_sum - v_total) > 0.01` só roda **se** o array não
estiver vazio. Resultado: venda fechada, comissão gerada, estoque baixado,
zero pagamento e zero lançamento financeiro.

### P0.7 — Baixa de estoque não é atômica e permite estoque negativo

`create_pdv_sale` faz `select current_stock` → compara → `update product set
current_stock = current_stock - qtd`, sem `for update` e sem serialização.
Duas vendas simultâneas do último item passam ambas na verificação.

`close_attendance` é pior: decrementa **sem nenhuma verificação** de saldo.

Não existe `CHECK (current_stock >= 0)` em `product` nem em `consumable`
(confirmado em `pg_constraint`), então o banco aceita saldo negativo.

---

## P1 — precisa ser corrigido antes do piloto

### P1.1 — Nenhuma Server Action administrativa exige owner/admin

Todas usam apenas `requireCompanyAccess()`, que aceita qualquer vínculo em
`user_company_role` — **incluindo `staff`**. Esconder o link na navegação não
protege a Server Action, que é um endpoint HTTP.

Um profissional com role `staff`, chamando a action diretamente, consegue
hoje: criar/editar/desativar profissionais, serviços, produtos e materiais;
alterar dados da empresa, da unidade, o slug público e o logo; ligar/desligar
formas de pagamento; ajustar estoque com qualquer quantidade; marcar comissão
como paga; lançar despesa; cancelar venda; abrir/fechar caixa; e editar
jornada, bloqueios e ausências de qualquer colega.

Único ponto já protegido: `actions/profissional-acesso.ts`, via
`requireManagerAccess`.

### P1.2 — Agenda não é validada no servidor

`createAppointment` (`actions/agenda.ts:25`) valida apenas que unidade,
cliente, serviço e profissional pertencem à empresa. Não valida:

- profissional pertence à **unidade** do agendamento;
- profissional está `active`;
- profissional executa aquele serviço (`professional_service`);
- horário cabe na jornada (`professional_schedule` + breaks);
- horário cabe no funcionamento da unidade (`unit_business_hours`);
- bloqueios (`professional_block`) e ausências (`professional_absence`).

A única barreira real hoje é a exclusion constraint
`appointment_service_no_overlap`, que cobre **somente** sobreposição do mesmo
profissional. Toda a disponibilidade calculada pela UI
(`get_available_slots`) é conselho, não regra.

### P1.3 — `professional_access` tratado como 1:1 com o usuário de auth

`lib/supabase/middleware.ts:66` faz `accesses?.[0]` depois de rejeitar o caso
`length > 1`. Isso fecha o buraco, mas ao custo de deslogar um usuário
legítimo com vínculo em duas empresas. `actions/profissional-acesso.ts:182` e
`:189` usam `maybeSingle()` sobre `professional` filtrado só por `user_id` —
com dois vínculos, `maybeSingle()` **erra** e o primeiro acesso trava.

O modelo correto é: o acesso é 1:1 com o `professional`, e um usuário de auth
pode ser `professional` em mais de uma empresa. A decisão precisa ser tomada
no escopo da empresa ativa, nunca por índice de array.

### P1.4 — `unit_id` do produto não é confrontado com a unidade da venda

`product.unit_id` existe e é `not null`, mas `create_pdv_sale`,
`addAttendanceProductItem` e `adjust_stock` validam apenas `company_id`. Uma
venda da unidade A consome estoque de um produto da unidade B.

### P1.5 — Navegação mobile depende de scroll horizontal

`components/app-nav.tsx:99` é uma `<nav>` com `overflow-x-auto` e oito áreas.
Em iPhone isso vira exatamente a "fileira espremida" que a seção 13 proíbe
como solução final. Os dropdowns também abrem em `absolute` dentro dessa
faixa que rola, o que é frágil no toque.

### P1.6 — Contexto de tenancy é recalculado várias vezes por request

`app/(app)/layout.tsx` chama `getCurrentCompany()` (1 × `auth.getUser`,
1 × `user_company_role`), depois `requireAuthenticatedUser()` (2º
`auth.getUser`), depois `getOwnProfessionalId()` (3ª query). Cada página
abaixo do layout repete o mesmo bloco, e cada `requireCompanyAccess()` dentro
de uma action refaz `auth.getUser` + `user_company_role`. Numa página que
chama três actions são ~8 idas ao Supabase para responder sempre a mesma
pergunta.

---

## P2 — importante, pode aguardar

- **P2.1** — Schema morto do projeto inicial ainda em produção: `houses`,
  `profiles`, `servicos`, `clientes`, `agendamentos`, `atendimentos`,
  `caixa_movimentos`, `caixa_fechamentos`, `estoque`, `estoque_movimentos`
  (todas com 0 linhas) e as funções `meu_house_id`, `meu_role`,
  `atualizar_stats_cliente`, `registrar_entrada_caixa`. Nada na aplicação as
  referencia. Decisão: **deixar como está** — remover é destrutivo e não é
  requisito de piloto.
- **P2.2** — Nomes de migration divergem entre GitHub e
  `supabase_migrations.schema_migrations` (ex.: `phase4_functions` vs
  `20260908160100_phase4_functions`), e `20260909110000_provadefogo1_hotfix_company_slug`
  aparece duas vezes com versões diferentes. Não quebra nada, mas torna
  impossível auditar por nome.
- **P2.3** — Status de agendamento: os oito estados do
  `appointment_status_check` são todos alcançáveis pela UI e distinguem
  informação real (cancelado por quem, comparecimento). Ver análise na
  FASE 6 — a redução **não** foi feita.
- **P2.4** — `attendance_item.planned_duration_minutes` vem do formulário
  sem confronto com `service.planned_duration_minutes`.

---

## Estado do que já estava pronto

Confirmado presente e funcional em produção, **não** refeito:

- multiempresa, RLS e `my_company_ids()` em todas as tabelas operacionais;
- triggers `check_*_same_company` cobrindo cruzamento de tenant;
- `appointment_service_no_overlap` (exclusion constraint GiST) — a garantia
  atômica de que um profissional não atende dois clientes ao mesmo tempo;
- motor de disponibilidade `get_available_slots` em SQL;
- núcleo comercial `close_attendance` / `create_pdv_sale` / `cancel_sale` /
  `open_cash_session` / `close_cash_session` / `adjust_stock`;
- camada pública de agendamento (`get_public_*`, `create_public_appointment`);
- cortesia como conceito de domínio (`attendance_item.type = 'courtesy'`,
  `sale_item.is_courtesy`);
- arquitetura de navegação em oito áreas;
- base visual Onyx nos design tokens (`app/globals.css`), sem resquício da
  direção Jade.
