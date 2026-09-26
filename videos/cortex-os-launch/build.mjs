// Generates the HyperFrames project from trailer.config.mjs + the captured app states.
//
//   node build.mjs      → index.html + compositions/frames/NN-*.html (+ assets/trailer.wav)
//
// Every animated property (camera, cursor, scroll, each real UI state's opacity,
// the lockup) is described once as a continuous track on the master clock. Each
// scene then gets exactly the slice of every track that falls inside it: an
// initial `set` at the scene's first frame plus GSAP tweens, with eases re-mapped
// when a move straddles a cut. So the five sub-compositions hand over camera,
// cursor and UI state with no pop, and each one is a plain paused GSAP timeline.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from './trailer.config.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TL0 = config.timeline, MO = config.motion, BR = config.brand, OUT = config.output;
const K = 1 / (OUT.speed || 1); // speed rescales the whole clock
const TL = Object.fromEntries(Object.entries(TL0).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => x * K) : v * K]));
const DUR = OUT.duration * K, W = OUT.width, H = OUT.height;
const man = JSON.parse(readFileSync(path.join(dir, 'assets/captures/manifest.json'), 'utf8'));
const VW = man.viewport.width, VH = man.viewport.height, S0 = W / VW;
const ST = man.states, R = (s, n) => ST[s].rects[n];
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));

// ------------------------------------------------------------------ eases
// Same curves the product uses (app/globals.css), as CSS cubic-beziers. The
// runtime copy of this function is inlined into each composition.
const BEZ = {
  emph: MO.emphasized, std: MO.standard, glide: [0.45, 0, 0.15, 1],
  cur: [0.3, 0, 0.1, 1], curY: [0.42, 0, 0.12, 1], lin: [0, 0, 1, 1],
};
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let s = x; for (let i = 0; i < 10; i++) { const d = dX(s); if (Math.abs(d) < 1e-7) break; s -= (X(s) - x) / d; } return Y(Math.min(1, Math.max(0, s))); };
}
const EASE = Object.fromEntries(Object.entries(BEZ).map(([k, v]) => [k, bezier(...v)]));

// ----------------------------------------------------------------- tracks
// track(sel, prop): ordered segments {t0, t1, v0, v1, ease}. Before the first
// segment the value is `init`; a zero-length segment is an instant set.
const tracks = new Map();
function track(sel, prop, init, extra) {
  const k = `${sel}|${prop}`;
  if (!tracks.has(k)) tracks.set(k, { sel, prop, init, extra, segs: [] });
  return tracks.get(k);
}
function valueAt(tr, t) {
  let v = tr.init;
  for (const s of tr.segs) {
    if (t < s.t0) break;
    v = s.t1 <= s.t0 || t >= s.t1 ? s.v1 : interp(s.v0, s.v1, EASE[s.ease]((t - s.t0) / (s.t1 - s.t0)));
  }
  return v;
}
function interp(a, b, u) {
  if (typeof a === 'number') return a + (b - a) * u;
  const na = String(a).match(/-?[\d.]+/g).map(Number), nb = String(b).match(/-?[\d.]+/g).map(Number); let i = 0;
  return String(a).replace(/-?[\d.]+/g, () => +(na[i] + (nb[i] - na[i]) * u, i++).toFixed(3));
}
function to(sel, prop, t0, t1, v1, ease = 'emph', { from, init, extra } = {}) {
  const tr = track(sel, prop, init ?? from ?? 0, extra);
  const v0 = from ?? valueAt(tr, t0);
  if (!tr.segs.length && from !== undefined && init === undefined) tr.init = from;
  tr.segs.push({ t0, t1, v0, v1, ease });
}
const set = (sel, prop, t, v, opts = {}) => to(sel, prop, t, t, v, 'lin', opts);

// --------------------------------------------------------------- camera
// { cx, cy, z } in viewport css px → transform of the camera wrapper (origin 0 0).
// Keys are clamped so the frame never leaves the app window when z ≥ 1; x/y/scale
// then tween with one shared ease, which keeps every in-between frame inside too.
function camXform({ cx, cy, z }) {
  const S = z * S0, hw = W / 2 / S, hh = H / 2 / S;
  const x0 = hw * 2 >= VW ? VW / 2 : clamp(cx, hw, VW - hw), y0 = hh * 2 >= VH ? VH / 2 : clamp(cy, hh, VH - hh);
  return { x: W / 2 - x0 * S, y: H / 2 - y0 * S, scale: S, cx: x0, cy: y0 };
}
function camera(sel, keys) {
  const f0 = camXform(keys[0]);
  for (const p of ['x', 'y', 'scale']) track(sel, p, f0[p]);
  for (let i = 1; i < keys.length; i++) {
    const a = camXform(keys[i - 1]), b = camXform(keys[i]);
    for (const p of ['x', 'y', 'scale']) to(sel, p, keys[i - 1].t, keys[i].t, b[p], keys[i].ease || 'glide');
    void a;
  }
}
const camAt = (sel, t) => ({ x: valueAt(tracks.get(`${sel}|x`), t), y: valueAt(tracks.get(`${sel}|y`), t), scale: valueAt(tracks.get(`${sel}|scale`), t) });
const project = (c, p) => ({ x: c.x + p.x * c.scale, y: c.y + p.y * c.scale });

