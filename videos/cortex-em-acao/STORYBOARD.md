---
format: 1920x1080
duration: 38.8s
message: "Do horário marcado ao caixa fechado: o CORTEX.OS acompanha um atendimento inteiro — do celular do cliente ao caixa e à comissão."
arc: Hook → Demo cycle (celular → agenda → atendimento → caixa) → Benefit → CTA
audience: donos e gerentes de barbearia
mode: autonomous
music: none
language: pt-BR
---

Filme silencioso. O `voiceover` de cada frame é o TÍTULO na tela (não há narração nem trilha de legenda) — é ele que dá o ritmo das revelações. Todas as telas são capturas 2x dos componentes reais do CORTEX (capture/assets/ui), com dados de exemplo; nunca são redesenhadas em HTML.

## Video direction

- **Ground**: Creeping Depth `#041723` chapado em todos os frames, uma única luz ambiente azul (Kahu Blue a ~8%) atrás da superfície do produto (`ambient-glow-bloom`, estática). Nada de gradiente de fundo, partículas ou grid.
- **Grade de palco (frames 2–7)**: coluna de texto à esquerda (x 128 → 648, bloco começando em y≈330) e superfície do produto à direita (x ≥ 720). Tudo acima de y = 900 (faixa de legenda reservada, mesmo sem legenda).
- **Coluna de texto**: eyebrow `0N / 05` (número em Kahu Blue, resto em texto apagado, 22px, tracking aberto), título Geist 600 ~76px / 1.0 / tracking −0.04em em Bright White, sub-rótulo Geist 400 ~28px em texto apagado, no máximo uma linha curta por frame. O título É a legenda do filme (silencioso): é o único texto que carrega a narrativa, e ele entra primeiro; o sub-rótulo entra na metade de trás, no beat que ele comenta.
- **Superfícies**: janelas e celulares são as PNGs reais, escala única por tipo (janelas de desktop a 0,75 da captura; celular a 0,66), contorno de 1px claro (frame.md: profundidade chapada, sem sombra decorativa; só o popover e o modal ganham uma sombra curta, porque estão de fato por cima). As janelas nunca são recortadas nem redesenhadas; só crossfade entre capturas do mesmo enquadramento (os pixels iguais não mudam, só o que mudou aparece mudando).
- **Atores**: ponteiro de mouse (SVG branco com contorno ink) nas telas de desktop; toque (círculo Kahu Blue translúcido com anel branco) no celular. Todo clique tem press + ripple (`cursor-click-ripple`, `press-release-spring`). Só clicamos no que existe e faz exatamente aquilo no produto: Continuar, WhatsApp, Confirmar, Fechar e receber, Confirmar e fechar. Onde o produto tem passos que não foram capturados (Cliente chegou → Iniciar atendimento), não há clique: a mudança é mostrada como passagem de tempo.
- **Ênfase**: anel de foco (retângulo arredondado, 2px Kahu Blue + halo suave) que se acende sobre a região que acabou de mudar (`ai-tracking-box` como contorno simples). No máximo um anel por vez.
- **Movimento**: `power3.out` em tudo (long-tail, sem overshoot). Câmera travada por padrão; um único push leve no frame 5. Nada de respiração, drift ou loop. Seams internos são crossfades de 0,3–0,4s.
- **Tipografia**: Geist (arquivos locais em assets/fonts) em todo texto; Panchang só no wordmark CORTEX.OS do frame 8.

## Frame 1 — O conceito

- type: hook
- src: compositions/frames/01-conceito.html
- blueprint: kinetic-type-beats
- duration: 3.6s
- transition_in: cut
- status: animated
- scene: "Do horário marcado" entra, "ao caixa fechado." completa a frase; o ponto azul da marca pisca uma vez.
- voiceover: "Do horário marcado — ao caixa fechado."
- focal: a frase em duas linhas, centrada à esquerda
- roles: tipografia pura sobre o ground

