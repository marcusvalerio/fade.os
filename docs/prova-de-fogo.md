# FADE.OS — Prova de fogo (FASE 10)

Cenários executados contra o **banco de produção real**
(`xaxszgyvapvzwensbjjq`), cada um dentro de uma transação revertida ao final.
Nenhum dado operacional foi criado, alterado ou removido — verificado depois
de cada bateria: 2 empresas, 0 vendas, 0 atendimentos, 4 profissionais,
estoque em 12, papéis `owner,owner`.

Cada linha abaixo foi realmente executada. Onde não foi, está dito.

---

## Empresa

| Passo | Resultado |
|---|---|
| Criar empresa | criada; quem criou vira `owner` |
| Configurar unidade + horário de funcionamento | ok |
| Criar profissional + jornada | ok |
| Criar serviço | ok |
| Vincular profissional ao serviço | ok |

## Profissional (BLOCO B)

Executado com o papel `authenticated` real (`set local role authenticated`),
não com privilégio de superusuário — ou seja, passando pelos mesmos GRANTs e
policies que a aplicação enfrenta.

| Passo | Resultado |
|---|---|
| Ativar acesso | identificador de 6 caracteres + senha temporária de 13 |
| Registro criado | `is_access_enabled=true`, `password_set_at=null`, hash `null` |
| Lookup de login | resolve com o código em maiúscula e em minúscula |
| Desativar acesso | `is_access_enabled=false` **e o lookup passa a devolver `null`** |
| Resetar acesso | novo identificador, diferente do anterior, primeiro acesso exigido de novo |
| Empresa divergente | `PROFESSIONAL_NOT_FOUND` |
| `staff` tentando ativar / desativar / resetar | `FORBIDDEN` nos três |
| Usuário sem vínculo | `has_company_management_access` = false |
| Gerador de credencial chamado direto | sem privilégio |

**Não executado:** login e logout pelo navegador com um profissional real.
Exigiria criar uma conta de auth em produção; o vínculo, a autorização e o
bloqueio pós-desativação foram verificados no banco, mas a jornada de tela
ainda precisa de um teste manual com um profissional de verdade.

## Cliente → atendimento → venda

| Passo | Resultado |
|---|---|
| Cadastrar cliente | ok |
| Agendar | criado com status `scheduled` |
| Atendimento com serviço (R$ 80) + 2 produtos (R$ 100) | subtotal R$ 180 |
| Fechar sem pagamento | `VENDA_SEM_PAGAMENTO` |
| Fechar com pagamento parcial (R$ 50 de R$ 180) | `PAGAMENTO_NAO_CONFERE` |
| Fechar com R$ 100 dinheiro + R$ 80 pix | venda R$ 180 |

## Financeiro

Depois do fechamento acima, tudo conferido na mesma transação:

```
venda        180,00
pagamentos   180,00   (soma == total)
comissão      32,00   (40% de 80 — só o serviço gera comissão)
financeiro   180,00   (uma entrada por pagamento)
caixa        100,00   (só o dinheiro; pix não movimenta a gaveta)
estoque      5 → 3    (2 unidades vendidas)
```

## Cancelamento

```
venda                cancelled
pagamentos           2 estornados
comissão             reversed
estoque              3 → 5  (devolvido)
estorno financeiro   180,00 como despesa
saída de caixa       100,00 (só o dinheiro volta pela gaveta)
atendimento          cancelled
auditoria            2 registros (fechamento + cancelamento)
```

## Cortesia

| Verificação | Resultado |
|---|---|
| Serviço e produto marcados como cortesia | venda com total **0,00** |
| Preço original preservado | `sale_item.unit_price` = 80,00 / 50,00 |
| Marcação | `is_courtesy = true` nos dois itens |
| **Estoque** | 5 → 4 — **o produto saiu da prateleira mesmo sem ser cobrado** |
| Pagamentos | nenhum (e informar pagamento numa venda de total zero é recusado) |
| Comissão | 0,00 |
| Motivo | gravado em `courtesy_reason` |

## Estoque e concorrência

| Verificação | Resultado |
|---|---|
| Venda acima do saldo | `ESTOQUE_INSUFICIENTE` |
| `UPDATE` direto para saldo negativo | recusado pelo CHECK `product_current_stock_non_negative` |
| Produto de outra unidade | `ITEM_ESTOQUE_INVALIDO` / `PRODUTO_INVALIDO` |
| Decisão tomada sobre leitura obsoleta | ver abaixo |

