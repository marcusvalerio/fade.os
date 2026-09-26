---
format: 1920x1080
duration: 15s
message: "CORTEX.OS é um sistema operacional para gestão: sofisticado, preciso e muito bem projetado."
arc: Identidade → O sistema ganha vida → Operação → Profundidade → Assinatura
audience: donos e gestores de barbearias e estúdios de beleza
mode: autonomous
music: own score (audio.py) — quiet bed, UI clicks, one open chord
---

Every visual in this storyboard is a captured state of the running CORTEX.OS app
(`assets/captures/`, produced by `app-capture/capture.mjs`) or the product's own lockup
(CortexMark + Panchang wordmark, same markup and metrics as `components/app-nav.tsx`).
Times are master seconds from `trailer.config.mjs → timeline`; `node build.mjs` turns them
into the five sub-compositions below.

## Frame 1 — Identidade

- scene: Creeping Depth, almost empty. CORTEX.OS types itself; the CortexMark closes; the lockup lands in the sidebar as Início settles in.
- duration: 2.15s
- poster: 1.3s
- transition_in: cut
- status: animated
- src: compositions/frames/01-identidade.html
- asset_candidates: assets/captures/inicio.*
- handoff_out: lockup at its exact sidebar position (24,24 css → 32,32 px), scale 1.333, opacity 0 over the screenshot's own lockup (identical pixels); camera z 1.0 centred; app window opacity 1, blur 0.

0.35–0.91 s: the wordmark writes itself at 62 ms per character, like `AberturaDaMarca` on
first visit. 0.95–1.51 s: CortexMark halves resolve from ±34° (`cortex-resolve`,
`--ease-emphasized`). 1.45–2.15 s: the lockup travels to the sidebar; Início rises out of a
10 px blur while the camera settles from z 0.9 to 1.0. The Landing hero's Kahu Blue radial
glows top right, then gives way to the app.

## Frame 2 — O sistema ganha vida

- scene: Início, full frame, then a slow push to the KPIs and a shift of focus to "Agora e a seguir"; the cursor takes Agenda in the sidebar.
- duration: 2.75s
- transition_in: cut (continuous handoff)
- status: animated
- src: compositions/frames/02-sistema.html
- asset_candidates: assets/captures/inicio.*, inicio-hover.*, inicio-press.*, agenda.*
- handoff_out: Agenda fully in at scroll 0; camera cx 600 cy 360 z 1.1; cursor on the Agenda nav item.

Real hover (220 ms) and `:active` (140 ms) states on the nav item; page change = the shell
stays, content leaves, the new page rises in 6 px (rise-in).

## Frame 3 — Agenda / operação

- scene: The real day: KPIs, day navigation, statuses, rails, the "agora" line. Henrique Rocha is waiting; hover reveals Cancelar / Não compareceu; Iniciar atendimento → "Iniciando…" → Em atendimento, and the KPIs go from 1/2 to 0/3.
- duration: 3.15s
- transition_in: cut (continuous handoff)
- status: animated
- src: compositions/frames/03-agenda.html
- asset_candidates: assets/captures/agenda.*, agenda-hover.*, agenda-press.*, agenda-pending.*, agenda-result.*
- handoff_out: agenda-result at scroll 0; camera cx 692 cy 405 z 1.04; cursor travelling to the Atendimento sub-item.

The page scrolls like a person scrolling (standard ease); every state is the real render, and
the click ran the real server action.

## Frame 4 — Profundidade

- scene: Sidebar → Atendimento → the attendance the click just created → Fechar e receber: the real `<dialog>` with Pix and R$ 50,00; Confirmar e fechar.
- duration: 3.0s
- transition_in: cut (continuous handoff)
- status: animated
- src: compositions/frames/04-profundidade.html
- asset_candidates: assets/captures/agenda-press-subnav.*, atendimentos*.*, atendimento*.*, modal*.*
- handoff_out: modal-press on screen; camera pushing on the dialog (z ≈ 1.6); cursor pressing Confirmar.

The dialog opens with its own `open:animate-scale-in`: the backdrop fades in and the panel
scales from 0.97 to 1.

## Frame 5 — CORTEX.OS

- scene: The sale closes; Início returns and the revenue refreshes (+R$ 50); the window pulls back to float on Creeping Depth; the lockup lifts out of the sidebar to the centre over the official tagline.
- duration: 3.95s
- transition_in: dip to the app background
- status: animated
- src: compositions/frames/05-cortex.html
- asset_candidates: assets/captures/modal-press.*, inicio-final.*, inicio.* (KPI band before the refresh)

Tagline: "Sistema operacional para barbearias", from `app/Landing.tsx`, set like the Landing
hero eyebrow. No CTA, no invented copy. Clean fade in the last 0.25 s.

## Video direction

Silent, precise, editorial. The camera is the only thing that moves freely. The UI changes only
the way the product changes itself: opacity for state, rise-in for page, scale-in for the dialog,
`cortex-resolve` for the mark, all on `--ease-emphasized`. No particles, glitch, neon or
decorative shapes. The score stays under the picture: a low bed, key ticks, trackpad clicks, two
confirmation tones where the system answers, and one open chord under the end card.