Abre na promessa, sem descrever empresa. O ponto final da frase em Kahu Blue antecipa o ponto do wordmark que fecha o filme.

Scene 1 (0.0–1.3s): ground ink chapado; "Do horário marcado" monta palavra a palavra em Geist 600 ~128px, alinhada à esquerda em x=128, linha de base perto de y≈430 (**per-word staggered reveal** → `dynamic-content-sequencing`, subida curta + fade, `power3`). Scene 2 (1.3–2.4s): "ao caixa fechado" entra na segunda linha como um bloco, mesmo movimento; o ponto final ainda não existe. Scene 3 (2.4–3.6s): o ponto final aparece em Kahu Blue com um **spring-pop** suave (`spring-pop-entrance`, settle long-tail, sem overshoot) e segura parado até o corte — é o único elemento de cor do frame.

## Frame 2 — Marcou pelo celular

- type: product_intro
- src: compositions/frames/02-celular.html
- blueprint: device-surface-showcase
- duration: 5.4s
- transition_in: crossfade
- status: animated
- scene: O celular do cliente sobe ao centro com a página da barbearia; toque em Continuar, a tela vira "Agendamento confirmado".
- voiceover: "Marcou pelo celular."
- asset_candidates: assets/phone-servicos.png — captura real do CORTEX; assets/phone-confirmado.png — captura real do CORTEX
- focal: assets/phone-servicos.png
- roles: assets/phone-servicos.png — cutout (celular inteiro, tela "Agendar horário" com Corte + Barba escolhido); assets/phone-confirmado.png — cutout (mesmo celular, tela "Agendamento confirmado" às 09:30)

Primeiro loop completo do produto: o cliente resolve sozinho, na página da própria barbearia. Variante static-tour: câmera parada, todo o movimento é do celular e da tela.

Scene 1 (0.0–1.2s): o celular (`phone-servicos`, 370×789, canto em x=1071 y=100) sobe ~60px e assenta (`spring-pop-entrance`, `power3`, sem overshoot); a luz ambiente azul atrás dele. Eyebrow `01 / 05` e título "Marcou pelo celular." entram na coluna esquerda logo em seguida (fade + subida curta). Scene 2 (1.2–2.3s): o **anel de foco** acende sobre o cartão "Corte + Barba" já escolhido (`ai-tracking-box` como contorno simples). Scene 3 (2.3–3.1s): o toque entra e pressiona "Continuar" (centro no canvas ≈ 1255, 695) — **press + ripple** (`cursor-click-ripple`). Scene 4 (3.1–5.4s): a tela troca para `phone-confirmado` por **scale-swap** curto dentro da moldura (`scale-swap-transition`: a tela antiga recua levemente e some, a nova chega do mesmo centro); em 3.6s entra o sub-rótulo "Na página da barbearia, sem ligar."; segura parado.

## Frame 3 — Na agenda, pronto para confirmar

- type: feature_showcase
- src: compositions/frames/03-agenda.html
- blueprint: cursor-ui-demo
- duration: 6.2s
- transition_in: crossfade
- status: animated
- scene: A Agenda entra; a linha de Bruno Alves (Agendado) se destaca; a mensagem pronta do WhatsApp aparece ao lado; toque em Confirmar e o estado vira Confirmado.
- voiceover: "Caiu na agenda. Confirmou pelo WhatsApp."
- asset_candidates: assets/agenda-s1.png — captura real do CORTEX; assets/mensagem.png — captura real do CORTEX; assets/agenda-s2.png — captura real do CORTEX
- focal: assets/agenda-s1.png
- roles: assets/agenda-s1.png — cutout (janela da Agenda, Bruno Alves 09:30 Agendado com WhatsApp e Confirmar); assets/mensagem.png — supporting (cartão "Mensagem pronta · WhatsApp", popover sobre a janela); assets/agenda-s2.png — cutout (mesma janela, Bruno Confirmado com "Cliente chegou")

