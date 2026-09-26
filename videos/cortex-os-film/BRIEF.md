---
workflow: product-launch-video
flow: automation
storyboard: no
message: "A operação inteira da barbearia, conectada em um único sistema."
destination: instagram-reels
aspect: 1080x1920
language: pt-BR
audience: donos e gestores de barbearias que ainda não conhecem o CORTEX.OS
length: 15s
angle: product-film
---

## Intent

Product launch film / motion showreel do CORTEX.OS para Stories, Reels e apresentações. Deve
comunicar ao mesmo tempo O QUE É (um sistema operacional para barbearias), O QUE RESOLVE (centraliza
e organiza a operação), O QUE FAZ (conecta agenda, atendimento, clientes, vendas, caixa, estoque,
financeiro e gestão) e QUAL É O DIFERENCIAL (não são ferramentas isoladas, é uma operação conectada).
Percepção: premium, tecnológico, preciso, sofisticado, moderno, confiável, minimalista, editorial,
desejável. Um lançamento de software cuidadosamente projetado.

Narrativa: OPERAÇÃO → CONEXÃO → CONTROLE → CORTEX.OS.
Ritmo: silêncio (0–2) → construção (2–6) → aceleração (6–11) → revelação (11–13) → assinatura (13–15).

"NÃO CRIE UM SLIDESHOW DE SCREENSHOTS." "Não mostre apenas a interface. ANIME A INTERFACE. TRANSFORME
ELEMENTOS DA INTERFACE EM ELEMENTOS VISUAIS DA NARRATIVA." Linguagem de motion da referência
(escala radical, macro → micro → macro, tipografia como movimento, objetos que viram outros objetos,
transições contínuas, camadas, espaço negativo), sem copiar a identidade dela.

## Assets

- DOM real da aplicação: `harvest.mjs` dirige o CORTEX.OS rodando (Next.js deste repo + Supabase local
  com seed via RPCs reais) e colhe o HTML dos componentes reais em cada estado, junto com o CSS
  compilado de produção e as fontes (`assets/app/`). Os componentes entram nas composições como DOM
  vivo, não como imagem.
- CortexMark / Wordmark (components/ui) e as fontes Panchang e Geist do produto.

## Customizations

- Vertical nativo 1080×1920: tipografia ocupando a tela, UI entrando pelo topo e pela base, zooms profundos.
- Textos só do produto: nomes reais de módulos (Agenda, Atendimento, Clientes, Vendas, Caixa, Estoque,
  Financeiro…), status reais, valores reais. Tagline oficial: "Sistema operacional para barbearias"
  (app/Landing.tsx).
- Sound design mínimo: clicks, UI sounds, whooshes discretos e impactos sutis.

## Notes

- Evitar: slideshow, zoom/pan lento em screenshot, fades genéricos entre telas, mockups de notebook,
  UI parada, cyberpunk, neon, black & gold, clichês de barbearia (navalha, tesoura, barba, poste,
  bigode), partículas, formas sem função, glitch, glow excessivo, estética "AI".
- Não inventar telas, funcionalidades, dados sem sentido ou slogans.
- Teste final: produto, diferencial, design, motion, identidade, vertical e desejo.
