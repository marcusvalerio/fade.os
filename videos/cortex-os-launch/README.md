# CORTEX.OS — trailer de lançamento (HyperFrames)

**`renders/video.mp4`**: 15 s, 1920×1080, 60 fps, com trilha. Composto e renderizado com o
**HyperFrames** (`hyperframes@0.8.77`, workflow `product-launch-video`) a partir da **aplicação
real**. Cada tela é um estado capturado do Next.js deste repositório rodando contra um Supabase
local com o schema real. O HyperFrames acrescenta câmera, cursor e os cortes entre esses estados
reais. `renders/contact-sheet.jpg` traz os quadros-chave.

## Roteiro

| Tempo | Sub-composição | O que é real |
|---|---|---|
| 0–2.15 s | `01-identidade` | O wordmark se escreve (62 ms/letra, como `AberturaDaMarca`), o CortexMark fecha (`cortex-resolve`) e o lockup pousa no lugar exato dele na sidebar enquanto o Início entra. |
| 2.15–4.9 s | `02-sistema` | Início real; a câmera vai dos KPIs para "Agora e a seguir". Hover e `:active` reais em *Agenda*. |
| 4.9–8.05 s | `03-agenda` | Agenda com a linha do agora. Hover real revela *Cancelar / Não compareceu*; **Iniciar atendimento** mostra o "Iniciando…" real, a server action cria o atendimento e os KPIs vão de 1/2 para 0/3. |
| 8.05–11.05 s | `04-profundidade` | Atendimento → o atendimento recém-criado → **Fechar e receber**: o `<dialog>` real, com Pix e R$ 50,00. |
| 11.05–15 s | `05-cortex` | A venda fecha de verdade, o faturamento do Início sobe R$ 50, a janela se afasta e o lockup sai da sidebar com o tagline oficial *"Sistema operacional para barbearias"*. |

## Estrutura

```
trailer.config.mjs   ← o que se edita: duração, velocidade, textos, telas, cenas, tempos, câmera, eases
build.mjs            gera index.html + compositions/frames/NN-*.html (GSAP, seek-safe) + assets/trailer.wav
BRIEF.md · STORYBOARD.md · frame.md    brief, roteiro e design system (tokens de app/globals.css)
index.html           composição raiz: fundo, as 5 cenas (data-composition-src) e a trilha
compositions/frames/ as 5 sub-composições geradas (uma timeline GSAP pausada cada)
assets/captures/     os estados reais da aplicação (PNG 4K) + manifest.json com a geometria do DOM
assets/fonts/        Panchang (marca) e Geist (UI), as fontes do produto
audio.py             trilha discreta, sincronizada com a timeline
app-capture/         captura da aplicação real: seed, backend local, relógio, capture.mjs
renders/             video.mp4 + contact-sheet.jpg
```

## Re-renderizar

Mudou tempo, velocidade, câmera, eases ou o texto do letreiro? Não precisa de backend:

```bash
cd videos/cortex-os-launch
pip install numpy          # trilha (audio.py)
node build.mjs             # regenera as composições a partir do config
npx hyperframes check      # lint + runtime + layout + motion + contraste
npx hyperframes preview    # Studio: navegar na timeline
npx hyperframes render --quality high --fps 60 --output renders/video.mp4
```

Requer FFmpeg no PATH (`npx hyperframes doctor` confere) e o Chrome do HyperFrames (`npx hyperframes browser ensure`).

Mudou dados, telas ou a interação? É preciso recapturar a aplicação real, o que requer Docker:

```bash
cd videos/cortex-os-launch
./app-capture/scripts/setup-backend.sh              # Supabase local + migrations do repo + seed (~1 min)
./app-capture/scripts/serve-app.sh --build &        # o app real em :3100, com o relógio em app.fakeNow
node app-capture/capture.mjs                        # reseta o banco, dirige o app e grava assets/captures/
node build.mjs && npx hyperframes render --quality high --fps 60 --output renders/video.mp4
```

### O que editar em `trailer.config.mjs`

- **Duração / velocidade:** `output.speed` reescala tudo (1.25 → 12 s). Os tempos de `timeline` dizem o que acontece em cada instante, e `scenes` define os cortes entre as sub-composições.
- **Textos:** `brand` (nome, sufixo, tagline). Use só textos que o produto já usa.
- **Telas:** `shots` (rotas) e `app.focusClient` (o agendamento que vira atendimento). Depois, recapture.
- **Transições:** `motion` guarda as curvas e durações dos tokens de `app/globals.css`, o rise-in e o zoom de câmera por cena.

## Por que as capturas não saem do `hyperframes capture`

O `hyperframes capture` foi feito para URLs públicas: não tem opção de login e não grava estados de
interação. A história precisa de hover, `:active`, o pendente "Iniciando…" e o resultado de server
actions reais, então `app-capture/capture.mjs` dirige o app com Playwright e grava cada estado junto
com a geometria do DOM. O `product-launch-video` prevê esse caminho ("use the real screenshot instead
of rebuilding"). Todo o resto (composição, timelines, check, snapshot, render) é HyperFrames.

## Notas

- Os dados são fictícios (Norte 21 Barbearia, os nomes de `app/landing-panels.tsx`), mas foram
  gerados pelas RPCs reais (`create_company_with_owner`, `add_attendance_service_item`,
  `close_attendance`). Por isso vendas, comissões e KPIs são calculados pelo banco.
- `app-capture/seed/local-schema-fixups.sql` adiciona ao **banco local** as colunas que o banco de
  produção tem de antes das migrations (ver `supabase/README.md`). Nenhuma migration foi alterada.