A mesma linha, mudando de estado — o registro é um só. Variante static-stage tour: câmera travada, o ponteiro é o ator.

Scene 1 (0.0–1.1s): a janela da Agenda (`agenda-s1`, 1069×781, canto em x=720 y=112) sobe e assenta (`spring-pop-entrance`); eyebrow `02 / 05` e a primeira linha do título "Caiu na agenda." entram; o **anel de foco** acende sobre a linha do Bruno (canvas 800, 605, 988×96) (`ai-tracking-box`). Scene 2 (1.1–2.3s): o ponteiro entra pela direita-baixo e desliza até "WhatsApp" (≈ 1544, 652), clica (`cursor-click-ripple` + `press-release-spring`); o cartão `mensagem` (435×335, ancorado acima do botão, x≈1355 y≈250) nasce do botão com **spring-pop** (`spring-pop-entrance`). Scene 3 (2.3–3.7s): a segunda linha do título "Confirmou pelo WhatsApp." entra; o sub-rótulo "Mensagem pronta, é só enviar." entra logo abaixo; segura. Scene 4 (3.7–4.6s): o ponteiro vai a "Confirmar" (≈ 1696, 652) e clica; a janela troca de `agenda-s1` para `agenda-s2` por crossfade de 0,35s no mesmo enquadramento (`dynamic-content-sequencing`) — só a linha muda: Agendado → Confirmado, surge "Cliente chegou"; o cartão da mensagem recua para o botão e some junto (a conversa foi enviada). Scene 5 (4.6–6.2s): o anel de foco segura na linha já confirmada; o ponteiro repousa ao lado; nada mais se move.

handoff_out: agenda-s2 window — x=720, y=112, scale 0.75 (1069×781), opacity 1, parada (velocidade 0); anel de foco sobre a linha do Bruno (800, 605, 988×96), opacity 1; ponteiro em repouso em (1760, 720), opacity 1; coluna de texto: eyebrow e título em opacity 1 (serão trocados no corte).

## Frame 4 — Chegou, sentou, começou

- type: feature_showcase
- src: compositions/frames/04-atendimento-inicia.html
- blueprint: cursor-ui-demo
- duration: 4.4s
- transition_in: cut
- status: animated
- scene: A linha vira Em atendimento com trilho azul e os contadores do topo mudam (Em atendimento 0→1, Restantes 3→2) — sem clique: é passagem de tempo.
- voiceover: "Chegou, sentou, começou."
- asset_candidates: assets/agenda-s2.png — captura real do CORTEX; assets/agenda-s3.png — captura real do CORTEX
- focal: assets/agenda-s3.png
- roles: assets/agenda-s2.png — cutout (estado de entrada, idêntico ao fim do frame 3); assets/agenda-s3.png — cutout (Bruno Em atendimento; contadores 0 · 1 · 2 · 1)

No produto são dois toques (Cliente chegou → Iniciar atendimento) e o estado intermediário não foi capturado; por isso não há clique aqui — as três palavras do título marcam o tempo passando.

handoff_in: agenda-s2 window — x=720, y=112, scale 0.75 (1069×781), opacity 1, parada; anel de foco sobre a linha do Bruno (800, 605, 988×96), opacity 1; ponteiro em (1760, 720), opacity 1.

Scene 1 (0.0–1.5s): corte seco — a janela, o anel e o ponteiro continuam exatamente onde estavam; na coluna esquerda o eyebrow vira `03 / 05` e o título monta palavra a palavra "Chegou," · "sentou," · "começou." (**per-word staggered reveal** → `dynamic-content-sequencing`), uma palavra a cada ~0,45s; o ponteiro sai de cena descendo e desvanecendo nos primeiros 0,4s (não há mais clique neste frame). Scene 2 (1.5–1.9s): no "começou." a janela troca de `agenda-s2` para `agenda-s3` por crossfade de 0,35s — a linha ganha o trilho azul e "Em atendimento"; os contadores do topo mudam no mesmo instante. Scene 3 (1.9–2.9s): o anel de foco viaja da linha para os contadores (830, 283, 928×121) (`ai-tracking-box`, translate + scale, `power3`). Scene 4 (2.9–4.4s): sub-rótulo "Os contadores do dia acompanham." entra; segura parado.

