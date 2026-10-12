---
format: 1080x1920
duration: 34.0s
arc: Marca → Problema → Revelação → Panorama do produto → Adaptação → Perfis → Logo → CTA
music: a definir
language: pt-BR
safe_zone: topo 250px · base 400px · laterais 64px
---

# Direção

- **Fundo**: Creeping Depth `#041723` chapado em todas as cenas. O único acento é Kahu Blue `#0093D6`.
- **Telas**: capturas 2x dos componentes reais, sempre inteiras e nunca redesenhadas.
  - Celular a ~88% da largura útil.
  - Janela de desktop recortada em **coluna** (uma região da tela por vez): no vertical, a janela inteira fica pequena demais para ler.
- **Texto**: um título por cena, Geist 600, 88–104 px, tracking −0.04em, no máximo 2 linhas. Sub-rótulo Geist 400, 40 px, em texto apagado, opcional.
- **Movimento**: `power3.out` em tudo, cortes secos entre módulos (8–20 s), crossfade de 0,3 s dentro de uma cena, uma só "câmera" (push leve) por cena. Sem loops.
- **Ênfase**: o anel de foco (2 px Kahu Blue) sobre a região que importa; um por vez.

# Cenas

| # | Tempo | Duração | Cena | Texto na tela | Tela / asset |
|---|---|---|---|---|---|
| 1 | 0,0–2,5 s | 2,5 s | Abertura | — (só a marca) | Símbolo + wordmark |
| 2 | 2,5–6,0 s | 3,5 s | Problema | **Sua barbearia ainda depende de vários sistemas e controles?** | Ícones de linha |
| 3 | 6,0–8,0 s | 2,0 s | Revelação | **Conheça o CORTEX.** | Símbolo + wordmark |
| 4 | 8,0–9,5 s | 1,5 s | Agenda | **Agenda** · o dia de cada profissional | `AgendaDaHistoria` |
| 5 | 9,5–11,0 s | 1,5 s | Clientes/CRM | **Clientes** · quem está passando da hora de voltar | `ClientesRitmo` |
| 6 | 11,0–12,5 s | 1,5 s | Profissionais | **Barbeiro** · só a própria agenda, no celular | `AgendaDoProfissional` |
| 7 | 12,5–14,0 s | 1,5 s | Atendimento | **Atendimento** · do cliente chegou ao fechamento | `AtendimentoNoCelular` |
| 8 | 14,0–15,5 s | 1,5 s | Caixa | **Caixa** · saldo esperado, sem planilha | `CaixaDaHistoria` |
| 9 | 15,5–17,0 s | 1,5 s | Vendas/PDV | **Vendas** · produto no balcão | Captura do PDV (a fazer) |
| 10 | 17,0–18,5 s | 1,5 s | Estoque | **Estoque** · o que está acabando | Captura de Estoque (a fazer) |
| 11 | 18,5–20,0 s | 1,5 s | Gestão/indicadores | **Início** · a semana em números | `InicioResumo` |
| 12 | 20,0–25,0 s | 5,0 s | Adaptação | **Se adapta à sua operação.** | Onboarding real (a capturar) |
| 13 | 25,0–29,0 s | 4,0 s | Perfis | **Sozinho. Estúdio. Equipe. Operação maior.** | Agenda com 1, 2–3, 5 e 8 profissionais |
| 14 | 29,0–32,0 s | 3,0 s | Logo em motion | — | Símbolo + wordmark |
| 15 | 32,0–34,0 s | 2,0 s | CTA | **Peça seu acesso ao beta.** · fadeos-five.vercel.app | Texto + endereço |

## Cena 1 — Abertura (0,0–2,5 s)

O quadro abre em ink puro. Em 0,2 s o **quadrado azul** surge no centro óptico (y ≈ 860), pequeno, com `spring-pop` sem overshoot. Em 0,9 s ele se estica na horizontal e vira uma **lâmina**: o "corte". A lâmina atravessa o quadro da esquerda para a direita e, na passagem, revela **CORTEX** em Panchang, como uma máscara que se abre atrás dela. Em 1,8 s a lâmina volta a ser o quadrado e assenta entre CORTEX e OS. Segura até 2,5 s.

## Cena 2 — Problema (2,5–6,0 s)

O título entra em duas linhas: "Sua barbearia ainda depende / de vários sistemas e controles?". Ao redor, cinco ícones de linha fina, sempre no mesmo traço (1,5 px, cor de texto apagado):
- caderno de agenda;
- planilha;
- balão do WhatsApp;
- maquininha;
- caderno de fiado.

