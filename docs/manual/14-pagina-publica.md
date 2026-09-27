# 14. Página da barbearia

Cada barbearia tem uma página própria no endereço escolhido em
[Configurações → Página pública](13-configuracoes.md). É por ela que o
cliente vê a barbearia e marca horário sozinho — sem conta ou com a própria
conta de cliente, como ele preferir.

## O que o cliente vê?

- O nome da barbearia, a capa e o Instagram, quando configurados.
- A **nota média** e o número de avaliações, quando já houver alguma.
- **Serviços** (só os marcados para aparecer na página pública), **Equipe**,
  **Horário de funcionamento** e **Formas de pagamento**.
- A apresentação em duas páginas, se você a preencheu.
- O botão **Agendar horário**.

## Como o cliente marca um horário?

Em **Agendar horário**, passo a passo:

1. **Serviço** — um ou mais. A duração e o preço somam.
2. **Profissional** — só aparece quando há mais de um que faça todos os
   serviços escolhidos. Há a opção **Qualquer profissional**.
3. **Data** e **Horário** — só os horários livres, dentro do funcionamento da
   unidade e fora dos bloqueios e ausências da equipe. São os mesmos horários
   que a equipe vê ao agendar pela Agenda: o que aparece aqui dá para
   reservar de verdade.
4. **Dados** — **Nome** e **Telefone / WhatsApp** (com DDD); o **E-mail** é
   opcional. Quem entrou na conta de cliente pula este passo: os dados já
   vêm da conta.
5. **Revisão** e confirmação.

O horário entra na [Agenda](04-agenda.md) como *Agendado*. A confirmação com o
cliente é feita pela barbearia, pelo botão **WhatsApp** da agenda — o CORTEX
não envia mensagens sozinho.

## O cliente consegue ver ou cancelar o agendamento depois?

Sim, pelo **link do agendamento**, que aparece para ele logo depois de
marcar. Nesse link ele vê o serviço, o profissional, a data, a duração e o
estado do horário, e pode:

- **Cancelar agendamento** — enquanto o horário estiver *Agendado* ou
  *Confirmado*. O horário volta a ficar livre.
- **Avaliar o atendimento** — depois que ele for *Concluído*, com uma nota e,
  se quiser, um comentário. A nota entra na média da página.

## O cliente tem login?

Pode ter, se quiser — marcar sem conta continua valendo. No topo da página da
barbearia, **Meus horários** leva ao acesso do cliente
(`/<endereço-da-barbearia>/entrar`), com duas formas de entrar:

- **E-mail e senha** — em *Criar conta* ele informa nome, e-mail, telefone
  (opcional) e senha, e confirma o e-mail pelo link que chega na caixa de
  entrada.
- **Continuar com o Google** — aparece quando o login pelo Google está ligado
  no CORTEX.

Na conta ele vê **Próximos horários** e o **Histórico** naquela barbearia,
abre cada horário para cancelar ou avaliar e, em **Marcar horário**, marca um
novo sem digitar os dados de novo. **Sair** encerra a sessão.

A conta de cliente é separada da equipe: ela não dá acesso a nenhuma tela de
gestão. O vínculo com a barbearia é feito pelo **e-mail confirmado** — se a
barbearia já tinha o cliente cadastrado com aquele e-mail, os horários entram
no mesmo cadastro; se não, o cadastro nasce na primeira visita.

O link do agendamento (o de cada horário) continua funcionando para quem não
tem conta.
