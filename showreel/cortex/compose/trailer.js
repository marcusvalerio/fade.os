/* CORTEX.OS trailer compositor.
 *
 * Everything on screen is either a captured state of the real app
 * (../captures, produced by capture.mjs) or the product's own brand elements
 * (Wordmark in Panchang, the CortexMark geometry from components/ui/cortex-mark.tsx).
 * This file only adds camera, cursor and the timing of the cuts between those
 * real states. Frames are a pure function of t, so rendering is deterministic.
 */
import config from '../config.mjs';

const TL = config.timeline, MO = config.motion, BR = config.brand;
const W = config.output.width, H = config.output.height;
const cv = document.getElementById('c');
cv.width = W; cv.height = H;
const out = cv.getContext('2d');

// ---------------------------------------------------------------- tokens
// Straight from app/globals.css (dark register, shell = Creeping Depth).
const INK = '#041723', ONYX = '#0F1F29', BONE = '#D8CFCA', BLUE = '#0093D6';
const MUTED = 'rgba(232,230,221,0.62)';

// ------------------------------------------------------------------ math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
function bezier(x1, y1, x2, y2) { // CSS cubic-bezier
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let s = x; for (let i = 0; i < 8; i++) { const d = dX(s); if (Math.abs(d) < 1e-6) break; s -= (X(s) - x) / d; } return Y(clamp(s)); };
}
const emph = bezier(...MO.emphasized);             // --ease-emphasized
const std = bezier(...MO.standard);                // --ease-standard
const glide = bezier(0.45, 0, 0.15, 1);            // camera: slow in, long settle
const E = (t, a, b, f = emph) => f(prog(t, a, b));

// ------------------------------------------------------------ captures
const manifest = await fetch('../captures/manifest.json').then(r => r.json());
const VW = manifest.viewport.width, VH = manifest.viewport.height, PX = manifest.scale;
const S0 = W / VW; // frame px per css px at zoom 1
const ST = manifest.states;
const R = (s, n) => ST[s].rects[n];
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// Lazy 4K bitmap cache — frames are rendered in order, so a small LRU is enough.
const cache = new Map();
async function bitmap(key) {
  let e = cache.get(key);
  if (!e) {
    e = { p: fetch(`../captures/${key}.png`).then(r => r.blob()).then(b => createImageBitmap(b)) };
    cache.set(key, e);
    e.img = await e.p;
  } else if (!e.img) e.img = await e.p;
  e.used = performance.now();
  if (cache.size > 12) {
    const old = [...cache.entries()].filter(([, v]) => v.img).sort((a, b) => a[1].used - b[1].used)[0];
    if (old && old[0] !== key) { old[1].img.close(); cache.delete(old[0]); }
  }
  return e.img;
}
const need = new Set();
const img = key => { need.add(key); return cache.get(key)?.img; };

// ------------------------------------------------------------- camera
// A camera is { cx, cy, z } in viewport css px; z = 1 fills the frame exactly.
function clampCam(c) {
  const S = c.z * S0, hw = W / 2 / S, hh = H / 2 / S;
  const cx = hw * 2 >= VW ? VW / 2 : clamp(c.cx, hw, VW - hw);
  const cy = hh * 2 >= VH ? VH / 2 : clamp(c.cy, hh, VH - hh);
  return { cx, cy, z: c.z, S };
}
function track(keys, t, f = glide) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) {
    const a = keys[i - 1], b = keys[i], u = (keys[i].ease || f)(prog(t, a.t, b.t));
    return { cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u), z: lerp(a.z, b.z, u) };
  }
  return keys[keys.length - 1];
}
const toFrame = (cam, p) => ({ x: W / 2 + (p.x - cam.cx) * cam.S, y: H / 2 + (p.y - cam.cy) * cam.S });

const Z = MO.cameraZoom;
const fat = R('inicio', 'faturamento'), kpiA = R('inicio', 'kpiAtendimentos');
const kpiBand = { x: fat.x - 8, y: fat.y - 8, w: kpiA.x + kpiA.w - fat.x + 16, h: Math.max(fat.h, kpiA.h) + 20 };
const rowF = R('agenda', 'rowFocus'), SCROLL_ROW = ST['agenda-hover'].scrollY;
const dlg = R('modal', 'dialog');

