# FADE.OS — Auditoria final do pré-piloto

Auditoria adversarial do trabalho feito até `30b632f`, com correção dos
problemas encontrados. A pergunta que guiou tudo: **"se eu ignorar o frontend
e chamar o endpoint direto, ainda consigo fazer algo que não deveria?"**

Todos os testes rodaram contra o banco de produção real
(`xaxszgyvapvzwensbjjq`), em transações revertidas, e boa parte deles com
`set local role authenticated` — ou seja, passando pelos mesmos GRANTs e
policies que a aplicação enfrenta, não com privilégio de superusuário.

Estado de produção conferido ao final: 2 empresas, 0 vendas, 0 atendimentos,
4 profissionais, 0 acessos, 0 códigos, 0 registros de auditoria, estoque em 12,
papéis `owner,owner`. Nada dos testes ficou.

---

## P0-1 — Bypass total de desconto e cortesia (o achado principal)

`assert_can_change_price` protegia só o desconto do **fechamento** e o do PDV.
O **item** do atendimento não era protegido por nada.

Comprovado antes da correção, com o usuário rebaixado a `staff`:

```
[A1] item de R$ 80 com desconto de R$ 79,99      → ACEITO
[A2] produto de R$ 50 marcado como cortesia      → ACEITO
[A3] serviço de R$ 80 com original_price = R$ 1  → ACEITO
[A4] venda fechada: total = 1,01  (catálogo: 210,00) | estoque baixado
```

Fechar com desconto zero fazia `assert_can_change_price` nem ser chamado. E
como a derivação de preço vivia só na Server Action, o mesmo ataque saía por
`INSERT` direto no PostgREST, sem tocar em uma linha de TypeScript.

### Correção

**Camada 1 — o trigger `trg_attendance_item_integrity`** passa a ser a
autoridade final sobre `attendance_item`, valendo para qualquer caminho de
escrita:

- deriva `original_price` do catálogo e descarta o que vier no payload;
- recusa desconto e cortesia sem autorização;
- torna `original_price` imutável depois de lançado;
- valida profissional × serviço × unidade (P1 abaixo).

**Camada 2 — o código de autorização da empresa**, que permite ao `staff`
executar a operação sem virar gerente.

### Revalidação (mesmo ataque, depois)

```
[A1] desconto direto                → DESCONTO_NAO_AUTORIZADO
[A2] cortesia direta                → CORTESIA_NAO_AUTORIZADA
[A3] preço inventado (1)            → sobrescrito: original_price=80,00; duração 5→30
[A4] UPDATE de desconto             → DESCONTO_NAO_AUTORIZADO
[A5] reescrita do preço congelado   → PRECO_ORIGINAL_IMUTAVEL
[A6] profissional de outra empresa  → PROFISSIONAL_INVALIDO
```

---

## O código de autorização

Um conceito só, por empresa, para operações sensíveis. **Não é senha de
administrador**: não concede acesso nenhum, autoriza exatamente a operação
pedida, na empresa pedida, e só dentro da transação em que foi apresentado
(a marca é `set_config(..., is_local => true)`).

| Regra | Como |
|---|---|
| Alfanumérico | 8 caracteres, alfabeto sem O/0, I/1, S/5 — o código circula ditado no balcão |
| Fonte segura | `extensions.gen_random_bytes(8)` |
| Só hash | bcrypt custo 10, em tabela sem policy de leitura e sem grant para `authenticated` |
| Nunca plaintext | existe uma única vez, no retorno de `regenerate_authorization_code` |
| Owner/admin regeneram | `has_company_management_access` dentro da função |
| Regenerar invalida na hora | `on conflict do update` do hash |
| Não dá acesso administrativo | autoriza só a operação; papel não muda |
| Escopo por operação | a marca é `operation:company_id` |
| Auditoria no uso | `authorize_discount` / `authorize_courtesy` em `audit_log` |
| Código nunca em log | verificado: não aparece em `after` nem em `reason` |