**O teste de leitura obsoleta**, que é o miolo do cenário de concorrência: leu
o saldo (4), outra operação consumiu tudo, e a venda "aprovada" contra a
leitura antiga tentou commitar → `ESTOQUE_INSUFICIENTE`, saldo final 0. É
exatamente o desfecho que a corrida real precisa ter.

**Limite honesto:** duas sessões *simultâneas* de verdade não foram
executadas. O MCP do Supabase usa uma conexão por chamada e não mantém
transação aberta entre chamadas, e não há credencial de banco nem de service
role neste ambiente para abrir duas conexões em paralelo. O que sustenta a
garantia são duas coisas verificadas: o `select ... for update` em
`apply_stock_delta` (em READ COMMITTED a transação concorrente bloqueia na
trava e relê a versão já commitada) e o CHECK de não-negatividade, que aborta
a transação mesmo se algum caminho novo esquecer a verificação. Vale um teste
de carga real antes de escalar além do piloto.

## Permissões

Testado rebaixando o papel do usuário para `staff` dentro da transação e
chamando as RPCs diretamente — ou seja, simulando exatamente a chamada HTTP
que contorna a Server Action.

| Ação | `staff` | `owner`/`admin` |
|---|---|---|
| `adjust_stock` | `FORBIDDEN` | permitido |
| `cancel_sale` | `FORBIDDEN` | permitido |
| `set_company_slug` | `FORBIDDEN` | permitido |
| `enable/disable/reset_professional_access` | `FORBIDDEN` | permitido |
| Desconto no fechamento do atendimento | `DESCONTO_NAO_AUTORIZADO` | permitido |
| Desconto no PDV | `DESCONTO_NAO_AUTORIZADO` | permitido (50 − 20 = 30) |
| Venda no preço de catálogo | permitido (R$ 50) | permitido |
| Fechar atendimento sem desconto | permitido (R$ 80) | permitido |

Este bloco encontrou um furo real que a FASE 3 não cobria: o gate
`requireCompanyManager` vive na Server Action, mas o PostgREST expõe
`/rest/v1/rpc/<função>` para qualquer portador de JWT válido, e um profissional
`staff` tem exatamente isso. Como as funções são `SECURITY INVOKER` e ele *é*
da empresa, o RLS deixava passar. Corrigido em
`20260911130000_rpc_authorization.sql`, movendo a checagem de papel para
dentro das próprias funções.

## Advisors de segurança do Supabase

Rodado depois de todas as migrations: **zero achados de nível ERROR**.

Os WARN restantes:

- `anon_security_definer_function_executable` — remanescentes são as funções
  da página pública de agendamento (`get_public_*`, `create_public_appointment`,
  `cancel_public_appointment`), `get_professional_login_email` (o login começa
  sem sessão) e as funções de trigger. Todas intencionais. As de gestão de
  acesso foram revogadas em `20260911140000`.
- `function_search_path_mutable` (4) — são as quatro funções órfãs do schema
  inicial (`meu_house_id`, `meu_role`, `atualizar_stats_cliente`,
  `registrar_entrada_caixa`), P2.1 da auditoria. Nenhuma é usada pela
  aplicação; remover é destrutivo e ficou de fora do piloto por decisão.
- `extension_in_public` — `btree_gist`, necessária para a exclusion constraint
  que impede dois agendamentos no mesmo horário. Fica onde está.
- `auth_leaked_password_protection` — chave no painel do Supabase, não no
  código. **Recomendado ligar antes do piloto.**
- `rls_enabled_no_policy` — tabela morta do schema inicial.

---

## O que ainda precisa de gente

1. **Login de profissional pelo navegador**, ponta a ponta: ativar acesso,
   entrar com identificador + senha temporária, trocar a senha no primeiro
   acesso, sair, ter o acesso desativado e tentar entrar de novo.
2. **Teste de concorrência real** com duas sessões simultâneas disputando o
   último item do estoque.
3. **Ligar a proteção de senha vazada** no painel do Supabase.
4. **Um dia de operação real** na barbearia piloto, com o time usando pelo
   celular.
