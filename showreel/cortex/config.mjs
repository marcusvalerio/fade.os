/**
 * CORTEX.OS — launch trailer. Every editable knob lives here.
 *
 *   app       how the REAL app is run and captured (capture.mjs reads this)
 *   brand     the end card. Taken from the product itself: the Wordmark
 *             component and the tagline used in app/Landing.tsx / layout
 *             metadata. Don't invent copy here: only use text the product ships.
 *   shots     which real screens are captured, and the elements whose
 *             positions drive the camera and cursor
 *   timeline  when things happen, in seconds on a 15 s master clock.
 *             `speed` rescales the whole clock (1.25 → 12 s, 0.8 → 18.75 s).
 *   motion    easing and transition lengths (based on the product's own motion tokens)
 */
export default {
  output: { width: 1920, height: 1080, fps: 60, duration: 15, speed: 1, subframes: 3, audio: true },

  app: {
    baseUrl: 'http://127.0.0.1:3100',
    login: { email: 'rafael@norte21.demo', password: 'cortex-demo-2026' },
    // Friday 25 Sep 2026, 10:26 in São Paulo: two clients in the chair,
    // Henrique waiting, the "agora" line just before 10:30.
    fakeNow: '2026-09-25T13:26:00Z',
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 3, // captures at 4320×2430 so the camera can push in without softening
    colorScheme: 'dark',
    focusClient: 'Henrique Rocha',
  },

  brand: {
    name: 'CORTEX',
    suffix: 'OS',
    tagline: 'Sistema operacional para barbearias', // app/Landing.tsx (footer + hero eyebrow)
  },

  // Real screens, in story order. `route` may use {attendanceId}, resolved at capture time.
  shots: {
    inicio: '/dashboard',
    agenda: '/agenda',
    atendimentos: '/atendimento',
    atendimento: '/atendimento/{attendanceId}',
  },

  timeline: {
    // 01 — identidade
    typeStart: 0.35,        // the wordmark types itself, like app/login/AberturaDaMarca.tsx
    typeStep: 0.062,        //   (same 62 ms per character as the first-visit opening)
    markResolve: 0.95,      // CortexMark halves close (cortex-resolve keyframes)
    toApp: [1.45, 2.15],    // lockup lands in the sidebar while Início settles in around it

    // 02 — o sistema ganha vida (Início)
    inicioFocus: [2.15, 4.2],      // camera drifts from the KPIs to "Agora e a seguir"
    cursorToAgenda: [3.55, 4.2],
    pressAgenda: 4.32,
    toAgenda: [4.42, 4.9],

    // 03 — agenda / operação
    agendaScroll: [4.75, 6.0],
    cursorToStart: [5.55, 6.35],
    pressStart: 6.62,
    pending: 6.72,          // "Iniciando…" (the real pending label of BotaoDeAcao)
    result: 7.18,
    scrollToKpis: [7.3, 8.05],

    // 04 — profundidade (Atendimento → Fechar e receber)
    cursorToSubnav: [7.75, 8.2],
    pressSubnav: 8.28,
    toAtendimentos: [8.34, 8.72],
    cursorToRow: [8.55, 8.98],
    pressRow: 9.05,
    toDetail: [9.1, 9.48],
    cursorToFechar: [9.45, 9.95],
    pressFechar: 10.05,
    modal: [10.12, 10.44],
    cursorToConfirm: [10.3, 10.85],
    pressConfirm: 10.95,

    // 05 — CORTEX.OS
    toFinal: [11.05, 11.5],
    numbersUpdate: 11.75,
    pullBack: [11.5, 13.4],
    lockupOut: [12.85, 13.75],
    tagline: [13.55, 14.2],
    fadeOut: [14.75, 15],
  },

  motion: {
    // --ease-emphasized: cubic-bezier(0.2, 0, 0, 1) is the product's own curve
    emphasized: [0.2, 0, 0, 1],
    standard: [0.4, 0, 0.2, 1],
    riseIn: 6,               // px (rise-in keyframe)
    stateCrossfade: 0.22,    // --duration-interacao
    press: 0.14,             // --duration-micro
    windowRadius: 14,        // --radius-lg
    cameraZoom: { inicio: [1.16, 1.3], agenda: [1.0, 1.32], detail: 1.34, modal: 1.62, final: [1.22, 0.74] },
  },
};
