# 6. Clientes

## Como eu encontro um cliente?

Em *Clientes*, pela busca: ela procura pelo **nome** e pelo **telefone**. Se
não encontrar, a própria tela oferece cadastrar com o nome buscado.

## O que é "Clientes para chamar hoje"?

É a lista, no alto da tela, de quem passou do próprio ritmo de volta. O
CORTEX calcula de quanto em quanto tempo **cada cliente** costuma voltar
(comparando o cliente com ele mesmo, nunca com a média da barbearia) e marca
a situação:

| Situação | Quando |
|---|---|
| ativo | dentro do ritmo, ou com menos de duas visitas |
| atenção | passou 1,5× o próprio intervalo |
| recuperação | passou 2,5× o próprio intervalo |
| inativo | passou 4× o próprio intervalo |

Exemplo: quem costuma voltar a cada 30 dias e está há 52 dias sem vir aparece
em *atenção*. Na lista geral, "ativo" não é repetido em cada linha — só as
situações que pedem ação aparecem.

A lista vem em ordem de urgência (quem passou mais do próprio ritmo primeiro)
e cada linha já tem a ação:

- **WhatsApp** — abre a conversa com uma mensagem de retorno pronta, com o
  nome do cliente e da barbearia. Só aparece para quem **autorizou contato**
  (consentimento na ficha) e tem telefone; nos outros casos a linha diz *sem
  autorização de contato* ou *sem telefone*.
- **Agendar** — abre o novo agendamento com o cliente já escolhido.

O CORTEX **não envia** mensagem sozinho nem em massa: quem envia é você, uma
conversa por vez.

## O que tem na ficha do cliente?

Na ordem em que se usa no balcão:

1. **Quem é e como está** — nome, telefone, a situação, de quanto em quanto
   tempo costuma voltar, há quantos dias foi a última visita e a anotação
   sobre o cliente (preferências, observações).
2. **Relacionamento** — última visita, número de visitas, ticket médio e o
   serviço mais pedido.
3. **Histórico de atendimentos** — o que foi feito, por quanto e por quem.
4. **Dados e contato** — recolhido; toque em *Editar* para mudar nome,
   telefone, e-mail, aniversário, anotação e consentimento de contato.

No alto da ficha ficam as ações: **Agendar** (novo agendamento com o cliente
escolhido), **Atender agora** (atendimento sem hora marcada, já com o cliente)
e **WhatsApp** (só com consentimento de contato e telefone).

Vendas feitas pela *Nova venda* (balcão) não entram no histórico do cliente:
o histórico é feito de atendimentos.