// ================================================================= story
const Z = MO.cameraZoom, X = MO.stateCrossfade * K, P = MO.press * K;
const fat = R('inicio', 'faturamento'), kpiA = R('inicio', 'kpiAtendimentos');
const kpiBand = { x: fat.x - 8, y: fat.y - 8, w: kpiA.x + kpiA.w - fat.x + 16, h: Math.max(fat.h, kpiA.h) + 20 };
const rowF = R('agenda', 'rowFocus'), SCROLL_ROW = ST['agenda-hover'].scrollY, dlg = R('modal', 'dialog');
const markR = R('inicio', 'mark');

camera('#cam', [
  { t: TL.toApp[0], cx: VW / 2, cy: VH / 2, z: 0.9 },
  { t: TL.toApp[1], cx: VW / 2, cy: VH / 2, z: 1.0, ease: 'emph' },
  { t: TL.inicioFocus[0] + 1.1 * K, cx: center(kpiBand).x, cy: center(kpiBand).y + 40, z: Z.inicio[1] },
  { t: TL.cursorToAgenda[1] + 0.1 * K, cx: 600, cy: 330, z: Z.inicio[0] },
  { t: TL.toAgenda[1], cx: 600, cy: 360, z: 1.1 },
  { t: TL.agendaScroll[1] + 0.1 * K, cx: 860, cy: rowF.y - SCROLL_ROW + 20, z: Z.agenda[1] - 0.04 },
  { t: TL.result + 0.1 * K, cx: 870, cy: rowF.y - SCROLL_ROW + 24, z: Z.agenda[1] },
  { t: TL.scrollToKpis[1], cx: 692, cy: 405, z: 1.04 },
  { t: TL.toAtendimentos[1], cx: 692, cy: 405, z: 1.04 },
  { t: TL.toDetail[1] + 0.05 * K, cx: 540, cy: 330, z: Z.detail - 0.04 },
  { t: TL.pressFechar, cx: 545, cy: 330, z: Z.detail },
  { t: TL.modal[1] + 0.35 * K, cx: center(dlg).x, cy: center(dlg).y, z: Z.modal - 0.06 },
  { t: TL.toFinal[1], cx: center(dlg).x, cy: center(dlg).y, z: Z.modal + 0.06 },
]);
const CAMF = [
  { t: TL.toFinal[0], cx: center(kpiBand).x, cy: center(kpiBand).y + 30, z: Z.final[0] + 0.06 },
  { t: TL.pullBack[0], cx: center(kpiBand).x, cy: center(kpiBand).y + 30, z: Z.final[0] },
  { t: TL.pullBack[1], cx: VW / 2, cy: VH / 2, z: Z.final[1] },
  { t: DUR, cx: VW / 2, cy: VH / 2, z: Z.final[1] - 0.035, ease: 'lin' },
];
camera('#camf', CAMF);

// ---- 01 identidade: the wordmark types itself, the mark resolves, the lockup lands in the sidebar
const WORD = `${BR.name}.${BR.suffix}`;
[...WORD].forEach((_, i) => to(`#ch${i}`, 'opacity', TL.typeStart + i * TL.typeStep, TL.typeStart + i * TL.typeStep + 0.06 * K, 1, 'lin', { from: 0 }));
to('#markg', 'opacity', TL.markResolve, TL.markResolve + 0.1 * K, 1, 'std', { from: 0 });
for (const [sel, dir] of [['#pa', -1], ['#pb', 1]]) {
  const svg = { svgOrigin: '16 16' };
  to(sel, 'rotation', TL.markResolve, TL.markResolve + 0.56 * K, 0, 'emph', { from: 34 * dir, extra: svg });
  to(sel, 'x', TL.markResolve, TL.markResolve + 0.56 * K, 0, 'emph', { from: 0.96 * dir });
  to(sel, 'opacity', TL.markResolve, TL.markResolve + 0.56 * K, 1, 'emph', { from: 0.55 });
}
const LOCK_W = 22 + 8 + R('inicio', 'wordmark').w, K0 = 4.6;
const lockEnd = project(camXform({ cx: VW / 2, cy: VH / 2, z: 1 }), markR);
set('#lockup', 'x', 0, W / 2 - LOCK_W * K0 / 2); set('#lockup', 'y', 0, H / 2 - 11 * K0); set('#lockup', 'scale', 0, K0);
to('#lockup', 'x', TL.toApp[0], TL.toApp[1], lockEnd.x - markR.x * S0 + markR.x * S0 - 0, 'emph');
to('#lockup', 'y', TL.toApp[0], TL.toApp[1], lockEnd.y, 'emph');
to('#lockup', 'scale', TL.toApp[0], TL.toApp[1], S0, 'emph');
to('#lockup', 'opacity', TL.toApp[1] - 0.12 * K, TL.toApp[1], 0, 'std', { from: 1 });
to('#patch', 'opacity', TL.toApp[1] - 0.12 * K, TL.toApp[1], 0, 'std', { from: 1 });
to('#appwrap', 'opacity', TL.toApp[0] + 0.05 * K, TL.toApp[1], 1, 'std', { from: 0 });
to('#appwrap', 'filter', TL.toApp[0] + 0.05 * K, TL.toApp[1], 'blur(0px)', 'std', { from: 'blur(10px)' });