// One continuous camera through the operational part of the story.
const CAM_APP = [
  { t: TL.toApp[0], cx: VW / 2, cy: VH / 2, z: 0.9 },
  { t: TL.toApp[1], cx: VW / 2, cy: VH / 2, z: 1.0 },
  { t: TL.inicioFocus[0] + 1.1, cx: center(kpiBand).x, cy: center(kpiBand).y + 40, z: Z.inicio[1] },
  { t: TL.cursorToAgenda[1] + 0.1, cx: 600, cy: 330, z: Z.inicio[0] },
  { t: TL.toAgenda[1], cx: 600, cy: 360, z: 1.1 },
  { t: TL.agendaScroll[1] + 0.1, cx: 860, cy: rowF.y - SCROLL_ROW + 20, z: Z.agenda[1] - 0.04 },
  { t: TL.result + 0.1, cx: 870, cy: rowF.y - SCROLL_ROW + 24, z: Z.agenda[1] },
  { t: TL.scrollToKpis[1], cx: 692, cy: 405, z: 1.04 },
  { t: TL.toAtendimentos[1], cx: 692, cy: 405, z: 1.04 },
  { t: TL.toDetail[1] + 0.05, cx: 540, cy: 330, z: Z.detail - 0.04 },
  { t: TL.pressFechar, cx: 545, cy: 330, z: Z.detail },
  { t: TL.modal[1] + 0.35, cx: center(dlg).x, cy: center(dlg).y, z: Z.modal - 0.06 },
  { t: TL.toFinal[1], cx: center(dlg).x, cy: center(dlg).y, z: Z.modal + 0.06 },
];
const CAM_FINAL = [
  { t: TL.toFinal[0], cx: center(kpiBand).x, cy: center(kpiBand).y + 30, z: Z.final[0] + 0.06 },
  { t: TL.pullBack[0], cx: center(kpiBand).x, cy: center(kpiBand).y + 30, z: Z.final[0] },
  { t: TL.pullBack[1], cx: VW / 2, cy: VH / 2, z: Z.final[1] },
  { t: config.output.duration, cx: VW / 2, cy: VH / 2, z: Z.final[1] - 0.035, ease: t => t },
];
const SCROLL = [ // agenda scroll position (css px), like a person scrolling
  { t: TL.agendaScroll[0], v: 0 }, { t: TL.agendaScroll[1], v: SCROLL_ROW },
  { t: TL.scrollToKpis[0], v: SCROLL_ROW }, { t: TL.scrollToKpis[1], v: 0 },
];
function scrollAt(t) {
  if (t <= SCROLL[0].t) return SCROLL[0].v;
  for (let i = 1; i < SCROLL.length; i++) if (t <= SCROLL[i].t) return lerp(SCROLL[i - 1].v, SCROLL[i].v, std(prog(t, SCROLL[i - 1].t, SCROLL[i].t)));
  return SCROLL[SCROLL.length - 1].v;
}

// ------------------------------------------------------ drawing a state
// Content (full page, scrolled) under the sticky shell (aside + header), as the browser does.
function drawState(c, name, { scroll = 0, rise = 0, clip = null, except = null, part = 'all' } = {}) {
  const s = ST[name], chrome = img(`${name}.chrome`), page = s.fullPage ? img(`${name}.page`) : null;
  if (!chrome || (s.fullPage && !page)) return;
  c.save();
  if (clip || except) {
    c.beginPath();
    if (except) { c.rect(-VW, -VH, VW * 3, VH * 3); c.rect(except.x, except.y, except.w, except.h); c.clip('evenodd'); }
    else { c.rect(clip.x, clip.y, clip.w, clip.h); c.clip(); }
  }
  if (page) {
    const sc = clamp(scroll, 0, s.docHeight - VH);
    if (part !== 'chrome') c.drawImage(page, 0, sc * PX, VW * PX, VH * PX, 0, rise, VW, VH);
    const a = s.rects.aside, h = s.rects.header;
    if (part !== 'content') {
      c.drawImage(chrome, a.x * PX, a.y * PX, a.w * PX, a.h * PX, a.x, a.y, a.w, a.h);
      c.drawImage(chrome, h.x * PX, h.y * PX, h.w * PX, h.h * PX, h.x, h.y, h.w, h.h);
    }
  } else c.drawImage(chrome, 0, 0, VW * PX, VH * PX, 0, 0, VW, VH);
  c.restore();
}

