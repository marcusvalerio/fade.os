/**
 * CORTEX.OS — product film (9:16). The editable knobs.
 *
 * `beats` are master seconds; film.timeline.js reads them by name, so retiming a beat
 * moves everything hung off it. `speed` rescales the whole clock. After editing:
 *   node build.mjs && npx hyperframes render --quality high --fps 60 --output renders/film.mp4
 */
export default {
  output: { width: 1080, height: 1920, fps: 60, duration: 15, speed: 1, audio: true },

  brand: { name: 'CORTEX', suffix: 'OS', tagline: 'Sistema operacional para barbearias' }, // app/Landing.tsx

  beats: {
    // 01 · O sistema (silêncio)
    markIn: 0.3, markResolved: 1.35, typeStart: 0.95, typeStep: 0.062, dive: [1.62, 2.0],
    // 02 · A operação (construção)
    pullBack: [2.0, 2.95], listIn: 2.82, toSection: [2.95, 3.4], labelSweep: [2.75, 4.05], zoomThrough: [3.45, 3.98],
    // 03 · Agenda → Atendimento
    agendaIn: [3.85, 4.25], decompose: [4.25, 4.72], press: 4.9, pending: 4.97, result: 5.3, toAttendance: [5.55, 6.0],
    // 04 · Atendimento → Negócio (aceleração)
    valueUp: [6.0, 6.42], modalIn: [6.35, 6.8], confirm: 6.9, modalOut: [7.0, 7.3], toCaixa: [7.25, 7.8], commission: [7.62, 7.98],
    // 05 · Tudo conectado
    spineIn: [8.0, 8.32], modules: [8.1, 8.48, 8.84, 9.17, 9.47, 9.74, 9.99, 10.22], toKpis: [10.45, 10.98],
    // 06 · Visão de gestão (revelação)
    reveal: [11.05, 12.3], chartDraw: [11.45, 12.45],
    // 07 · Assinatura
    lockupOut: [13.0, 13.9], tagline: [13.55, 14.2], fadeOut: [14.72, 15.0],
  },

  // the module sequence of scene 05: [sidebar state harvested on that page, real component]
  // components ending in @m are the product's own mobile layout (the app is responsive)
  modules: [
    ['agenda', 'ag-row-henrique-after@m'],
    ['clientes', 'cl-chamar@m'],
    ['caixa', 'cx-card@m'],
    ['servicos', 'sv-list@m'],
    ['estoque', 'es-critico@m'],
    ['comissoes', 'cm-total@m'],
    ['financeiro', 'fin-result@m'],
    ['inicio', 'dash-kpis-final'],
  ],
};