// ---- the real UI states
const states = new Set();
const op = s => `#s-${s}`;
let topState = null;
// a state crossfades in on top (state change: opacity, --duration-interacao)
function show(s, t0, dur, ease = 'std', opts = {}) {
  states.add(s);
  to(op(s), 'opacity', t0, t0 + dur, 1, ease, { from: 0 });
  if (opts.scroll) scrollStates.add(s);
  const below = [...stackBelow];
  if (below.length) for (const b of below) set(op(b), 'opacity', t0 + dur, 0);
  stackBelow.clear(); stackBelow.add(s); topState = s;
}
const stackBelow = new Set();
const scrollStates = new Set();
// a page change: shell stays, old content leaves, new content rises in (rise-in)
function navigate(a, b, t0, t1, opts = {}) {
  states.add(b); const d = t1 - t0;
  if (opts.scroll) scrollStates.add(b);
  set(op(b), 'opacity', t0, 1, { init: 0 });
  to(`${op(a)} .content`, 'opacity', t0, t0 + 0.42 * d, 0, 'std', { from: 1 });
  to(`${op(b)} .content`, 'opacity', t0 + 0.28 * d, t1, 1, 'emph', { from: 0 });
  to(`${op(b)} .content`, 'y', t0 + 0.28 * d, t1, 0, 'emph', { from: MO.riseIn * 2 });
  to(`${op(b)} .chrome`, 'opacity', t0, t0 + 0.5 * d, 1, 'std', { from: 0 });
  for (const s of stackBelow) set(op(s), 'opacity', t1, 0);
  stackBelow.clear(); stackBelow.add(b); topState = b;
}

states.add('inicio'); stackBelow.add('inicio'); set(op('inicio'), 'opacity', 0, 1, { init: 1 });
show('inicio-hover', TL.cursorToAgenda[1] - 0.08 * K, X * 0.6);
show('inicio-press', TL.pressAgenda, P);
navigate('inicio-press', 'agenda', TL.toAgenda[0], TL.toAgenda[1], { scroll: true });
show('agenda-hover', TL.cursorToStart[1] - 0.1 * K, X * 0.6, 'std', { scroll: true });
show('agenda-press', TL.pressStart, P, 'std', { scroll: true });
show('agenda-pending', TL.pending, X * 0.7, 'std', { scroll: true });
show('agenda-result', TL.result, X * 1.4, 'std', { scroll: true });
show('agenda-press-subnav', TL.pressSubnav, P, 'std', { scroll: true });
navigate('agenda-press-subnav', 'atendimentos', TL.toAtendimentos[0], TL.toAtendimentos[1]);
show('atendimentos-hover', TL.cursorToRow[1] - 0.08 * K, X * 0.5);
show('atendimentos-press', TL.pressRow, P);
navigate('atendimentos-press', 'atendimento', TL.toDetail[0], TL.toDetail[1]);
show('atendimento-hover', TL.cursorToFechar[1] - 0.08 * K, X * 0.5);
show('atendimento-press', TL.pressFechar, P);
// <dialog> open:animate-scale-in — backdrop fades in, the panel scales 0.97 → 1
states.add('modal');
to('#s-modal-bg', 'opacity', TL.modal[0], TL.modal[1], 1, 'emph', { from: 0 });
to('#s-modal-dlg', 'opacity', TL.modal[0], TL.modal[1], 1, 'emph', { from: 0 });
to('#s-modal-dlg', 'scale', TL.modal[0], TL.modal[1], 1, 'emph', { from: 0.97 });
for (const s of stackBelow) if (s !== 'atendimento-press') set(op(s), 'opacity', TL.modal[1], 0);
show('modal-press', TL.pressConfirm, P);
// dip to the app background, then Início comes back with the new sale
to('#dip', 'opacity', TL.toFinal[0], TL.toFinal[0] + 0.45 * (TL.toFinal[1] - TL.toFinal[0]), 1, 'std', { from: 0 });
to('#appf', 'opacity', TL.toFinal[0] + 0.3 * (TL.toFinal[1] - TL.toFinal[0]), TL.toFinal[1], 1, 'emph', { from: 0 });
to('#s-kpi-before', 'opacity', TL.numbersUpdate, TL.numbersUpdate + X, 0, 'std', { from: 1 }); // a data refresh is near-instant