// The app window: rounded, bordered and shadowed only once the camera pulls out.
const app = document.createElement('canvas'); app.width = W; app.height = H;
const actx = app.getContext('2d');
const mix = document.createElement('canvas'); mix.width = W; mix.height = H;
const mixx = mix.getContext('2d');
function beginWindow(c, cam) {
  c.setTransform(cam.S, 0, 0, cam.S, W / 2 - cam.cx * cam.S, H / 2 - cam.cy * cam.S);
  const k = clamp((1.001 - cam.z) / 0.08), r = MO.windowRadius * k;
  if (k > 0) {
    c.save();
    c.shadowColor = `rgba(1,8,14,${0.55 * k})`; c.shadowBlur = 90 * cam.S * k; c.shadowOffsetY = 30 * cam.S * k;
    c.fillStyle = ONYX; c.beginPath(); c.roundRect(0, 0, VW, VH, r); c.fill();
    c.restore();
  }
  c.save(); c.beginPath(); c.roundRect(0, 0, VW, VH, r); c.clip();
  c.fillStyle = ONYX; c.fillRect(0, 0, VW, VH);
  return k;
}
function endWindow(c, cam, k) {
  c.restore();
  if (k > 0) { c.strokeStyle = `rgba(232,230,221,${0.16 * k})`; c.lineWidth = 1 / cam.S; c.beginPath(); c.roundRect(0, 0, VW, VH, MO.windowRadius * k); c.stroke(); }
  c.setTransform(1, 0, 0, 1, 0, 0);
}

// Cross-dissolve between two real states (the product's state transitions are
// opacity changes; page changes add its rise-in: 6 px, emphasized ease).
function blend(c, a, b, u, opts = {}) {
  drawState(c, a, opts.a || {});
  if (u > 0) { c.globalAlpha = u; drawState(c, b, { ...(opts.b || {}), rise: opts.rise ? MO.riseIn * (1 - u) : 0 }); c.globalAlpha = 1; }
}

// Navigating between pages: the shell stays put (only the active item changes),
// the old content leaves, the new one settles in with the product's rise-in.
function navigate(c, a, b, u, opts = {}) {
  const out = 1 - std(clamp(u / 0.42)), inn = emph(clamp((u - 0.28) / 0.72));
  if (out > 0) { c.globalAlpha = out; drawState(c, a, { ...(opts.a || {}), part: 'content' }); }
  if (inn > 0) { c.globalAlpha = inn; drawState(c, b, { ...(opts.b || {}), part: 'content', rise: MO.riseIn * 2 * (1 - inn) }); }
  c.globalAlpha = 1; drawState(c, a, { ...(opts.a || {}), part: 'chrome' });
  c.globalAlpha = std(clamp(u / 0.5)); drawState(c, b, { ...(opts.b || {}), part: 'chrome' }); c.globalAlpha = 1;
}

