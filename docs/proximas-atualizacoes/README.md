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

### 3c. Primeiro acesso do barbeiro (boas-vindas)
- **O quê:** três passos na primeira entrada do barbeiro — "Boas-vindas, Rafael!
  Agora você faz parte da Barber House" (com quem convidou), "Seu lugar" (foto,
  horários definidos pelo dono, serviços) e "Tudo pronto" (clientes de hoje,
  ativar avisos, como entrar sempre pelo navegador). Desenho no canvas.
- **Cuidado:** aparece uma vez; sem prometer app (é navegador); respeitar
  "reduzir movimento".

### 3d. Planos BASIC, STUDIO e PRO
- **O quê:** BASIC (até 2 profissionais, operação), STUDIO (barbeiro com
  estrutura própria: até 2 contas, financeiro e estoque, sem comissão/equipe),
  PRO (equipe, comissões, ilimitado, várias unidades). Mensal R$ 89 / 139 / 179;
  anual com 2 meses grátis: R$ 890 / 1.390 / 1.790. Venda direta, sem "beta" no
  site; beta só por convite (avaliadores, 90 dias). Na landing, o STUDIO aparece
  no modo claro para se destacar.
- **Cuidado:** hoje nada é travado por plano — falta a trava de módulos e de
  número de profissionais antes de janeiro de 2027. Quem usou comissões no beta
  não pode perder isso de surpresa. Ao definir, atualizar `lib/beta.ts` e
  `docs/landing-promessas.md`.

### 3e. Política de Privacidade (LGPD) e Termos de Uso
- **O quê:** rascunho da política escrito no doc "CORTEX.OS — Política de
  Privacidade"; falta a página no site, os Termos de Uso e o contrato de operação
  de dados com a barbearia.
- **Cuidado:** validar com advogado antes de publicar; produto precisa de
  exportar/apagar dados de um cliente e de rotina que apaga dados vencidos.

### 3f. Apagar a foto antiga ao trocar
- **O quê:** logo, foto do profissional, capa e fotos da página já sobem como
  arquivo, reduzidas no navegador (`lib/enviar-foto.ts`). Falta apagar do
  Storage o arquivo anterior quando a pessoa troca ou remove a foto e salva.
- **Cuidado:** só apagar depois que a troca foi salva no banco.

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
