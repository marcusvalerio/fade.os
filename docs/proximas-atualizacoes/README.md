# Próximas atualizações

Ideias levantadas e ainda não feitas. Cada uma diz o que é, por que importa
e o cuidado que precisa ter. Quando uma for feita, sai daqui e a promessa
correspondente entra em `docs/landing-promessas.md`.

## Sistema

### 1. Lembrete automático para o cliente
- **O quê:** aviso enviado sozinho antes do horário (ex.: 1 dia e 2 horas antes).
- **Por quê:** reduz falta. Hoje a landing deixa claro que esse envio não existe.
- **Cuidado:** o envio pelo WhatsApp precisa da API oficial (custo e aprovação
  da Meta). Dá para começar com push para clientes com conta e e-mail.
  A base de lembretes já existe (`pg_cron`, `docs/notificacoes.md`).

### 2. Mensagem pronta para quem sumiu
- **O quê:** na lista "Clientes para chamar hoje", a mensagem já escrita com o
  nome, o último serviço e o link de agendamento, num toque (`wa.me`).
- **Por quê:** traz o cliente de volta sem o dono pensar no texto.
- **Cuidado:** só para quem deu consentimento; o envio continua sendo da barbearia.

### 3. Pagamento de comissão por Pix
- **O quê:** em Comissões, gerar o Pix (copia e cola / QR) do valor devido a
  cada profissional e registrar o pagamento.
- **Por quê:** hoje o pagamento é registrado no CORTEX, mas o dinheiro sai por fora.
- **Cuidado:** começar só gerando o código Pix com a chave do profissional;
  integração bancária fica para depois.

## Landing

### 4. Vídeo de demonstração em destaque
- **O quê:** usar o vídeo "CORTEX em ação" (`videos/cortex-em-acao`) num lugar
  visível, logo depois do topo ou no botão "Ver demonstração".
- **Cuidado:** carregar só quando a pessoa der play (o arquivo é pesado).

### 5. "Pedir acesso" sempre visível no celular
- **O quê:** em telas com menos de ~380px o botão some do menu do topo.
- **Cuidado:** caber ao lado da marca e do "Entrar" sem quebrar a linha.

### 6. Depoimentos reais
- **O quê:** a seção `ProvaSocial` já existe e fica escondida sem depoimentos.
- **Cuidado:** só entra depoimento autorizado de barbearia do Beta. Nunca inventado.

## Pendências de configuração
- Definir `NEXT_PUBLIC_SITE_URL` na Vercel com o domínio oficial (imagem de
  compartilhamento e sitemap dependem disso).
- Branches antigas para limpar: `feat/cortex-motion-system-*`, `tmp`,
  `fix/landing-blur` (a landing que ele corrigia não existe mais).