## Frame 5 — Fechou e recebeu

- type: feature_showcase
- src: compositions/frames/05-fechar.html
- blueprint: cursor-ui-demo
- duration: 5.4s
- transition_in: crossfade
- status: animated
- scene: O atendimento aberto (Corte + Barba + pomada, R$ 112); toque em "Fechar e receber"; o modal entra com Dinheiro e "Pagamento completo"; toque em "Confirmar e fechar".
- voiceover: "Fechou e recebeu."
- asset_candidates: assets/atendimento.png — captura real do CORTEX; assets/modal.png — captura real do CORTEX
- focal: assets/modal.png
- roles: assets/atendimento.png — cutout (janela do atendimento do Bruno, total R$ 112,00, botão Fechar e receber); assets/modal.png — cutout (modal "Fechar atendimento": Dinheiro 112,00, Pagamento completo, Confirmar e fechar)

Variante static-stage tour com um único push leve: o modal nasce do centro sobre a janela escurecida.

Scene 1 (0.0–1.0s): a janela do atendimento (`atendimento`, 1069×552, canto em x=720 y=180) sobe e assenta; eyebrow `04 / 05` e título "Fechou e recebeu." entram. Scene 2 (1.0–1.9s): o ponteiro entra e clica em "Fechar e receber" (≈ 1651, 626) (`cursor-click-ripple` + `press-release-spring`). Scene 3 (1.9–2.8s): a janela escurece e desfoca de leve (`depth-of-field-blur`) enquanto o modal (`modal`, 547×488, centrado sobre a janela, canto em x=981 y=212) nasce com **spring-pop** do centro (`spring-pop-entrance`); um push curto de câmera (1.00 → 1.05, centrado no modal) acompanha a chegada e para (`coordinate-target-zoom`). Scene 4 (2.8–3.6s): sub-rótulo "R$ 112,00 em dinheiro." entra. Scene 5 (3.6–5.4s): o ponteiro vai até "Confirmar e fechar" (≈ 1359, 633 no enquadramento do modal) e dá um **press** mais firme (`physics-press-reaction`: ponteiro e botão comprimem juntos) em ~4.2s; segura parado — a consequência é o próximo frame.

## Frame 6 — Caixa e comissão

- type: benefit_highlight
- src: compositions/frames/06-caixa.html
- blueprint: device-surface-showcase
- duration: 5.2s
- transition_in: crossfade
- status: animated
- scene: O Caixa: o saldo esperado passa de R$ 445 para R$ 557, a venda de R$ 112 entra no topo das movimentações e a comissão de Diego aparece devida.
- voiceover: "No caixa e na comissão, no mesmo instante."
- asset_candidates: assets/caixa-antes.png — captura real do CORTEX; assets/caixa-depois.png — captura real do CORTEX
- focal: assets/caixa-depois.png
- roles: assets/caixa-antes.png — cutout (Caixa do balcão aberto, saldo R$ 445,00, sem a venda nova); assets/caixa-depois.png — cutout (saldo R$ 557,00, Venda 10:34 +R$ 112,00 destacada, comissões com Diego Ramos R$ 30,00 devida)

A consequência do toque do frame anterior — causa e efeito em sequência. Câmera travada; o movimento é o estado mudando e o anel de foco descendo pela tela (variante static-tour).