// the agenda scrolls like a person scrolling (same offset for every agenda state)
for (const s of scrollStates) {
  const sel = `${op(s)} .page`;
  track(sel, 'y', 0);
  to(sel, 'y', TL.agendaScroll[0], TL.agendaScroll[1], -SCROLL_ROW, 'std');
  to(sel, 'y', TL.scrollToKpis[0], TL.scrollToKpis[1], 0, 'std');
}

// window chrome only exists once the camera pulls out of the app (z < 1)
function zAt(t) { return valueAt(tracks.get('#camf|scale'), t) / S0; }
function whenZ(z) { let a = TL.pullBack[0], b = TL.pullBack[1]; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; zAt(m) > z ? a = m : b = m; } return a; }
const tz1 = whenZ(1.0), tz2 = whenZ(0.92);
to('#winf', 'borderRadius', tz1, tz2, MO.windowRadius, 'lin', { from: 0 });
to('#winf-deco', 'opacity', tz1, tz2, 1, 'lin', { from: 0 });

// ---- 05: the lockup lifts out of the sidebar to the centre, the tagline settles under it
const liftStart = project(camAt('#camf', TL.lockupOut[0]), markR), liftK = camAt('#camf', TL.lockupOut[0]).scale;
const K2 = 3.6, endX = W / 2 - LOCK_W * K2 / 2, endY = H / 2 - 11 * K2 - 22 * K2 / 3.6;
set('#lockup2', 'opacity', TL.lockupOut[0], 1, { init: 0 });
set('#patchf', 'opacity', TL.lockupOut[0], 1, { init: 0 });
set('#lockup2', 'x', 0, liftStart.x); set('#lockup2', 'y', 0, liftStart.y); set('#lockup2', 'scale', 0, liftK);
to('#lockup2', 'x', TL.lockupOut[0], TL.lockupOut[1], endX, 'glide');
to('#lockup2', 'y', TL.lockupOut[0], TL.lockupOut[1], endY, 'glide');
to('#lockup2', 'scale', TL.lockupOut[0], TL.lockupOut[1], K2, 'glide');
to('#appfwrap', 'opacity', TL.lockupOut[0] - 0.15 * K, TL.lockupOut[0] + 0.5 * K, 0, 'std', { from: 1 });
to('#appfwrap', 'filter', TL.lockupOut[0] - 0.15 * K, TL.lockupOut[0] + 0.5 * K, 'blur(6px)', 'std', { from: 'blur(0px)' });
to('#tagline', 'opacity', TL.tagline[0], TL.tagline[1], 1, 'emph', { from: 0 });
to('#tagline', 'y', TL.tagline[0], TL.tagline[1], 0, 'emph', { from: MO.riseIn * 2 });
to('#tagline', 'opacity', TL.fadeOut[0], TL.fadeOut[1], 0, 'std');
to('#lockup2', 'opacity', TL.fadeOut[0], TL.fadeOut[1], 0, 'std');