// ------------------------------------------------------------- brand
// Lockup exactly as AppNav renders it: CortexMark 22px, gap 8px, Wordmark md (17px Panchang 700).
const MARK = (() => {
  const cx = 16, cy = 16, r = 13, ang = 22, rad = d => d * Math.PI / 180;
  const p1 = { x: cx + r * Math.cos(rad(90 - ang)), y: cy - r * Math.sin(rad(90 - ang)) };
  const p2 = { x: cx + r * Math.cos(rad(270 - ang)), y: cy - r * Math.sin(rad(270 - ang)) };
  return { a: new Path2D(`M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} Z`), b: new Path2D(`M ${p1.x} ${p1.y} A ${r} ${r} 0 0 0 ${p2.x} ${p2.y} Z`) };
})();
const WM = { size: 17, track: -0.005, markSize: 22, gap: 8 };
function wordmarkGlyphs(c) {
  c.font = `700 ${WM.size}px Panchang`;
  const chars = [...`${BR.name}.${BR.suffix}`];
  let x = 0; const g = [];
  for (const ch of chars) { const w = c.measureText(ch).width; g.push({ ch, x, dot: ch === '.' }); x += w + WM.track * WM.size; }
  return { g, width: x - WM.track * WM.size };
}
// (x, y) = top-left of the lockup in frame px, k = frame px per css px.
function drawLockup(c, x, y, k, { typed = 99, mark = 1, alpha = 1 } = {}) {
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(k, k);
  // CortexMark, with the cortex-resolve keyframes (halves ±34°, ±3% → aligned)
  if (mark > 0) {
    const u = emph(mark), s = WM.markSize / 32;
    for (const [path, dir, tone] of [[MARK.a, -1, BONE], [MARK.b, 1, BLUE]]) {
      c.save(); c.scale(s, s); c.translate(16, 16); c.rotate(dir * 34 * (1 - u) * Math.PI / 180); c.translate(-16 + dir * 0.96 * (1 - u), -16);
      c.globalAlpha = alpha * clamp(mark * 6) * lerp(0.55, 1, u); c.fillStyle = tone; c.fill(path); c.restore();
    }
  }
  // Wordmark: line-height 1 box of 17px, baseline centred like the DOM span
  const { g } = wordmarkGlyphs(c);
  const m = c.measureText('CORTEX'), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  const base = 2 + (WM.size - (asc + desc)) / 2 + asc;
  g.forEach((q, i) => {
    const a = clamp(typed - i); if (a <= 0) return;
    c.globalAlpha = alpha * a; c.fillStyle = q.dot ? BLUE : BONE;
    c.fillText(q.ch, WM.markSize + WM.gap + q.x, base);
  });
  c.restore();
}
function lockupWidth(c) { return WM.markSize + WM.gap + wordmarkGlyphs(c).width; }

// --------------------------------------------------------------- cursor
const ARROW = new Path2D('M0 0 L0 15.6 L3.9 12.2 L6.5 17.9 L8.8 16.9 L6.3 11.3 L11.2 11.3 Z');
const target = (state, name, dx = 0.5, dy = 0.5, max = 60) => {
  const r = R(state, name); return { x: r.x + Math.min(r.w * dx, max), y: r.y + r.h * dy };
};
const PATH = [ // [arrive time, viewport point]
  [TL.cursorToAgenda[0], { x: 1010, y: 720 }],
  [TL.cursorToAgenda[1], target('inicio', 'navAgenda', 0.3)],
  [TL.cursorToStart[0], target('inicio', 'navAgenda', 0.3)],
  [TL.cursorToStart[1], (() => { const b = R('agenda', 'btnStart'); return { x: b.x + b.w * 0.42, y: b.y - SCROLL_ROW + b.h * 0.55 }; })()],
  [TL.cursorToSubnav[0], (() => { const b = R('agenda', 'btnStart'); return { x: b.x + b.w * 0.42, y: b.y - SCROLL_ROW + b.h * 0.55 }; })()],
  [TL.cursorToSubnav[1], target('agenda', 'subAtendimento', 0.3)],
  [TL.cursorToRow[0], target('agenda', 'subAtendimento', 0.3)],
  [TL.cursorToRow[1], target('atendimentos', 'rowFocus', 0.12, 0.5, 400)],
  [TL.cursorToFechar[0], target('atendimentos', 'rowFocus', 0.12, 0.5, 400)],
  [TL.cursorToFechar[1], target('atendimento', 'btnFechar', 0.55, 0.55, 400)],
  [TL.cursorToConfirm[0], target('atendimento', 'btnFechar', 0.55, 0.55, 400)],
  [TL.cursorToConfirm[1], target('modal', 'btnConfirm', 0.5, 0.55, 400)],
];
function cursorAt(t) {
  if (t <= PATH[0][0]) return PATH[0][1];
  for (let i = 1; i < PATH.length; i++) if (t <= PATH[i][0]) {
    const [t0, a] = PATH[i - 1], [t1, b] = PATH[i], u = bezier(0.3, 0, 0.1, 1)(prog(t, t0, t1));
    const bow = Math.sin(u * Math.PI) * Math.hypot(b.x - a.x, b.y - a.y) * 0.06; // a hand moves in slight arcs
    const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
    return { x: lerp(a.x, b.x, u) + nx / nl * bow, y: lerp(a.y, b.y, u) + ny / nl * bow };
  }
  return PATH[PATH.length - 1][1];
}
const PRESSES = [TL.pressAgenda, TL.pressStart, TL.pressSubnav, TL.pressRow, TL.pressFechar, TL.pressConfirm];
function drawCursor(c, cam, t) {
  const a = E(t, TL.cursorToAgenda[0], TL.cursorToAgenda[0] + 0.25, std) * (1 - E(t, TL.pressConfirm + 0.08, TL.pressConfirm + 0.22, std));
  if (a <= 0) return;
  let press = 0; for (const p of PRESSES) press = Math.max(press, 1 - Math.abs(t - p - 0.04) / 0.09);
  const p = toFrame(cam, cursorAt(t)), k = cam.S * 1.02 * (1 - 0.12 * clamp(press));
  c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.scale(k, k);
  c.shadowColor = 'rgba(1,8,14,0.45)'; c.shadowBlur = 5 * k; c.shadowOffsetY = 1.5 * k;
  c.fillStyle = '#F6F2F1'; c.fill(ARROW); c.shadowColor = 'transparent';
  c.lineWidth = 1.1; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke(ARROW);
  c.restore();
}

