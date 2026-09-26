---
workflow: product-launch-video
flow: automation
storyboard: no
message: "CORTEX.OS é um sistema operacional para gestão: sofisticado, preciso e muito bem projetado."
destination: youtube
aspect: 1920x1080
language: pt-BR
audience: donos e gestores de barbearias e estúdios de beleza
length: 15s
angle: show-it-as-is
---

## Intent

Trailer oficial de lançamento do CORTEX.OS: um produto de software real, e não um conceito.
Quem assistir deve pensar: "Isso é um sistema operacional para gestão. É sofisticado, preciso e
muito bem projetado." Estética premium, tecnológica, minimalista, editorial, precisa, silenciosa,
com bastante espaço negativo, microinterações elegantes e movimentos suaves e intencionais.
Referências de sensação: Linear, Raycast, Vercel, Stripe, Apple, sem copiar nenhuma delas. O
CORTEX.OS mantém a própria identidade.

Show-it-as-is: os estados reais capturados da aplicação SÃO os assets do vídeo. "Se alguém pausar o
vídeo em qualquer momento, deve parecer que está vendo uma tela real do produto." "Não quero um
vídeo inspirado no CORTEX.OS. Quero um vídeo feito a partir do CORTEX.OS."

Estrutura pedida:
01 Identidade (0–2 s): quase vazio; CORTEX.OS surge de forma extremamente limpa, com uma
   microanimação coerente com o produto.
02 O sistema ganha vida (2–5 s): tela real principal em escala cinematográfica, câmera sutil, UI legível.
03 Agenda / operação (5–8 s): agenda real (dia, horários, status, linha do agora, ações,
   profissionais) com uma interação real: selecionar → a interface responde.
04 Profundidade (8–11 s): transição elegante para outra área real, navegando dentro de um único sistema.
05 CORTEX.OS (11–15 s): última visão poderosa, a UI se afasta, CORTEX.OS + tagline real.

## Assets

- ../../showreel/cortex/captures/ — 16 estados reais da aplicação rodando (4320×2430, DSF 3, viewport
  1440×810), capturados por showreel/cortex/capture.mjs contra o Next.js deste repo + Supabase local
  com seed via as RPCs reais. `manifest.json` traz a geometria do DOM de cada elemento usado pela
  câmera e pelo cursor. Estados: inicio, inicio-hover, inicio-press, agenda, agenda-hover,
  agenda-press, agenda-pending, agenda-result, agenda-press-subnav, atendimentos(-hover/-press),
  atendimento(-hover/-press), modal, modal-press, inicio-final.
- app/fonts/Panchang-Variable.woff2 — fonte da marca (Wordmark). Geist — fonte da UI.
- components/ui/cortex-mark.tsx / components/ui/wordmark.tsx — geometria do CortexMark e medidas do lockup.

## Customizations

- Letreiro: nome CORTEX.OS e o tagline real "Sistema operacional para barbearias" (app/Landing.tsx).
  Nenhuma frase de marketing inventada, nenhum CTA.
- Movimento guiado pelos tokens do produto (app/globals.css): --ease-emphasized, durações
  micro/interação/transição/momento, rise-in de 6 px, scale-in 0.97 do <dialog>, cortex-resolve.
- Trilha discreta própria (sem narração): um leito grave, ticks na digitação da marca, cliques de UI e
  um acorde aberto no letreiro.

## Notes

- Evitar completamente: partículas, explosões, glitch, neon excessivo, círculos aleatórios, formas sem
  função, gráficos inventados, palavras aleatórias, estética cyberpunk, excesso de motion, efeitos que
  atrapalhem a leitura da UI.
- Sem narração; o vídeo não usa legendas.
- A captura via `hyperframes capture` não se aplica: o app exige login e a história precisa de estados
  de interação (hover, :active, pendente, resultado) que só a captura dirigida produz.
