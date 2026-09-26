# CORTEX.OS — product film (9:16)

**`renders/film.mp4`**: 1080×1920, 60 fps, 15 s, com sound design. Criado e renderizado com o
**HyperFrames** (`hyperframes@0.8.77`, workflow `product-launch-video`).

**Não há screenshots.** Cada elemento de interface é o **DOM real** do CORTEX.OS: `harvest.mjs`
dirige a aplicação rodando (Next.js deste repositório + Supabase local com seed pelas RPCs reais) e
colhe o HTML dos componentes em cada estado, junto com o **CSS compilado de produção** e as fontes.
Dentro do HyperFrames esses componentes são camadas vivas, nítidas em qualquer zoom. A timeline anima
os componentes e **as peças de dentro deles**: um horário, um badge, um botão, um valor, uma linha do
caixa.

Para o vertical, a maioria dos componentes vem do **layout mobile do próprio produto** (o app é
responsivo, colhido a 430 px), que ocupa o quadro 9:16 legível. A sidebar e a página inteira da
revelação vêm do layout desktop.

## Narrativa: OPERAÇÃO → CONEXÃO → CONTROLE → CORTEX.OS

| Tempo | Cena | O que acontece (tudo real) |
|---|---|---|
| 0–2 | O sistema | O CortexMark nasce pequeno, as metades se fecham e o nome se escreve. A câmera mergulha na metade azul. |
| 2–4 | A operação | O azul do mark **é** o azul da linha "Em atendimento" do Início. A câmera recua pelo 10:00 gigante até Felipe Santos, e a lista "Agora e a seguir" se forma linha a linha. |
| 4–6 | Agenda → Atendimento | A câmera atravessa até a Agenda. A linha de Henrique Rocha se desmonta (10:30 / cliente / serviço / AGUARDANDO / Iniciar atendimento), o botão mostra o "Iniciando…" real, o status vira EM ATENDIMENTO e os contadores vão de 1/2 para 0/3. As peças se remontam no atendimento ("Originado de agendamento"). |
| 6–8 | Atendimento → Negócio | O TOTAL R$ 50,00 cresce, pousa no `<dialog>` real e o botão confirma. O valor desce ATENDIMENTO → VENDA → CAIXA e vira a movimentação "Venda 10:41 +R$ 50,00", que abre espaço no caixa. A comissão de Thiago aparece sozinha. |
| 8–11 | Tudo conectado | No alto, a navegação real acende módulo a módulo. Embaixo, o componente de cada módulo em carrossel acelerado: agenda, clientes, caixa, serviços, estoque, comissões, financeiro, até os KPIs do Início. |
| 11–13 | Visão de gestão | Os KPIs fazem o match com a página inteira do Início, a câmera recua e o gráfico real desenha a própria linha. |
| 13–15 | Assinatura | A interface se dissolve, o lockup sai da sidebar para o centro e entra "Sistema operacional para barbearias" (tagline oficial, `app/Landing.tsx`). |

Auditoria, telas, componentes e o storyboard detalhado estão em `STORYBOARD.md`; o brief em `BRIEF.md`.

## Arquivos

```
film.config.mjs     ← beats (tempos), velocidade, textos da marca, sequência de módulos
film.timeline.js    ← a direção de motion: câmera, decomposições, transformações (GSAP, seek-safe)
build.mjs           gera index.html + compositions/film.html (+ assets/film.wav)
harvest.mjs         colhe o DOM real (desktop + mobile) → assets/app/fragments.json, app.css, fontes
film-audio.py       sound design mínimo nos mesmos beats
assets/app/         DOM, CSS e fontes reais do produto
renders/film.mp4
```

## Re-renderizar

Mudou tempos, velocidade, sequência de módulos ou a própria animação? Não precisa de backend:

```bash
cd videos/cortex-os-film
pip install numpy
node build.mjs
npx hyperframes check
npx hyperframes render --quality high --fps 60 --output renders/film.mp4
```

Precisa de FFmpeg no PATH e do Chrome do HyperFrames (`npx hyperframes doctor`, `npx hyperframes browser ensure`).

Quer outros dados ou estados reais? Recolha o DOM da aplicação (requer Docker):

```bash
../cortex-os-launch/app-capture/scripts/setup-backend.sh
../cortex-os-launch/app-capture/scripts/serve-app.sh --build &
node harvest.mjs          # reseta o banco, dirige o app (inicia e fecha o atendimento) e colhe o DOM
node build.mjs && npx hyperframes render --quality high --fps 60 --output renders/film.mp4
```

## Notas técnicas

- O CSS do produto fica no `index.html` (raiz, sem escopo) porque o HyperFrames escopa as regras de
  sub-composição e as variáveis `:root` do produto precisam valer. As variáveis do next/font são
  replicadas no `:root`, como o app faz no `<html>`.
- As camadas passam por escalas extremas (o mergulho no azul chega a 640×), por isso o GSAP roda com
  `force3D: false` e as camadas somem com `autoAlpha`.
- Todo `fromTo` declara no `to` também as propriedades estáticas do `from`: no render sequencial do
  HyperFrames, propriedades só-`from` não são aplicadas.
- O `check` passa. Ficam avisos de camadas intencionais (a lista passa sob a faixa dos contadores), do
  tamanho do arquivo único (a continuidade entre cenas pede uma timeline só) e de contraste de três
  textos do próprio produto.
- Dados fictícios (Norte 21 Barbearia), gerados pelas RPCs reais. Henrique paga em dinheiro porque,
  no CORTEX.OS, só dinheiro movimenta a gaveta. O filme segue a regra real do produto.
