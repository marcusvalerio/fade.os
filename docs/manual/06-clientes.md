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

1. **Quem é e como está** — nome, telefone, e-mail, a situação, se **aceita
   contato pelo WhatsApp**, se **tem conta na página da barbearia** e a
   anotação sobre o cliente.
2. **Próximo atendimento** — o horário que ele já tem marcado, com atalho
   para abrir.
3. **Relacionamento** — última visita, visitas, **frequência** (de quanto em
   quanto tempo volta; precisa de duas visitas), ticket médio, **serviços
   mais usados**, **profissional preferido** (só quando há pelo menos duas
   visitas com a mesma pessoa e sem empate) e o gasto total. Faltas e
   cancelamentos pela página aparecem logo abaixo, quando existem.
4. **Histórico de atendimentos** — os 15 mais recentes; *Ver todos* mostra o
   resto.
5. **Dados, observações e consentimento** — recolhido; toque em *Editar*.

No alto da ficha ficam as ações: **Agendar**, **Atender agora** e
**WhatsApp** (só com consentimento de contato e telefone).

Vendas feitas pela *Nova venda* (balcão) não entram no histórico do cliente:
o histórico é feito de atendimentos.

## Como eu trago a lista de clientes que já tenho?

*Clientes → Importar planilha* (só dono e gerência). Aceita **.xlsx** (Excel,
Google Planilhas) e **.csv**; arquivos .xls antigos precisam ser salvos como
.xlsx antes. Até 2.000 clientes por arquivo.

1. **Arquivo** — a primeira linha precisa ser o cabeçalho (Nome, Telefone…).
   O arquivo é lido no seu navegador; ele não sobe para lugar nenhum.
2. **Colunas** — o CORTEX sugere qual coluna é o quê pelo nome; confira. Só
   *Nome* é obrigatório. Dá para juntar *Nome* e *Sobrenome*.
3. **Conferir** — cada linha aparece como *Entra*, *Já cadastrado*,
   *Repetido no arquivo* ou *Não entra*, com o motivo. Telefone, e-mail ou
   nascimento inválidos não barram a pessoa: ela entra sem aquele dado, e a
   linha avisa.
4. **Pronto** — o relatório diz quantos entraram e o que ficou de fora.

Regras:

- **Duplicado** é o mesmo telefone ou o mesmo e-mail — no arquivo ou já
  cadastrado. Sem telefone nem e-mail, vale o nome.
- **Consentimento de contato** só é marcado quando a planilha tem uma coluna
  dizendo "sim". Sem ela, ninguém importado recebe mensagem.
- Importar o mesmo arquivo de novo não duplica ninguém.