Owner/admin **não** digitam código: autorizam pelo próprio papel. A credencial
existe para delegar a operação a quem não é gerente.

### Evidência

```
[1]  código: 8 chars, alfanumérico=true
[2]  tabela de hashes ilegível para authenticated (permission denied)
[B]  desconto SEM código             → DESCONTO_NAO_AUTORIZADO
[B2] código errado                   → CODIGO_AUTORIZACAO_INVALIDO
[B3] código de OUTRA empresa         → CODIGO_AUTORIZACAO_INVALIDO
[C]  desconto COM código             → original=80,00 desconto=20,00 final=60,00
[D]  cortesia SEM código             → CORTESIA_NAO_AUTORIZADA
[E]  cortesia COM código             → original=50,00 final=0,00, motivo gravado
[E2] cortesia sem motivo             → MOTIVO_CORTESIA_OBRIGATORIO
[F]  código de "discount" tentando autorizar cortesia → CORTESIA_NAO_AUTORIZADA
[G]  auditoria: authorize_courtesy, authorize_discount, regenerate_authorization_code
     código vazou na auditoria = false
[H]  código antigo após regenerar    → CODIGO_AUTORIZACAO_INVALIDO
[H2] código novo                     → funciona
[I]  staff tentando regenerar        → FORBIDDEN
```

Todas as entradas de preço estão cobertas pela mesma regra:
`add_attendance_service_item`, `add_attendance_product_item`,
`update_attendance_item`, `close_attendance` (desconto de venda) e
`create_pdv_sale` (item e venda).

---

## P1 — Profissional × serviço × unidade no atendimento

`addAttendanceItem` validava só que o profissional era da empresa. Faltava:
ativo, unidade, vínculo `professional_service`, e `service.status` (que era
selecionado e ignorado). `startAttendanceFromAppointment` copiava os itens do
agendamento sem revalidar nada — um agendamento de semana passada podia ter
ficado inválido nesse meio-tempo.

Tudo passou para o trigger, então vale também para o `INSERT` direto.
Verificado: profissional de outra empresa, inativo, de outra unidade, sem
vínculo com o serviço, e serviço inativo — todos recusados.

## P1 — Ban global de auth quebrava multiempresa

`disableProfessionalAccess` aplicava `ban_duration` na conta do Supabase Auth,
que é **global**. Como a mesma conta pode estar ligada a mais de um
`professional`, desativar na empresa A bloqueava o login na empresa B junto.

Agora o ban só entra quando não sobrou nenhum acesso ativo em outro vínculo.
Enquanto sobrar, a revogação do vínculo em `user_company_role` já basta — sem
vínculo, `my_company_ids()` não devolve a empresa e o RLS fecha os dados dela.

Verificado no banco:

```
[H] após desativar só em A:
    acesso_A=false  acesso_B=true  vínculo_B_existe=true
    login_B_resolve=bbb222@login.fade.os   login_A_resolve=NULL
```

## P1 — Razão financeiro era editável depois da venda

`sale`, `sale_item`, `payment`, `commission`, `financial_entry`,
`cash_movement` e `stock_movement` tinham `UPDATE` e `DELETE` para
`authenticated`, com policy escopada só por empresa. Qualquer membro —
`staff` incluído — reescrevia o valor de uma venda **já fechada**:

```
update sale_item set total = 1, unit_price = 1 where sale_id = ...
→ 1 linha alterada
```

Nada na aplicação precisava desse `UPDATE`. As funções de venda só inserem; as
duas exceções (`cancel_sale` e pagamento de comissão) foram para dentro de
funções `SECURITY DEFINER` com checagem explícita de papel e empresa.

Revalidado: `update`/`delete` em todas as sete tabelas recusados por permissão;
`staff` recusado em `mark_commission_paid` e `cancel_sale`; owner paga e o
pagamento duplicado é recusado; cancelamento completo segue funcionando.

---

## Prova de fogo (cenários A–J da especificação)

