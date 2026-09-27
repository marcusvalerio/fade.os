# 9. Vendas

Tudo o que foi vendido — por atendimento fechado ou venda de balcão. Só dono
e gerência veem esta tela.

## Como eu cancelo uma venda?

Na venda, **Cancelar venda**, informando o **motivo** (obrigatório), que fica
registrado junto do cancelamento. Cancelar é para corrigir um registro
errado; não existe desfazer.

## O que o cancelamento desfaz?

Tudo de uma vez, sem apagar o histórico — cada correção vira um lançamento
novo:

- **Pagamentos** — marcados como estornados.
- **Financeiro** — um *estorno* para cada pagamento.
- **Caixa** — se houve dinheiro, a devolução sai do **caixa aberto agora**
  (não do caixa do dia da venda). Por isso, cancelar uma venda paga em
  dinheiro exige um caixa aberto.
- **Estoque** — os produtos voltam para o saldo.
- **Comissões** — as comissões daquela venda deixam de ser devidas.
- **Atendimento** — se a venda veio de um atendimento, ele passa a
  cancelado.