Eles aparecem espalhados e levemente desalinhados, cada um com um tremor mínimo de 1 frame, a "bagunça". Em 4,8 s todos convergem para o centro e **colapsam num ponto**: o quadrado azul.

## Cena 3 — Revelação (6,0–8,0 s)

O ponto azul cresce até o tamanho do símbolo e o wordmark **CORTEX.OS** assenta abaixo dele. Em cima, em 6,4 s: **"Conheça o CORTEX."** Nenhum sub-rótulo.

## Cenas 4–11 — Panorama do produto (8,0–20,0 s)

Oito módulos, **1,5 s cada**, com corte seco no tempo da trilha. Cada cena tem a mesma gramática:
- rótulo do módulo no topo da área segura (Geist 600, 72 px);
- uma frase curta de 40 px embaixo;
- a tela real ocupando o centro;
- um **anel de foco** acendendo na região que importa, em 0,4 s.

A transição entre módulos é o **deslize vertical da tela**: a próxima sobe de baixo e empurra a anterior, 0,35 s, `power3.out`. A continuidade vem do quadrado azul, que fica fixo no canto superior esquerdo da área segura como marca-d'água viva, e pisca uma vez a cada corte.

Destaques por módulo (o que o anel marca):
- **Agenda**: o contador "Em atendimento" e a linha que muda de Confirmado para Em atendimento.
- **Clientes**: "Costuma voltar a cada 25 dias — já se passaram 80." (recuperação).
- **Equipe**: a agenda do Diego no celular dele, só com os horários dele — a experiência do barbeiro.
- **Atendimento**: "Fechar e receber", no celular.
- **Caixa**: o saldo esperado mudando.
- **Vendas**: o produto entrando na venda.
- **Estoque**: o item abaixo do mínimo.
- **Início**: o indicador da semana. É a experiência do gestor.

## Cena 12 — Adaptação (20,0–25,0 s)

Título: **"Se adapta à sua operação."** A tela real do onboarding mostra a pergunta de modo de trabalho com as duas opções que existem hoje, **Sozinho** e **Equipe**:
1. Um toque em "Equipe".
2. A tela seguinte, "Sua equipe", ganha três profissionais, um por um.
3. Crossfade para a Agenda, que já nasce com três colunas.

A mensagem é que a mesma instalação responde ao que a pessoa contou, sem outro produto.

## Cena 13 — Perfis (25,0–29,0 s)

A mesma Agenda (vista semana) em quatro estados, 1 s cada, com a palavra do perfil em cima:
- **Sozinho**: 1 coluna.
- **Estúdio**: 3 colunas.
- **Equipe**: 5 colunas.
- **Operação maior**: 8 colunas, com o painel "Equipe do dia" aparecendo.

As colunas crescem com um *stagger* de 60 ms; o quadro nunca troca de tela, só de escala. Não mostra várias unidades, porque o produto hoje organiza a agenda por uma unidade: "operação maior" é equipe grande, não rede.

## Cena 14 — Logo em motion (29,0–32,0 s)

Ver "Conceito da logo" abaixo.

## Cena 15 — CTA (32,0–34,0 s)

- **"Peça seu acesso ao beta."** em Geist 600, 96 px, centrado na área segura.
- Abaixo, **fadeos-five.vercel.app** em Geist mono, 44 px, em Kahu Blue, com um sublinhado que se desenha em 0,4 s.
- O quadrado azul fica acima do título, parado.
- Segura até o fim, sem animação competindo com a leitura.

# Conceito da logo (cena 14)

**"O corte que fecha."** A abertura (cena 1) abre o quadro com um corte; o fim fecha com outro.

1. **29,0 s**: o último módulo (Perfis) encolhe para o centro e vira o quadrado azul (*match cut*: a última coluna da agenda vira o símbolo).
2. **29,4 s**: o quadrado desliza para a esquerda; à direita dele, **CORTEX** se escreve por **máscara diagonal de 12°**, o ângulo do "corte" da marca, como uma navalha passando.
3. **30,4 s**: o quadrado encaixa entre CORTEX e **.OS**, que entra por último, mais leve.
4. **30,8–32,0 s**: uma linha fina de 1 px, Kahu Blue a 40%, atravessa o quadro na mesma diagonal e some. É o acabamento: um único brilho, sem reflexo, sem partícula, sem glow.

O wordmark é o oficial (Panchang), sem distorção, sem 3D, sem sombra. O quadrado é o símbolo oficial; nenhum círculo em nenhum momento.