// ---- cursor: in viewport css px, inside the camera (it scales with the UI, like a screen recording)
const tgt = (s, n, dx = 0.5, dy = 0.5, max = 60) => { const r = R(s, n); return { x: r.x + Math.min(r.w * dx, max), y: r.y + r.h * dy }; };
const bs = R('agenda', 'btnStart'), startPt = { x: bs.x + bs.w * 0.42, y: bs.y - SCROLL_ROW + bs.h * 0.55 };
const PATH = [
  [TL.cursorToAgenda[0], { x: 1010, y: 720 }], [TL.cursorToAgenda[1], tgt('inicio', 'navAgenda', 0.3)],
  [TL.cursorToStart[0], null], [TL.cursorToStart[1], startPt],
  [TL.cursorToSubnav[0], null], [TL.cursorToSubnav[1], tgt('agenda', 'subAtendimento', 0.3)],
  [TL.cursorToRow[0], null], [TL.cursorToRow[1], tgt('atendimentos', 'rowFocus', 0.12, 0.5, 400)],
  [TL.cursorToFechar[0], null], [TL.cursorToFechar[1], tgt('atendimento', 'btnFechar', 0.55, 0.55, 400)],
  [TL.cursorToConfirm[0], null], [TL.cursorToConfirm[1], tgt('modal', 'btnConfirm', 0.5, 0.55, 400)],
];
set('#cursor', 'x', 0, PATH[0][1].x); set('#cursor', 'y', 0, PATH[0][1].y);
for (let i = 1; i < PATH.length; i += 2) {
  to('#cursor', 'x', PATH[i - 1][0], PATH[i][0], PATH[i][1].x, 'cur');
  to('#cursor', 'y', PATH[i - 1][0], PATH[i][0], PATH[i][1].y, 'curY'); // a slightly different y ease = a hand's arc
}
to('#cursor', 'opacity', TL.cursorToAgenda[0], TL.cursorToAgenda[0] + 0.25 * K, 1, 'std', { from: 0 });
to('#cursor', 'opacity', TL.pressConfirm + 0.08 * K, TL.pressConfirm + 0.22 * K, 0, 'std');
for (const p of [TL.pressAgenda, TL.pressStart, TL.pressSubnav, TL.pressRow, TL.pressFechar, TL.pressConfirm]) {
  to('#arrow', 'scale', p - 0.02 * K, p + 0.05 * K, 0.88, 'std', { init: 1 });
  to('#arrow', 'scale', p + 0.05 * K, p + 0.16 * K, 1, 'std');
}

// ================================================================= emit
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = f => `assets/captures/${f}.png`;
function stateHTML(s, scene) {
  const st = ST[s], a = st.rects.aside, h = st.rects.header;
  if (!st.fullPage) return `<div class="state full" id="${scene}-s-${s}"><img src="${img(s + '.chrome')}" alt=""></div>`;
  return `<div class="state" id="${scene}-s-${s}">
      <div class="content" data-layout-allow-overflow><img class="page" src="${img(s + '.page')}" style="height:${st.docHeight}px" alt=""></div>
      <div class="chrome" style="clip-path:path('M${a.x} ${a.y}h${a.w}v${a.h}h${-a.w}Z M${h.x} ${h.y}h${h.w}v${h.h}h${-h.w}Z')"><img src="${img(s + '.chrome')}" alt=""></div>
    </div>`;
}
const MARK_SVG = (() => {
  const cx = 16, cy = 16, r = 13, ang = 22, rad = d => d * Math.PI / 180;
  const p1 = { x: cx + r * Math.cos(rad(90 - ang)), y: cy - r * Math.sin(rad(90 - ang)) }, p2 = { x: cx + r * Math.cos(rad(270 - ang)), y: cy - r * Math.sin(rad(270 - ang)) };
  const f = n => n.toFixed(4);
  return (id) => `<svg class="mark" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><g id="${id}-markg">` +
    `<path id="${id}-pa" d="M ${f(p1.x)} ${f(p1.y)} A 13 13 0 0 1 ${f(p2.x)} ${f(p2.y)} Z" fill="#D8CFCA"/>` +
    `<path id="${id}-pb" d="M ${f(p1.x)} ${f(p1.y)} A 13 13 0 0 0 ${f(p2.x)} ${f(p2.y)} Z" fill="#0093D6"/></g></svg>`;
})();
// Same markup and metrics as AppNav: CortexMark 22px, gap 8px, Wordmark md (17px Panchang 700, -0.005em)
const lockupHTML = (id, sceneId, typed) => `<div class="lockup" id="${sceneId}-${id}">${MARK_SVG(sceneId)}` +
  `<span class="wordmark">${[...WORD].map((c, i) => `<span${typed ? ` id="${sceneId}-ch${i}"` : ''}${c === '.' ? ' class="dot"' : ''}>${esc(c)}</span>`).join('')}</span></div>`;

function windowHTML(scene, camId, wrapId, winId, list, extras = '') {
  return `<div class="appwrap" id="${scene}-${wrapId}">
    <div class="cam" id="${scene}-${camId}">
      <div class="win-shadow" id="${scene}-${winId}-deco"></div>
      <div class="win" id="${scene}-${winId}">
        ${list.map(s => stateHTML(s, scene)).join('\n        ')}
        ${extras}
      </div>
      <div class="win-border" id="${scene}-${winId}-deco2"></div>
      ${camId === 'cam' ? `<div class="cursor" id="${scene}-cursor"><svg id="${scene}-arrow" class="arrow" viewBox="-2 -2 16 22" width="16" height="22" aria-hidden="true"><path d="M0 0 L0 15.6 L3.9 12.2 L6.5 17.9 L8.8 16.9 L6.3 11.3 L11.2 11.3 Z" fill="#F6F2F1" stroke="#041723" stroke-width="1.1" stroke-linejoin="round"/></svg></div>` : ''}
    </div>
  </div>`;
}

