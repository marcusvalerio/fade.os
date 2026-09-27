# 10. Catálogo e estoque

Fica em *Catálogo*: **Serviços**, **Produtos** e **Estoque**. Só dono e
gerência alteram o catálogo.

## Como eu cadastro um serviço?

*Catálogo → Serviços → Novo serviço*:

- **Nome**, **Categoria** e **Descrição**.
- **Preço (R$)** e **Duração planejada (minutos)** — a duração é o que a
  Agenda reserva e o que o atendimento usa para avisar quando um serviço
  passou do tempo.
- **Comissão padrão (%)** — o percentual que o profissional recebe por esse
  serviço.
- **Mostrar na página pública** — desmarque para um serviço interno: ele
  continua disponível no balcão, mas some da página da barbearia e do
  agendamento online.

Ao editar, aparece também o **Status** (Ativo ou Inativo).

## Depois de criar o serviço, o que falta?

Dizer **quem faz**. Na página do serviço, em *Profissionais que realizam este
serviço*, vincule os profissionais. No atendimento e no agendamento, só aparecem
para cada serviço os profissionais vinculados a ele.

## Mudar o preço altera o que já foi vendido?

Não. Cada atendimento guarda o preço e a comissão do momento em que foi
feito. A mudança vale daqui para frente.

## Como eu cadastro um produto?

*Catálogo → Produtos*, em **Novo produto**: **Nome**, **Categoria**,
**Unidade**, **Custo (R$)**, **Preço de venda (R$)**, **Quantidade inicial**
e **Estoque mínimo**. O estoque mínimo é o ponto a partir do qual o produto
aparece como crítico.

## Como eu mexo no estoque?

*Negócio → Estoque → Registrar movimentação* (só dono e gerência): escolha o
item, o tipo, a quantidade e, se quiser, um **motivo / observação**.

| Tipo | O que faz |
|---|---|
| Entrada | soma ao saldo (chegou mercadoria) |
| Consumo | tira do saldo (usado na barbearia) |
| Perda | tira do saldo (quebrou, venceu) |
| Ajuste | corrige o saldo pela quantidade informada — número negativo tira |
| Inventário (contagem) | você informa o **saldo contado na prateleira**, não a diferença; o CORTEX calcula o ajuste |

Vendas baixam o estoque sozinhas — no fechamento do atendimento e na venda
de balcão — e aparecem no histórico como *Venda*. Uma contagem que confirma
o saldo também fica registrada.

## O que a tela de Estoque mostra?

- No alto, a leitura rápida: **produtos a custo** (e quanto valem pelo preço
  de venda), **materiais a custo**, quantos itens estão **abaixo do mínimo**
  (e quantos zerados) e quantos itens existem. Os valores só aparecem para
  dono e gerência. Item com saldo e sem custo cadastrado **não entra na
  soma** — a tela avisa quantos ficaram de fora.
- **Produtos de venda** e **Materiais de consumo**, item a item: saldo,
  mínimo, custo unitário e valor. Quem está abaixo do mínimo sobe para o topo,
  marcado em amarelo (zerado, em vermelho).

## Onde vejo o que aconteceu com o estoque?

Em **Últimas movimentações**, na mesma tela: cada entrada, venda, consumo e
contagem, com data, origem (baixa pela venda, devolução por cancelamento ou
lançamento manual) e motivo.