```
[A] normal:    total=180,00  pag=180  comissão=32,00  fin=180  caixa=100  estoque 5→3
[B] desconto não autorizado          → DESCONTO_NAO_AUTORIZADO
[C] desconto autorizado              → final=60,00; auditoria authorize_discount=1
[D] cortesia não autorizada          → CORTESIA_NAO_AUTORIZADA
[E] cortesia autorizada              → venda=60,00; item: original=50,00 cobrado=0,00;
                                        estoque 3→2 (consumido); auditoria=1
[F] cancelamento    → venda=cancelled, pagamento estornado, comissão reversed,
                      estoque devolvido, estorno_fin=60, saída de caixa=60,
                      atendimento=cancelled
[G] cross-company   → leitura de B: 0 produtos, 0 serviços, 0 clientes, 0 profissionais
                      produto de B em atendimento de A → PRODUTO_INVALIDO
                      serviço/profissional de B        → SERVICO_INVALIDO
                      venda em B                       → UNIDADE_INVALIDA
                      adjust_stock em B                → FORBIDDEN
                      código de autorização de B       → FORBIDDEN
                      slug de B                        → FORBIDDEN
                      UPDATE direto em produto de B    → 0 linhas
[H] multiempresa    → ver acima
[I] estoque insuficiente             → ESTOQUE_INSUFICIENTE, estoque intacto
[J] agenda conflitante               → HORARIO_INDISPONIVEL
```

Bateria adversarial adicional: quantidade 0 e negativa, desconto negativo,
desconto acima do item, operação arbitrária em `authorize_operation`, edição de
item após o fechamento e adição de item em atendimento fechado — todos
recusados.

---

## Advisors do Supabase

Zero achados de nível **ERROR**. Os WARN restantes são os mesmos já
documentados (funções da página pública, funções de trigger, as quatro funções
órfãs do schema inicial, `btree_gist` em `public`) mais os quatro
`SECURITY DEFINER` novos — cada um com sua própria checagem interna, que é
justamente o motivo de serem DEFINER.

O `INFO rls_enabled_no_policy` em `company_authorization_code` é intencional:
a tabela tem RLS ligado e nenhuma policy porque ninguém deve lê-la pela API.

---

## Pendências que dependem de gente

1. **Login de profissional pelo navegador, ponta a ponta.** O vínculo, a
   autorização, o bloqueio pós-desativação e o comportamento multiempresa
   foram verificados no banco com o papel `authenticated` real. A jornada de
   tela (entrar com identificador, trocar senha no primeiro acesso, sair, ser
   desativado, tentar de novo) ainda precisa de um profissional de verdade.
2. **Concorrência real com duas sessões simultâneas.** Não foi executada: o
   MCP do Supabase usa uma conexão por chamada e não mantém transação aberta
   entre chamadas, e não há credencial de banco nem de service role neste
   ambiente. O que sustenta a garantia é o `select ... for update` em
   `apply_stock_delta` mais o CHECK de não-negatividade, e o teste de decisão
   sobre leitura obsoleta (recusada). **Não considere concorrência validada.**
3. **Ligar a proteção de senha vazada** no painel do Supabase.
4. **Gerar o código de autorização** de cada empresa em Configurações antes de
   abrir o piloto — sem ele, a equipe não consegue aplicar desconto nem
   cortesia (o que é o comportamento correto, mas trava a operação se ninguém
   gerar).
5. **Um dia de operação real** com o time usando pelo celular.

## Registrado, não corrigido

- **P2** — Comissão já `paid` não é revertida no cancelamento da venda
  (`cancel_sale` só reverte `predicted`/`due`). É defensável — dinheiro já
  repassado ao profissional não some sozinho — mas é uma decisão de negócio
  que merece ser confirmada.
- **P2** — Schema morto do projeto inicial segue em produção, por decisão.
- **P3** — O campo do código de autorização tem 40px de altura, igual a todos
  os outros inputs do sistema (`h-10`). Abaixo dos 44px recomendados para
  alvo de toque, mas é campo de texto, não botão; mudar exigiria restyle
  global de formulário, fora do escopo desta auditoria.
