# 2. Quem vê o quê

O CORTEX tem quatro jeitos de estar na barbearia. O menu mostra a cada pessoa
só o que ela usa, e **a permissão também é conferida no banco de dados** —
esconder um item do menu não é a única barreira.

| Área | Dono / gerência | Recepção | Barbeiro |
|---|:---:|:---:|:---:|
| Agenda | ✔ | ✔ | ✔ |
| Atendimento | ✔ | ✔ | ✔ |
| Clientes | ✔ | ✔ | ✔ |
| Nova venda (balcão) | ✔ | ✔ | — |
| Caixa | ✔ | ✔ | — |
| Início (números do negócio) | ✔ | — | — |
| Vendas | ✔ | — | — |
| Catálogo e estoque | ✔ | — | — |
| Equipe e comissões | ✔ | — | — |
| Financeiro | ✔ | — | — |
| Configurações | ✔ | — | — |

Quem abre uma área que não é sua (por um link antigo, por exemplo) vê
*"Esta área é da gestão"* e um atalho para a Agenda.

## Desconto e cortesia precisam de autorização?

Sim, para quem não é dono nem gerente. Recepção e barbeiros aplicam desconto
ou cortesia informando o **código de autorização** da barbearia, que só a
gestão conhece (veja [Configurações → Autorização](13-configuracoes.md)). Dono
e gerência autorizam pelo próprio papel, sem código.
