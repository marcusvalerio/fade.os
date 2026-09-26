# CORTEX.OS — trailer de lançamento (15 s)

`trailer.mp4`: 1920×1080, 60 fps, com trilha. Feito **a partir do CORTEX.OS**:
toda tela que aparece é a aplicação real (Next.js deste repositório) rodando
contra um Supabase local com o schema real e uma barbearia de demonstração. Nada
foi redesenhado. O compositor só adiciona câmera, cursor e o tempo dos cortes
entre estados reais da interface.

## Roteiro

| Tempo | Cena | O que é real |
|---|---|---|
| 0–2 s | **Identidade** | O wordmark se escreve letra a letra, como `app/login/AberturaDaMarca.tsx` (62 ms por caractere), e o CortexMark fecha com os keyframes `cortex-resolve`. O lockup voa até o lugar exato dele na sidebar. |
| 2–5 s | **O sistema ganha vida** | Início (`/dashboard`) com a câmera indo dos KPIs para "Agora e a seguir". O cursor passa por *Agenda* (estados de hover e `:active` reais). |
| 5–8 s | **Agenda / operação** | `/agenda` com a linha do *agora*, status e trilhos. Hover em Henrique Rocha revela *Cancelar / Não compareceu*; o clique em **Iniciar atendimento** mostra o pendente real ("Iniciando…"), e a server action cria o atendimento. A linha vira *Em atendimento* e os KPIs mudam de 1/2 para 0/3. |
| 8–11 s | **Profundidade** | Sidebar → *Atendimento* → o atendimento recém-criado → **Fechar e receber**: o `<dialog>` real, com Pix e R$ 50,00. |
| 11–15 s | **CORTEX.OS** | **Confirmar e fechar** fecha a venda de verdade. O Início volta com o faturamento atualizado (+R$ 50), a janela se afasta e o lockup sai da sidebar para o centro com o tagline oficial *"Sistema operacional para barbearias"* (`app/Landing.tsx`). |

## Estrutura

```
config.mjs            ← tudo que se edita: duração, velocidade, textos, telas, tempos, câmera
seed/                 demo data (Norte 21 Barbearia) + fixups do schema só para o banco local
scripts/
  setup-backend.sh    Supabase local (Docker) + migrations do repo + seed   [--reset]
  serve-app.sh        build + next start com o relógio do servidor em app.fakeNow
fake-now.cjs          relógio do servidor (o "agora" da agenda = 10:26 de sex, 25/09)
capture.mjs           dirige o app real e grava cada estado (PNG 4K + geometria do DOM)
captures/             os estados capturados (versionados: dá para re-renderizar sem backend)
compose/              compositor determinístico (canvas): câmera, cursor, transições, letreiro
audio.py              trilha discreta sincronizada com a timeline
render.mjs            quadros → ffmpeg → trailer.mp4
```

## Re-renderizar

Só mudou tempo, velocidade, câmera ou texto do letreiro? Não precisa de backend:

```bash
npm ci                                   # na raiz: fornece a fonte Geist (node_modules/geist)
pip install numpy imageio-ffmpeg
FFMPEG=$(python3 -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())") node showreel/cortex/render.mjs
node showreel/cortex/render.mjs --stills 3,6.8,10.4   # quadros soltos em stills/ para revisar
node showreel/cortex/render.mjs --serve               # abre o compositor no navegador para navegar no tempo
```

Mudou dados, telas ou interações? Aí é preciso recapturar a aplicação real (requer Docker):

```bash
cd showreel/cortex
./scripts/setup-backend.sh               # 1ª vez (~1 min); capture.mjs reseta sozinho depois
./scripts/serve-app.sh --build &         # app real em http://127.0.0.1:3100
node capture.mjs                         # reseta o banco e grava captures/
node render.mjs
```

### O que editar em `config.mjs`

- **Duração / velocidade:** `output.speed` reescala o relógio inteiro (1.25 → 12 s).
  Para reorganizar, mova os tempos de `timeline`; cada chave diz o que acontece naquele instante.
- **Textos:** `brand` (nome, sufixo e tagline). Use só textos que o produto já usa.
- **Telas:** `shots` (rotas) e `app.focusClient` (o agendamento que vira atendimento). Depois, `node capture.mjs`.
- **Transições e movimento:** `motion`, com curvas e durações baseadas nos tokens
  de `app/globals.css` (`--ease-emphasized`, `--duration-interacao`, rise-in de 6 px)
  e zoom da câmera por cena.

## Notas honestas

- Os dados são fictícios (Norte 21 Barbearia, os mesmos nomes de `app/landing-panels.tsx`),
  mas foram gerados pelas RPCs reais (`create_company_with_owner`, `add_attendance_service_item`,
  `close_attendance`). Por isso vendas, comissões e KPIs são calculados pelo banco, não digitados.
- As migrations do repositório não recriam sozinhas o banco de produção (ele tem objetos
  anteriores a elas; ver `supabase/README.md`). `seed/local-schema-fixups.sql` adiciona só as
  colunas que faltaram **no banco local**. Nenhuma migration foi alterada.
- Entre dois estados reais, o compositor faz a transição com as mesmas regras do produto:
  opacidade para mudança de estado, rise-in para troca de página e `scale-in` para o `<dialog>`.