// --------------------------------------------------------- the director
// Which real state is on screen at t, and how it hands over to the next one.
const X = MO.stateCrossfade, P = MO.press;
function appLayers(c, t) {
  const sc = scrollAt(t);
  const ag = { scroll: sc };
  if (t < TL.toAgenda[0]) {
    const hover = E(t, TL.cursorToAgenda[1] - 0.08, TL.cursorToAgenda[1] + X * 0.6, std);
    const press = E(t, TL.pressAgenda, TL.pressAgenda + P, std);
    blend(c, 'inicio', 'inicio-hover', hover);
    if (press > 0) { c.globalAlpha = press; drawState(c, 'inicio-press'); c.globalAlpha = 1; }
  } else if (t < TL.toAgenda[1]) {
    navigate(c, 'inicio-press', 'agenda', prog(t, TL.toAgenda[0], TL.toAgenda[1]), { b: ag });
  } else if (t < TL.pressStart) {
    blend(c, 'agenda', 'agenda-hover', E(t, TL.cursorToStart[1] - 0.1, TL.cursorToStart[1] + X * 0.6, std), { a: ag, b: ag });
  } else if (t < TL.result) {
    blend(c, 'agenda-hover', 'agenda-press', E(t, TL.pressStart, TL.pressStart + P, std), { a: ag, b: ag });
    const pend = E(t, TL.pending, TL.pending + X * 0.7, std);
    if (pend > 0) { c.globalAlpha = pend; drawState(c, 'agenda-pending', ag); c.globalAlpha = 1; }
  } else if (t < TL.pressSubnav) {
    blend(c, 'agenda-pending', 'agenda-result', E(t, TL.result, TL.result + X * 1.4, std), { a: ag, b: ag });
  } else if (t < TL.toAtendimentos[0]) {
    blend(c, 'agenda-result', 'agenda-press-subnav', E(t, TL.pressSubnav, TL.pressSubnav + P, std), { a: ag, b: ag });
  } else if (t < TL.pressRow) {
    const u = prog(t, TL.toAtendimentos[0], TL.toAtendimentos[1]);
    if (u < 1) navigate(c, 'agenda-press-subnav', 'atendimentos', u, { a: ag });
    else blend(c, 'atendimentos', 'atendimentos-hover', E(t, TL.cursorToRow[1] - 0.08, TL.cursorToRow[1] + X * 0.5, std));
  } else if (t < TL.toDetail[0]) {
    blend(c, 'atendimentos-hover', 'atendimentos-press', E(t, TL.pressRow, TL.pressRow + P, std));
  } else if (t < TL.pressFechar) {
    const u = prog(t, TL.toDetail[0], TL.toDetail[1]);
    if (u < 1) navigate(c, 'atendimentos-press', 'atendimento', u);
    else blend(c, 'atendimento', 'atendimento-hover', E(t, TL.cursorToFechar[1] - 0.08, TL.cursorToFechar[1] + X * 0.5, std));
  } else if (t < TL.modal[0]) {
    blend(c, 'atendimento-hover', 'atendimento-press', E(t, TL.pressFechar, TL.pressFechar + P, std));
  } else if (t < TL.pressConfirm) {
    // <dialog> open:animate-scale-in — backdrop fades, the panel scales 0.97 → 1
    const u = E(t, TL.modal[0], TL.modal[1]);
    drawState(c, 'atendimento-press');
    if (u > 0) {
      c.globalAlpha = u; drawState(c, 'modal', { except: dlg });
      const s = lerp(0.97, 1, u), m = center(dlg);
      c.save(); c.translate(m.x, m.y); c.scale(s, s); c.translate(-m.x, -m.y); drawState(c, 'modal', { clip: dlg }); c.restore();
      c.globalAlpha = 1;
    }
  } else {
    blend(c, 'modal', 'modal-press', E(t, TL.pressConfirm, TL.pressConfirm + P, std));
  }
}

