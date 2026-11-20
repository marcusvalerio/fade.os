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

### 3b. Avisos de novidades com a textura Twist
- **O quê:** novidade aparece uma vez para cada pessoa — faixa no Início (dono),
  folha no celular (barbeiro) — e fica no histórico da aba "Novidades" do sino.
  Desenho no canvas "CORTEX.OS — redesenho do sistema".
- **Por quê:** quem usa fica sabendo do que mudou sem precisar de mensagem por fora.
- **Cuidado:** reaproveitar os comunicados do Admin (`docs/notificacoes.md`) como
  um tipo "novidade", com "visto por" para não repetir. A textura fica em
  `components/textures/twist.tsx` e precisa respeitar "reduzir movimento".

### 3c. Primeiro acesso: passos 2 e 3
- **Feito:** tela de boas-vindas depois de criar a senha (`app/boas-vindas`).
- **Falta:** "Seu lugar" (foto, horários, serviços) e "Tudo pronto" (clientes
  de hoje, ativar avisos), como no canvas.

### 3d. Planos BASIC, STUDIO e PRO: cobrança e limites
- **Feito:** planos na landing e em `lib/planos.ts` (mensal e anual com 2 meses
  grátis), site sem "beta".
- **Falta:** checkout e assinatura pelo Stripe (Checkout, webhook, portal),
  trava por plano (módulos, até 2 profissionais/contas), convite de avaliador
  com 90 dias no Admin, e o "modelo Studio" sem nada de equipe/comissão.
- **Cuidado:** quem usou comissões no beta não pode perder isso de surpresa.

### 3e. Política de Privacidade: preencher e validar
- **Feito:** página `/privacidade`, linkada no rodapé da landing.
- **Falta:** responsável, CPF/CNPJ, endereço e e-mail; validação jurídica;
  Termos de Uso e contrato de operação de dados; link no login, na página de
  agendamento e em "Minha conta"; exportar/apagar dados de um cliente.

### 3f. Apagar a foto antiga ao trocar
- **O quê:** logo, foto do profissional, capa e fotos da página já sobem como
  arquivo, reduzidas no navegador (`lib/enviar-foto.ts`). Falta apagar do
  Storage o arquivo anterior quando a pessoa troca ou remove a foto e salva.
- **Cuidado:** só apagar depois que a troca foi salva no banco.

### 3g. Redesenho: telas que ainda seguem o layout antigo
- **Feito:** cores e tokens novos, menu agrupado sem bloco escuro, login,
  landing, Admin, barra de abas do barbeiro no celular.
- **Falta:** Início com faixa de números e listas; agenda em colunas por
  barbeiro; página pública de agendamento em 4 passos; selos de status
  padronizados; aviso de novidades (3b). (A busca ⌘K saiu do plano.)

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
