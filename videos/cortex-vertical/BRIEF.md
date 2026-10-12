---
workflow: product-launch-video
flow: automation
storyboard: yes
status: aguardando aprovação do storyboard — nada renderizado
message: "Sua barbearia inteira num só lugar — e ele se adapta à sua operação."
destination: instagram-reels, instagram-stories, whatsapp-status
aspect: 1080x1920
language: pt-BR
audience: donos de barbearia (do barbeiro solo à equipe grande)
length: 34s
angle: product-reveal
music: a definir (sem narração nesta versão)
cta: "Peça seu acesso ao beta." + fadeos-five.vercel.app
---

## Intenção

Apresentação curta, sofisticada e comercial do CORTEX.OS em 9:16, para
Stories/Reels. Não é um vídeo genérico de software: a linguagem é a do
próprio CORTEX — fundo Creeping Depth, o quadrado azul como símbolo, Geist em
todo texto, Panchang só no wordmark, profundidade chapada, sem gradientes,
sem círculos, movimento com `power3.out` e nada de "respiração" decorativa.

Pedido do fundador: abertura com a marca → problema ("vários sistemas e
controles") → "Conheça o Córtex" → telas reais em sequência rápida → o
onboarding que adapta a operação → os perfis (solo, estúdio, equipe, maior)
→ logo em motion → CTA do beta.

## Regras

- **Telas reais.** Toda tela vem dos componentes reais do produto
  (`app/_landing/screens.tsx`, os mesmos da landing e do filme
  `cortex-em-acao`) ou de captura do app em conta de demonstração — sempre
  com dados de exemplo. Nunca dados da Norte 21 nem de outra barbearia real.
- **Só o que existe.** Nenhuma tela que o produto não tem. Onde uma tela
  ainda não tem componente de demonstração (PDV, Estoque, onboarding), ela é
  capturada do produto real antes da produção — ver `ASSETS.md`.
- **Silencioso nesta versão.** O texto na tela é a narrativa; nenhuma frase
  depende de áudio. Trilha é decisão da produção.
- **Zonas seguras de Reels/Stories:** nada importante nos 250 px do topo
  (≈13%) nem nos 400 px de baixo (≈21%); margem lateral de 64 px. O CTA fica
  acima da faixa de interface do Instagram.

## Relação com o filme existente

`videos/cortex-em-acao` (16:9, 39 s) é a demonstração do fluxo "do horário
marcado ao caixa fechado". Este é o formato de divulgação: mais rápido, mais
marca, mais panorama. Reaproveita os mesmos componentes capturados, o mesmo
`frame.md` de tokens e as mesmas fontes (`../cortex-em-acao/assets/fonts`).