function finalLayers(c, t) {
  drawState(c, 'inicio-final');
  // The KPI band still shows the old figures until the dashboard refreshes with the new sale.
  const u = E(t, TL.numbersUpdate, TL.numbersUpdate + X * 1.6, std);
  if (u < 1) { c.globalAlpha = 1 - u; drawState(c, 'inicio', { clip: kpiBand }); c.globalAlpha = 1; }
}

function background(c, t) {
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  // the Landing hero's own light: a Kahu Blue radial, top right
  const a = 0.16 * (E(t, 0.1, 1.4, std) * (1 - E(t, TL.toApp[0], TL.toApp[1], std)) + E(t, TL.pullBack[0] + 0.6, TL.pullBack[1] + 0.6, std));
  if (a > 0.001) {
    const g = c.createRadialGradient(W * 0.84, H * 0.08, 0, W * 0.84, H * 0.08, W * 0.55);
    g.addColorStop(0, `rgba(0,147,214,${a})`); g.addColorStop(1, 'rgba(0,147,214,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}

function frame(c, t) {
  background(c, t);
  const markRect = R('inicio', 'mark');
  const introK = 4.6;
  const lw = lockupWidth(c);

  // ---- 01 identidade: the wordmark types itself, the mark resolves
  const typed = (t - TL.typeStart) / TL.typeStep;
  const markP = prog(t, TL.markResolve, TL.markResolve + 0.56);
  const land = E(t, TL.toApp[0], TL.toApp[1]);

  // ---- app window (02–05)
  let cam = null, winA = 0;
  const appIn = E(t, TL.toApp[0] + 0.05, TL.toApp[1], std);
  const toFinal = E(t, TL.toFinal[0], TL.toFinal[1], std);
  const exit = E(t, TL.lockupOut[0] - 0.15, TL.lockupOut[0] + 0.5, std);
  if (t >= TL.toApp[0]) {
    actx.clearRect(0, 0, W, H);
    if (toFinal < 1) {
      cam = clampCam(track(CAM_APP, t));
      actx.globalAlpha = 1;
      const k = beginWindow(actx, cam); appLayers(actx, t);
      if (toFinal > 0) { actx.globalAlpha = std(clamp(toFinal / 0.45)); actx.fillStyle = ONYX; actx.fillRect(-VW, -VH, VW * 3, VH * 3); actx.globalAlpha = 1; }
      if (land < 1) { actx.fillStyle = INK; actx.fillRect(markRect.x - 2, markRect.y - 2, 196, 26); } // the real lockup is under the flying one
      endWindow(actx, cam, k);
    }
    if (toFinal > 0) {
      const camF = clampCam(track(CAM_FINAL, t));
      const tmp = toFinal < 1 ? mix : null;
      const fc = tmp ? mixx : actx;
      if (tmp) fc.clearRect(0, 0, W, H);
      const k = beginWindow(fc, camF); finalLayers(fc, t);
      const lift = E(t, TL.lockupOut[0], TL.lockupOut[1]);
      if (lift > 0) { fc.fillStyle = INK; fc.fillRect(markRect.x - 2, markRect.y - 2, 196, 26); }
      endWindow(fc, camF, k);
      if (tmp) { actx.globalAlpha = emph(clamp((toFinal - 0.3) / 0.7)); actx.drawImage(tmp, 0, 0); actx.globalAlpha = 1; }
      cam = camF;
    }
    winA = appIn * (1 - exit);
    if (winA > 0) {
      const blur = (1 - appIn) * 10 + exit * 6;
      c.save(); c.globalAlpha = winA; if (blur > 0.2) c.filter = `blur(${blur.toFixed(2)}px)`;
      c.drawImage(app, 0, 0); c.restore();
    }
    if (t < TL.toFinal[1] + 0.3 && toFinal < 1) drawCursor(c, clampCam(track(CAM_APP, t)), t);
  }

  // ---- the lockup: centre → sidebar (02) and sidebar → centre (05)
  if (t < TL.toApp[1] + 0.12) {
    const k0 = introK, x0 = W / 2 - lw * k0 / 2, y0 = H / 2 - 13 * k0;
    const tp = toFrame(clampCam(track(CAM_APP, Math.max(t, TL.toApp[0]))), markRect);
    const k1 = clampCam(track(CAM_APP, Math.max(t, TL.toApp[0]))).S;
    const fade = 1 - E(t, TL.toApp[1], TL.toApp[1] + 0.12, std);
    drawLockup(c, lerp(x0, tp.x, land), lerp(y0, tp.y, land), lerp(k0, k1, land), { typed, mark: markP, alpha: fade });
  }
  const lift = E(t, TL.lockupOut[0], TL.lockupOut[1], glide);
  if (lift > 0) {
    const camF = clampCam(track(CAM_FINAL, t)), sp = toFrame(camF, markRect);
    const k2 = 3.6, x2 = W / 2 - lw * k2 / 2, y2 = H / 2 - 13 * k2 - 22;
    const fo = 1 - E(t, TL.fadeOut[0], TL.fadeOut[1], std);
    drawLockup(c, lerp(sp.x, x2, lift), lerp(sp.y, y2, lift), lerp(camF.S, k2, lift), { alpha: fo });
    const tg = E(t, TL.tagline[0], TL.tagline[1]);
    if (tg > 0) {
      c.save(); c.globalAlpha = tg * fo; c.fillStyle = MUTED;
      c.font = '600 21px Geist'; c.letterSpacing = `${0.14 * 21}px`; c.textAlign = 'center';
      c.fillText(BR.tagline.toUpperCase(), W / 2 + 0.07 * 21, y2 + 26 * k2 + 64 + (1 - tg) * MO.riseIn * 2);
      c.restore();
    }
  }
}

// --------------------------------------------------------------- render
const acc = document.createElement('canvas'); acc.width = W; acc.height = H;
const accx = acc.getContext('2d');
const sub = document.createElement('canvas'); sub.width = W; sub.height = H;
const subx = sub.getContext('2d');
for (const x of [out, actx, accx, subx, mixx]) { x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; }

async function prepare(t) { // load whatever the frame will touch (dry run collects keys)
  need.clear(); frame(subx, t); await Promise.all([...need].map(bitmap));
}
async function renderFrame(T) {
  const t = Math.min(T * config.output.speed, config.output.duration - 1e-4);
  const n = config.output.subframes, dt = 1 / config.output.fps / config.output.speed;
  for (let k = 0; k < n; k++) await prepare(t + (k / n) * 0.5 * dt * config.output.speed);
  for (let k = 0; k < n; k++) {
    const ts = t + (k / n) * 0.5 * dt * config.output.speed; // 180° shutter
    subx.setTransform(1, 0, 0, 1, 0, 0); frame(subx, ts);
    accx.globalAlpha = 1 / (k + 1); accx.drawImage(sub, 0, 0);
  }
  accx.globalAlpha = 1;
  out.drawImage(acc, 0, 0);
}

await document.fonts.load('700 17px Panchang');
await document.fonts.load('600 21px Geist');
window.renderFrame = renderFrame;
window.DURATION = config.output.duration / config.output.speed;
window.FPS = config.output.fps;

const params = new URLSearchParams(location.search);
if (params.has('render')) document.body.classList.add('render');
else {
  let t = parseFloat(params.get('t') || '0'), playing = !params.has('t');
  await renderFrame(t);
  addEventListener('keydown', async e => {
    if (e.code === 'Space') playing = !playing;
    if (e.code === 'ArrowRight') { t += 1 / 60; await renderFrame(t); }
    if (e.code === 'ArrowLeft') { t -= 1 / 60; await renderFrame(t); }
  });
  let last = performance.now();
  const loop = async now => { if (playing) { t = (t + (now - last) / 1000) % window.DURATION; await renderFrame(t); } last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
window.ready = true;