Scene 1 (0.0–0.9s): a janela do Caixa (`caixa-antes`, canto em x=740 y=70, escala 0.72 → 1026 de largura) assenta; eyebrow `05 / 05` e título "No caixa e na comissão." entram. Scene 2 (0.9–1.3s): crossfade de 0,35s de `caixa-antes` para `caixa-depois` (mesmo canto, mesma escala; a janela cresce para baixo até y≈895) — o saldo vira R$ 557,00 e a venda de R$ 112,00 aparece no topo das movimentações (`dynamic-content-sequencing`). Scene 3 (1.3–2.6s): o **anel de foco** acende sobre o saldo (canvas 847, 239, 888×71) e desce para a venda nova (847, 358, 888×82) (`ai-tracking-box`). Scene 4 (2.6–3.6s): o anel desce até a linha do Diego Ramos nas comissões (847, 682, 888×91). Scene 5 (3.6–5.2s): sub-rótulo "No mesmo instante, sem digitar de novo." entra; segura parado.

## Frame 7 — A semana sem planilha

- type: benefit_highlight
- src: compositions/frames/07-inicio.html
- blueprint: titlecard-reveal
- duration: 4.4s
- transition_in: crossfade
- status: animated
- scene: O Início (indicadores vs. período anterior) entra, e a lista de Clientes em atenção/recuperação sobrepõe à direita.
- voiceover: "Os números saem da operação."
- asset_candidates: assets/inicio.png — captura real do CORTEX; assets/clientes.png — captura real do CORTEX
- focal: assets/inicio.png
- roles: assets/inicio.png — cutout (Início, últimos 7 dias: faturamento, recebido, ticket médio, atendimentos e serviços mais realizados); assets/clientes.png — cutout (Clientes com Atenção / Recuperação / Ativo)

Scene 1 (0.0–1.2s): eyebrow "A semana" e título "Os números saem da operação." entram na coluna esquerda antes de qualquer tela (o título abre o frame). Scene 2 (1.2–2.4s): a janela do Início (`inicio`, 0.66 → 1042×696, canto em x=740 y=90) sobe e assenta (`spring-pop-entrance`); o anel de foco acende sobre os quatro indicadores. Scene 3 (2.4–4.4s): a janela de Clientes (`clientes`, 0.55 → 651×405, canto em x=1180 y=470) sobe sobre o canto inferior direito do Início; o sub-rótulo "E quem está demorando a voltar." entra; o anel migra para os selos Atenção/Recuperação; segura.

## Frame 8 — CORTEX.OS

- type: cta
- src: compositions/frames/08-marca.html
- blueprint: logo-assemble-lockup
- duration: 4.2s
- transition_in: crossfade
- status: animated
- scene: Wordmark CORTEX.OS se assenta ao centro; abaixo, "Sistema operacional para barbearias." e "Pedir acesso ao Beta"; rodapé discreto "Telas do CORTEX com dados de exemplo."
- voiceover: "CORTEX.OS — sistema operacional para barbearias."
- focal: o wordmark CORTEX.OS em Panchang
- roles: tipografia + um pill de CTA desenhado em HTML (não é tela do produto)

Fecha no pedido de acesso; a honestidade sobre os dados de exemplo fica na tela, pequena. Variante settled-lockup-reveal: nada de peças voando.

Scene 1 (0.0–1.2s): "CORTEX" em Panchang 700 ~132px, centrado em y≈400, entra com subida curta + fade (`spring-pop-entrance`, settle long-tail); o ponto em Kahu Blue e "OS" entram em sequência logo depois — o mesmo ponto azul que fechou a frase do frame 1. Scene 2 (1.2–2.2s): "Sistema operacional para barbearias." em Geist ~34px entra abaixo do wordmark. Scene 3 (2.2–3.0s): o pill "Pedir acesso ao Beta" (Kahu Blue, texto branco) entra com **spring-pop** suave. Scene 4 (3.0–4.2s): rodapé "Telas do CORTEX com dados de exemplo." em texto apagado ~20px perto de y≈860; tudo segura parado até o fim (é o frame final; sem saída).