const RUNTIME = `
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let s = x; for (let i = 0; i < 10; i++) { const d = dX(s); if (Math.abs(d) < 1e-7) break; s -= (X(s) - x) / d; } return Y(Math.min(1, Math.max(0, s))); };
}
function buildTimeline(D) {
  const root = document.querySelector('[data-composition-id="' + D.id + '"]');
  const E = {}; for (const k in D.eases) E[k] = bezier.apply(null, D.eases[k]);
  // a move that straddles a cut continues on the same curve: re-map the ease to its [u0, u1] slice
  const slice = (f, u0, u1) => (u0 === 0 && u1 === 1) ? f : (u => (f(u0 + (u1 - u0) * u) - f(u0)) / ((f(u1) - f(u0)) || 1));
  const tl = gsap.timeline({ paused: true });
  for (const tr of D.tracks) {
    const el = root.querySelector(tr.sel); if (!el) continue;
    tl.set(el, Object.assign({ [tr.prop]: tr.init }, tr.extra), 0);
    for (const s of tr.segs) {
      if (s.d <= 0) { tl.set(el, Object.assign({ [tr.prop]: s.v1 }, tr.extra), s.t); continue; }
      tl.fromTo(el, Object.assign({ [tr.prop]: s.v0 }, tr.extra),
        Object.assign({ [tr.prop]: s.v1, duration: s.d, ease: slice(E[s.ease], s.u0, s.u1), immediateRender: false }, tr.extra), s.t);
    }
  }
  return tl;
}`;

function sceneData(sc, sels) {
  const t0 = sc.start * K, t1 = sc.end * K, out = [];
  for (const tr of tracks.values()) {
    const base = tr.sel.replace(/^#/, '');
    if (!sels.has(base.split(' ')[0])) continue;
    const segs = [];
    for (const s of tr.segs) {
      if (s.t1 <= t0 && s.t1 > s.t0) continue;
      if (s.t0 >= t1) continue;
      if (s.t1 <= s.t0) { if (s.t0 >= t0 && s.t0 < t1) segs.push({ t: s.t0 - t0, d: 0, v1: s.v1 }); continue; }
      const a = Math.max(s.t0, t0), b = Math.min(s.t1, t1);
      if (b <= a) continue;
      const u0 = (a - s.t0) / (s.t1 - s.t0), u1 = (b - s.t0) / (s.t1 - s.t0), f = EASE[s.ease];
      segs.push({ t: +(a - t0).toFixed(4), d: +(b - a).toFixed(4), ease: s.ease, u0: +u0.toFixed(5), u1: +u1.toFixed(5),
        v0: interp(s.v0, s.v1, f(u0)), v1: interp(s.v0, s.v1, f(u1)) });
    }
    const sel = tr.sel.replace(/^#([\w-]+)/, `#${sc.id}-$1`);
    out.push({ sel, prop: tr.prop, init: valueAt(tr, t0 - 1e-9), extra: tr.extra, segs });
  }
  return out;
}

// which real states each scene needs (anything visible at some point inside it)
function visibleIn(s, t0, t1) {
  const tr = tracks.get(`${op(s)}|opacity`); if (!tr) return false;
  for (let t = t0; t < t1; t += 1 / 120) if (valueAt(tr, t) > 0.001) return true;
  return false;
}

mkdirSync(path.join(dir, 'compositions/frames'), { recursive: true });
const frames = [];
config.scenes.forEach((sc, idx) => {
  const t0 = sc.start * K, t1 = sc.end * K, id = sc.id;
  const list = [...states].filter(s => s !== 'modal' && visibleIn(s, t0, t1));
  const hasModal = visibleIn('modal', t0, t1) || (TL.modal[0] < t1 && TL.toFinal[0] >= t0 && t0 <= TL.toFinal[0] && t1 > TL.modal[0]);
  const isIntro = t0 < TL.toApp[1], hasFinal = t1 > TL.toFinal[0], hasApp = t0 < TL.toFinal[1];
  const modalHTML = hasModal ? `<div class="state full clipped" id="${id}-s-modal-bg" style="clip-path:path(evenodd,'M0 0H${VW}V${VH}H0Z M${dlg.x} ${dlg.y}h${dlg.w}v${dlg.h}h${-dlg.w}Z')"><img src="${img('modal.chrome')}" alt=""></div>
        <div class="state full clipped" id="${id}-s-modal-dlg" style="clip-path:inset(${dlg.y}px ${VW - dlg.x - dlg.w}px ${VH - dlg.y - dlg.h}px ${dlg.x}px);transform-origin:${center(dlg).x}px ${center(dlg).y}px;background:url('${img('modal.chrome')}') 0 0 / ${VW}px ${VH}px no-repeat"></div>` : '';
  const modalPress = hasModal && list.includes('modal-press');
  const appList = list.filter(s => s !== 'modal-press' && s !== 'inicio-final');
  const patch = `<div class="patch" id="${id}-patch" style="left:${markR.x - 2}px;top:${markR.y - 2}px"></div>`;
  let body = '';
  if (hasApp && !(t0 >= TL.toFinal[1])) {
    body += windowHTML(id, 'cam', 'appwrap', 'win', appList,
      `${modalHTML}${modalPress ? stateHTML('modal-press', id) : ''}${isIntro ? patch : ''}<div class="dip" id="${id}-dip"></div>`);
  }
  if (hasFinal) {
    const kpi = `<div class="state" id="${id}-s-kpi-before" style="clip-path:inset(${kpiBand.y}px ${VW - kpiBand.x - kpiBand.w}px ${VH - kpiBand.y - kpiBand.h}px ${kpiBand.x}px)"><div class="content" data-layout-allow-overflow><img class="page" src="${img('inicio.page')}" style="height:${ST.inicio.docHeight}px" alt=""></div></div>`;
    body += `<div class="appf" id="${id}-appf">` + windowHTML(id, 'camf', 'appfwrap', 'winf', [], `${stateHTML('inicio-final', id).replace(`id="${id}-s-inicio-final"`, `id="${id}-s-inicio-final" style="opacity:1"`)}${kpi}<div class="patch" id="${id}-patchf" style="left:${markR.x - 2}px;top:${markR.y - 2}px"></div>`) + `</div>`;
    body += lockupHTML('lockup2', id, false) + `<p class="tagline" id="${id}-tagline">${esc(BR.tagline)}</p>`;
  }
  if (isIntro) body += lockupHTML('lockup', id, true);

  const sels = new Set(['cam', 'camf', 'appwrap', 'appfwrap', 'appf', 'winf', 'winf-deco', 'dip', 'patch', 'patchf', 'cursor', 'arrow', 'lockup', 'lockup2', 'tagline', 'markg', 'pa', 'pb', 's-kpi-before', 's-modal-bg', 's-modal-dlg',
    ...[...WORD].map((_, i) => `ch${i}`), ...list.map(s => `s-${s}`)]);
  if (!isIntro) ['lockup', 'markg', 'pa', 'pb', 'patch', ...[...WORD].map((_, i) => `ch${i}`)].forEach(s => sels.delete(s));
  if (!hasFinal) ['camf', 'appfwrap', 'appf', 'winf', 'winf-deco', 'lockup2', 'tagline', 'patchf', 's-kpi-before'].forEach(s => sels.delete(s));
  if (!hasModal) ['s-modal-bg', 's-modal-dlg'].forEach(s => sels.delete(s));
  const data = { id, eases: BEZ, tracks: sceneData(sc, sels) };
  // the final scene has its own lockup: point the '#lockup2' mark/char ids used above at it
  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>${esc(sc.title)}</title></head>
<body>
<template>
<style>
  @font-face { font-family: "Panchang"; src: url("assets/fonts/Panchang-Variable.woff2") format("woff2"); font-weight: 200 800; }
  @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; }
  #${id} { position: absolute; inset: 0; overflow: hidden; }
  #${id} .appwrap, #${id} .appf { position: absolute; inset: 0; }
  #${id} .cam { position: absolute; left: 0; top: 0; width: ${VW}px; height: ${VH}px; transform-origin: 0 0; }
  #${id} .win { position: absolute; inset: 0; overflow: hidden; background: #0F1F29; }
  #${id} .win-shadow { position: absolute; inset: 0; border-radius: ${MO.windowRadius}px; box-shadow: 0 30px 90px rgba(1, 8, 14, 0.55); opacity: 0; }
  #${id} .win-border { position: absolute; inset: 0; border-radius: ${MO.windowRadius}px; border: 1px solid rgba(232, 230, 221, 0.16); opacity: 0; pointer-events: none; }
  #${id} .state { position: absolute; inset: 0; opacity: 0; }
  #${id} .state .content { position: absolute; inset: 0; overflow: hidden; }
  #${id} .state .page { position: absolute; left: 0; top: 0; width: ${VW}px; display: block; }
  #${id} .state .chrome { position: absolute; inset: 0; }
  #${id} .state .chrome img { position: absolute; left: 0; top: 0; width: ${VW}px; height: ${VH}px; }
  #${id} .state.full img { position: absolute; inset: 0; width: ${VW}px; height: ${VH}px; }
  #${id} .patch { position: absolute; width: 196px; height: 26px; background: #041723; opacity: 0; }
  #${id} .dip { position: absolute; inset: 0; background: #0F1F29; opacity: 0; }
  #${id} .cursor { position: absolute; left: 0; top: 0; width: 16px; height: 22px; opacity: 0; }
  #${id} .cursor .arrow { position: absolute; left: -2px; top: -2px; transform-origin: 2px 2px; filter: drop-shadow(0 1.5px 2.5px rgba(1, 8, 14, 0.45)); }
  #${id} .lockup { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 8px; transform-origin: 0 0; opacity: 0; white-space: nowrap; }
  #${id} .lockup .mark { display: block; flex: none; }
  #${id} .wordmark { font-family: "Panchang", sans-serif; font-weight: 700; font-variation-settings: "wght" 700; font-size: 17px; line-height: 1; letter-spacing: -0.005em; color: #D8CFCA; display: inline-flex; align-items: baseline; }
  #${id} .wordmark .dot { color: #0093D6; }
  #${id} .tagline { position: absolute; left: 0; right: 0; top: ${Math.round(endY + 22 * K2 + 64)}px; text-align: center; font-family: "Geist", sans-serif; font-weight: 600; font-size: 21px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(232, 230, 221, 0.62); opacity: 0; }
</style>
<div id="${id}" data-composition-id="${id}" data-width="${W}" data-height="${H}">
  ${body}
</div>
<script>
${RUNTIME}
window.__timelines["${id}"] = buildTimeline(${JSON.stringify(data).replace(/"#lockup2"/g, '"#lockup2"')});
</script>
</template>
</body>
</html>
`;
  // lockup2 in scene 05 reuses the mark markup ids of its scene; typed chars only exist in the intro
  const file = `compositions/frames/${String(idx + 1).padStart(2, '0')}-${id.replace(/^f\d+-/, '')}.html`;
  writeFileSync(path.join(dir, file), html);
  frames.push({ ...sc, file, t0, t1 });
  console.log(`✓ ${file}  ${(t1 - t0).toFixed(2)}s  states: ${list.join(', ')}${hasModal ? ', modal' : ''}`);
});

// ------------------------------------------------------------ index.html
const glow = [[0, 0], [0.1, 0], [1.4, 1], [TL.toApp[0], 1], [TL.toApp[1], 0], [TL.pullBack[0] + 0.6 * K, 0], [TL.pullBack[1] + 0.6 * K, 1]];
const wav = 'assets/trailer.wav';
if (OUT.audio) {
  writeFileSync(path.join(dir, '.timeline.json'), JSON.stringify({ ...OUT, timeline: TL0 }));
  execFileSync('python3', [path.join(dir, 'audio.py'), path.join(dir, '.timeline.json'), path.join(dir, wav)], { stdio: 'inherit' });
}
const index = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>CORTEX.OS — trailer de lançamento</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #041723; }
      #main { width: 100%; height: 100%; position: relative; background: #041723; }
      /* the Landing hero's own light: a Kahu Blue radial, top right */
      #main .glow { position: absolute; inset: 0; background: radial-gradient(circle at 84% 8%, rgba(0, 147, 214, 0.16), rgba(0, 147, 214, 0) 55%); opacity: 0; }
      #main .scene { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <!-- generated by build.mjs from trailer.config.mjs — edit the config, then \`node build.mjs\` -->
    <div id="main" data-composition-id="main" data-start="0" data-duration="${DUR.toFixed(3)}" data-width="${W}" data-height="${H}">
      <div class="glow clip" id="glow" data-start="0" data-duration="${DUR.toFixed(3)}" data-track-index="0"></div>
${frames.map((f, i) => `      <div class="scene" id="${f.id}" data-composition-id="${f.id}" data-composition-src="${f.file}" data-start="${f.t0.toFixed(3)}" data-duration="${(f.t1 - f.t0).toFixed(3)}" data-track-index="${i % 2 + 1}" data-width="${W}" data-height="${H}"></div>`).join('\n')}
${OUT.audio ? `      <audio id="score" src="${wav}" data-start="0" data-duration="${DUR.toFixed(3)}" data-track-index="3" data-volume="1"></audio>` : ''}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      const glow = document.getElementById("glow");
      const keys = ${JSON.stringify(glow)};
      tl.set(glow, { opacity: 0 }, 0);
      for (let i = 1; i < keys.length; i++) if (keys[i][1] !== keys[i - 1][1])
        tl.fromTo(glow, { opacity: keys[i - 1][1] }, { opacity: keys[i][1], duration: keys[i][0] - keys[i - 1][0], ease: "power1.inOut", immediateRender: false }, keys[i - 1][0]);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(path.join(dir, 'index.html'), index);
console.log('✓ index.html', DUR.toFixed(2) + 's', OUT.audio ? '(+ assets/trailer.wav)' : '');
