/* CORTEX.OS — product film timeline (HyperFrames · GSAP, paused, seek-safe).
 *
 * Every `.L` layer holds a REAL CORTEX.OS component as live DOM (harvest.mjs):
 * desktop components, and the same components in the product's own mobile
 * layout (ids ending in -m), which is what fills a vertical frame legibly.
 * This script only moves them and the pieces inside them. Layout is read from
 * the static DOM (offsets, never transforms), so the timeline is a pure
 * function of time. Globals injected by build.mjs: B (beats), MODS.
 */
function buildFilm() {
  const film = document.querySelector('[data-composition-id="film"]');
  const $ = s => film.querySelector(s), $$ = (s, r = film) => [...r.querySelectorAll(s)];
  const L = n => $('#L-' + n);
  const W = 1080, H = 1920, CX = 540, CY = 960;
  // 2D matrices only: layers pass through extreme scales, and a 3D-promoted layer
  // that size can't be rasterised; 2D lets Chrome paint just the visible tiles.
  gsap.config({ force3D: false }); gsap.defaults({ force3D: false });
  const tl = gsap.timeline({ paused: true });

  // the product's curves (app/globals.css), a camera glide, a dive
  const bez = (x1, y1, x2, y2) => { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s, dX = s => (3 * ax * s + 2 * bx) * s + cx;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let s = x; for (let i = 0; i < 10; i++) { const d = dX(s); if (Math.abs(d) < 1e-7) break; s -= (X(s) - x) / d; } return Y(Math.min(1, Math.max(0, s))); }; };
  const EMPH = bez(0.2, 0, 0, 1), STD = bez(0.4, 0, 0.2, 1), GLIDE = bez(0.45, 0, 0.15, 1), DIVE = bez(0.7, 0, 0.84, 0), OUT = bez(0.16, 1, 0.3, 1);

  // layout, from offsets (unaffected by transforms)
  const off = (el, layer) => { let x = 0, y = 0; while (el && el !== layer) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x, y }; };
  const box = (el, layer) => { const o = off(el, layer); return { x: o.x, y: o.y, w: el.offsetWidth, h: el.offsetHeight }; };
  const byText = (root, text, up, nth = 0) => {
    const hits = $$('*', root).filter(e => e.children.length === 0 && e.textContent.trim().replace(/\s+/g, ' ') === text);
    const el = hits[nth < 0 ? hits.length + nth : nth]; return el && up ? el.closest(up) : el;
  };
  const ancestorW = (el, w) => { while (el && Math.abs(el.offsetWidth - w) > 3) el = el.parentElement; return el; };
  const size = el => ({ w: el.offsetWidth, h: el.offsetHeight });
  const ctr = (w, h, cx, cy, s) => ({ x: cx - w * s / 2, y: cy - h * s / 2, scale: s });
  const focus = (fx, fy, s, px = CX, py = CY) => ({ x: px - fx * s, y: py - fy * s, scale: s });

  // layers fade with autoAlpha: at 0 they're visibility:hidden and Chrome stops painting them
  const isLayer = el => (Array.isArray(el) ? el : [el]).every(e => e && e.classList && (e.classList.contains('L') || e.classList.contains('part')));
  const aa = (el, v) => { if (v && 'opacity' in v && isLayer(el)) { v = Object.assign({}, v, { autoAlpha: v.opacity }); delete v.opacity; } return v; };
  const set = (el, v, t = 0) => el && tl.set(el, aa(el, v), t);
  const to = (el, t, d, v, ease = EMPH) => el && tl.to(el, Object.assign({ duration: d, ease }, aa(el, v)), t);
  // every property of `from` is also stated in `to` (static ones keep their value): in a sequential
  // frame-by-frame render GSAP does not apply from-only properties, so nothing may rely on them
  const fromTo = (el, t, d, a, b, ease = EMPH) => el && tl.fromTo(el, aa(el, a), Object.assign({ duration: d, ease, immediateRender: false }, aa(el, Object.assign({}, a, b))), t);
  const show = (el, t, d = 0.001) => to(el, t, d, { opacity: 1 }, STD);
  const hide = (el, t, d = 0.001) => to(el, t, d, { opacity: 0 }, STD);

  // lift a real sub-element into the free "parts" layer, starting exactly over its original
  const parts = $('#parts');
  const lift = (el, layer, at) => {
    const b = box(el, layer), wrap = document.createElement('div');
    wrap.className = 'part'; wrap.style.width = b.w + 'px'; wrap.style.height = b.h + 'px';
    const c = el.cloneNode(true); c.style.margin = '0'; wrap.appendChild(c); parts.appendChild(wrap);
    set(wrap, { x: at.x + b.x * at.scale, y: at.y + b.y * at.scale, scale: at.scale, opacity: 0 });
    return Object.assign(wrap, { b });
  };

  // ============================================================ 01 · O SISTEMA — silêncio
  const lock = $('#lock'), K = 4.6, LW = lock.offsetWidth, LH = lock.offsetHeight;
  const lock0 = ctr(LW, LH, CX, CY, K);
  const lockMark = { x: CX - 11 * K, y: lock0.y, scale: K };                       // the mark alone, centred
  set(lock, Object.assign({ opacity: 1 }, lockMark));
  to(lock, B.typeStart - 0.08, 0.62, { x: lock0.x }, EMPH);                        // …and makes room for the name
  set($('#glow'), { opacity: 0 }); to($('#glow'), 0.1, 1.3, { opacity: 1 }, STD); to($('#glow'), B.dive[0], 0.4, { opacity: 0.25 }, STD);
  const markg = $('#lock-markg');
  set(markg, { opacity: 0, scale: 0.16, svgOrigin: '16 16' });
  to(markg, B.markIn, B.markResolved - B.markIn, { scale: 1, opacity: 1, svgOrigin: '16 16' }, EMPH);
  for (const [id, dir] of [['#lock-pa', -1], ['#lock-pb', 1]]) {             // the two halves arrive apart and close (cortex-resolve)
    set($(id), { rotation: 80 * dir, x: 5 * dir, svgOrigin: '16 16' });
    to($(id), B.markIn, B.markResolved - B.markIn, { rotation: 0, x: 0, svgOrigin: '16 16' }, EMPH);
  }
  const chars = $$('#lock .wordmark > span');
  chars.forEach((c, i) => { set(c, { opacity: 0 }); show(c, B.typeStart + i * B.typeStep, 0.06); to(c, B.dive[0], 0.2, { opacity: 0 }, STD); });
  // dive into the blue half: its centroid (viewBox 32 → 22 css) heads for the centre and swallows the frame
  const P = { x: 7.48, y: 9.58 };
  to(lock, B.dive[0], B.dive[1] - B.dive[0], { x: CX - P.x * 640, y: CY - P.y * 640, scale: 640 }, DIVE);
  set($('#blue'), { opacity: 0 }); show($('#blue'), B.dive[1] - 0.04);
  hide(lock, B.dive[1]);

  // ============================================================ 02 · A OPERAÇÃO — construção
  const ag = L('dash-agora-m'), agS = size(ag), SL = 1000 / agS.w;
  const felipe = byText(ag, 'Felipe Santos', 'a'), fB = box(felipe, ag);
  const fTimeEl = byText(felipe, '10:00'), fTime = box(fTimeEl, ag);
  const rowsDash = $$('a.group, li', ag).filter(a => a !== felipe && a.offsetHeight > 30);
  const secHead = ag.querySelector('section').firstElementChild;                  // "Agora e a seguir" + "Ver agenda"
  const hen = byText(ag, 'Henrique Rocha', 'li'), hB = box(hen, ag);
  // the blue of the mark IS the blue of the row "Em atendimento": we start inside it
  set(ag, Object.assign({ opacity: 0 }, focus(fTime.x + fTime.w + 8, fB.y + fB.h / 2, 130)));
  show(ag, B.pullBack[0] - 0.01); hide($('#blue'), B.pullBack[0] + 0.02);
  const pb = B.pullBack[0], pbd = B.pullBack[1] - B.pullBack[0];
  to(ag, pb, pbd * 0.5, focus(fTime.x + fTime.w / 2, fTime.y + fTime.h / 2, 17), OUT);                // 10:00, huge
  to(ag, pb + pbd * 0.5, pbd * 0.5, focus(fB.x + fB.w / 2, fB.y + fB.h / 2, SL), EMPH);              // the whole row
  to(ag, B.toSection[0], B.toSection[1] - B.toSection[0], focus(agS.w / 2, agS.h / 2 + 16, SL), GLIDE); // the day around it
  set(secHead, { opacity: 0 }); show(secHead, B.listIn + 0.3, 0.3);
  rowsDash.forEach((r, i) => { set(r, { opacity: 0, y: 46 }); to(r, B.listIn + i * 0.055, 0.5, { opacity: 1, y: 0 }, EMPH); });
  // the section's own label as kinetic type crossing the top of the frame
  const tA = $('#t-agora');
  set(tA, { x: 760, y: 92, opacity: 0 });
  to(tA, B.labelSweep[0], B.labelSweep[1] - B.labelSweep[0], { x: -tA.offsetWidth + 300 }, bez(0.25, 0.1, 0.25, 1));
  to(tA, B.labelSweep[0], 0.35, { opacity: 1 }, STD); to(tA, B.labelSweep[1] - 0.35, 0.35, { opacity: 0 }, STD);
  // zoom through Henrique's row, into the Agenda
  const zt = B.zoomThrough[0], ztd = B.zoomThrough[1] - B.zoomThrough[0];
  to(ag, zt, ztd, focus(hB.x + hB.w * 0.32, hB.y + hB.h / 2, 7.5), bez(0.6, 0, 0.9, 0.4));
  fromTo(ag, zt + ztd * 0.5, ztd * 0.5, { filter: 'blur(0px)' }, { filter: 'blur(12px)' }, STD);
  hide(ag, zt + ztd * 0.7, ztd * 0.3);

  // ============================================================ 03 · AGENDA → ATENDIMENTO
  const list = L('ag-list-m'), stats = L('ag-stats'), statsA = L('ag-stats-after');
  const lHen = byText(list, 'Henrique Rocha', 'div.px-4'), lhB = box(lHen, list);
  const S3 = 2.5, rowCY = 1080;
  const listAt = { x: CX - (lhB.x + lhB.w / 2) * S3, y: rowCY - (lhB.y + lhB.h / 2) * S3, scale: S3 };
  const stS = size(stats), SS = 1010 / stS.w, statsAt = ctr(stS.w, stS.h, CX, 250, SS);
  const ai = B.agendaIn[0], aid = B.agendaIn[1] - B.agendaIn[0];
  const zoomIn = (at, k) => ({ x: CX + (at.x - CX) * k, y: rowCY + (at.y - rowCY) * k, scale: at.scale * k });
  set(list, Object.assign({ opacity: 0, filter: 'blur(12px)' }, zoomIn(listAt, 1.4)));
  set(stats, Object.assign({ opacity: 0, filter: 'blur(12px)' }, zoomIn(statsAt, 1.4)));
  to(list, ai, aid, Object.assign({ opacity: 1, filter: 'blur(0px)' }, listAt), EMPH);
  // a band of the shell colour under the counters, so the day's list slides beneath them
  const band = $('#band'); set(band, { x: 0, y: 0, opacity: 0 }); to(band, ai, aid * 0.6, { opacity: 1 }, STD);
  to(band, B.toAttendance[0], 0.3, { opacity: 0 }, STD);
  to(stats, ai + 0.05, aid, Object.assign({ opacity: 1, filter: 'blur(0px)' }, statsAt), EMPH);

  // the row comes apart — time / client / service / status / action — stacked for a vertical frame
  const rH = L('ag-row-henrique-m'), rP = L('ag-row-henrique-pending-m'), rA = L('ag-row-henrique-after-m');
  const rowAt = { x: listAt.x + lhB.x * S3, y: listAt.y + lhB.y * S3, scale: S3 };
  const badgeOf = row => $$('span', row).find(s => /rounded/.test(s.className) && s.textContent.trim().length > 4 && !s.closest('button'));
  const pick = (row, k) => ({ rail: () => row.querySelector('span[aria-hidden]'), time: () => row.querySelector('.w-14'), button: () => row.querySelector('button'),
    badge: () => badgeOf(row), name: () => byText(row, 'Henrique Rocha'), service: () => byText(row, 'Henrique Rocha').nextElementSibling })[k]();
  const P3 = {};
  for (const k of ['rail', 'time', 'name', 'service', 'badge', 'button']) P3[k] = lift(pick(rH, k), rH, rowAt);
  const dc = B.decompose[0], dcd = B.decompose[1] - B.decompose[0], X0 = 92;
  const TGT = { time: [X0, 560, 6.4], name: [X0, 810, 5.0], service: [X0, 938, 3.3], badge: [X0, 1065, 3.7], button: [X0, 1195, 3.5] };
  const railTop = 560, railBottom = TGT.button[1] + P3.button.b.h * TGT.button[2];
  Object.values(P3).forEach(p => show(p, dc - 0.001));
  to(lHen, dc, 0.001, { opacity: 0 }, STD);
  Object.entries(TGT).forEach(([k, [x, y, s]], i) => to(P3[k], dc + i * 0.03, dcd, { x, y, scale: s }, EMPH));
  const railTo = { x: X0 - 46, y: railTop, scaleX: 3, scaleY: (railBottom - railTop) / P3.rail.b.h };
  to(P3.rail, dc, dcd, railTo, EMPH);
  to(list, dc, dcd, { opacity: 0.08, scale: S3 * 0.9, x: listAt.x + 100, y: listAt.y + 60 }, EMPH);
  to(stats, dc, dcd, ctr(stS.w, stS.h, CX, 190, SS), EMPH);
  // the action: press → the real pending label → the real result
  const bt = P3.button, bs = TGT.button[2];
  to(bt, B.press - 0.06, 0.06, { scale: bs * 0.95, x: X0 + bt.b.w * bs * 0.025, y: TGT.button[1] + bt.b.h * bs * 0.025 }, STD);
  to(bt, B.press, 0.1, { scale: bs, x: X0, y: TGT.button[1] }, STD);
  const pend = lift(pick(rP, 'button'), rP, rowAt); set(pend, { x: X0, y: TGT.button[1], scale: bs });
  show(pend, B.pending, 0.05); hide(bt, B.pending, 0.05);
  const spin = pend.querySelector('svg'); if (spin) { set(spin, { transformOrigin: '50% 50%' }); to(spin, B.pending, 0.45, { rotation: 540 }, bez(0.3, 0, 0.3, 1)); }
  const badgeA = lift(pick(rA, 'badge'), rA, rowAt), railA = lift(pick(rA, 'rail'), rA, rowAt);
  set(badgeA, { x: X0, y: TGT.badge[1], scale: TGT.badge[2] * 1.12 });
  set(railA, railTo);
  to(badgeA, B.result, 0.1, { opacity: 1 }, STD); to(badgeA, B.result, 0.36, { scale: TGT.badge[2] }, EMPH);
  hide(P3.badge, B.result, 0.1); to(railA, B.result, 0.2, { opacity: 1 }, STD); hide(P3.rail, B.result + 0.1, 0.15);
  to(pend, B.result, 0.22, { opacity: 0, y: TGT.button[1] + 30 }, STD);
  set(statsA, Object.assign({ opacity: 0 }, ctr(stS.w, stS.h, CX, 190, SS)));
  show(statsA, B.result + 0.02, 0.14);
  hide(stats, B.result + 0.17);
  // the pieces reassemble as the attendance the click just created ("Originado de agendamento")
  const aH = L('at-header-m'), aI = L('at-item-m'), ahS = size(aH), aiS = size(aI), SA = 2.5;
  const aHAt = { x: X0, y: 360, scale: SA }, aIAt = ctr(aiS.w, aiS.h, CX, 1010, SA);
  const h1 = box(byText(aH, 'Henrique Rocha'), aH), title = box(byText(aI, 'Corte Degradê'), aI);
  const ta = B.toAttendance[0], tad = B.toAttendance[1] - B.toAttendance[0];
  to(P3.name, ta, tad, { x: aHAt.x + h1.x * SA, y: aHAt.y + h1.y * SA, scale: SA * h1.h / P3.name.b.h }, EMPH);
  to(P3.service, ta, tad, { x: aIAt.x + title.x * SA, y: aIAt.y + title.y * SA, scale: SA * 0.9, opacity: 0 }, EMPH);
  for (const p of [P3.time, badgeA, railA]) to(p, ta, tad * 0.6, { opacity: 0, y: '-=70' }, STD);
  to(statsA, ta, tad * 0.7, { opacity: 0, y: '-=90' }, STD);
  to(list, ta, tad * 0.6, { opacity: 0 }, STD);
  fromTo(aH, ta + tad * 0.62, tad * 0.38, Object.assign({ opacity: 0 }, aHAt), { opacity: 1 }, STD);
  fromTo(aI, ta + tad * 0.2, tad * 0.8, Object.assign({ opacity: 0 }, aIAt, { y: aIAt.y + 50 }), { opacity: 1, y: aIAt.y }, EMPH);
  hide(P3.name, ta + tad * 0.66, tad * 0.2);

  // ============================================================ 04 · ATENDIMENTO → NEGÓCIO — aceleração
  const totalEl = byText(aI, 'R$ 50,00', null, -1), tB = box(totalEl, aI);
  const val = lift(totalEl, aI, aIAt);
  const vu = B.valueUp[0], vud = B.valueUp[1] - B.valueUp[0], VS = 7.4;
  show(val, vu - 0.001); to(totalEl, vu, 0.001, { opacity: 0 }, STD);
  const aIsm = ctr(aiS.w, aiS.h, CX, 350, 1.75);
  to(aI, vu, vud, aIsm, EMPH); to(aH, vu, vud * 0.6, { opacity: 0, y: '-=80' }, STD);
  to(val, vu, vud, { x: CX - tB.w * VS / 2, y: 900 - tB.h * VS / 2, scale: VS }, EMPH);
  // the real close dialog arrives as a layer; the value lands in it
  const md = L('modal-m'), mdS = size(md), SM = 2.35, mdAt = ctr(mdS.w, mdS.h, CX, 1100, SM);
  const mTot = byText(md, 'R$ 50,00'), mtB = box(mTot, md), conf = byText(md, 'Confirmar e fechar', 'button');
  const mi = B.modalIn[0], mid = B.modalIn[1] - B.modalIn[0];
  fromTo(md, mi, mid, Object.assign({ opacity: 0 }, mdAt, { y: mdAt.y + 560, scale: SM * 0.94 }), Object.assign({ opacity: 1 }, mdAt), EMPH);
  to(aI, mi, mid, { opacity: 0.16 }, STD);
  const dockS = mtB.h * SM / tB.h;
  const vDock = { x: mdAt.x + (mtB.x + mtB.w) * SM - tB.w * dockS, y: mdAt.y + mtB.y * SM, scale: dockS };
  to(val, mi + mid * 0.3, mid * 0.7, vDock, EMPH);
  set(mTot, { opacity: 0 }); show(mTot, B.modalIn[1] - 0.02, 0.05); hide(val, B.modalIn[1], 0.05);
  set(conf, { transformOrigin: '50% 50%' });
  to(conf, B.confirm - 0.06, 0.06, { scale: 0.94 }, STD); to(conf, B.confirm, 0.14, { scale: 1 }, STD);
  // the value leaves the dialog and travels ATENDIMENTO → VENDA → CAIXA
  const mo = B.modalOut[0], mod = B.modalOut[1] - B.modalOut[0], VY = 812, VS2 = 3.4;
  set(val, vDock, mo - 0.01); show(val, mo);
  to(md, mo, mod, Object.assign({ opacity: 0 }, ctr(mdS.w, mdS.h, CX, 900, SM * 0.8)), STD);
  to(val, mo, mod, { x: CX - tB.w * VS2 / 2, y: VY - tB.h * VS2 / 2, scale: VS2 }, EMPH);
  to(aI, mo, mod, { opacity: 1 }, STD);
  const lblAt = $('#lbl-at'), lblV = $('#lbl-venda'), lblC = $('#lbl-caixa'), lblCm = $('#lbl-com');
  const line1 = $('#line1'), line2 = $('#line2');
  set(lblAt, { x: X0, y: 116, scale: 3, opacity: 0 }); show(lblAt, B.valueUp[1], 0.3);
  set(line1, { x: CX - 1, y: 560, scaleY: 0, opacity: 1 }); to(line1, mo + 0.05, 0.28, { scaleY: 1 }, EMPH);
  set(lblV, { x: X0, y: 706, scale: 3, opacity: 0 }); show(lblV, mo + 0.15, 0.25);
  const cx = L('cx-card-m'), cxS = size(cx), SC = 1.95, cxAt = ctr(cxS.w, cxS.h, CX, 1036 + cxS.h * SC / 2, SC);
  const mv0 = byText(cx, '10:41').closest('div.flex'), mvB = box(mv0, cx);
  const mvVal = mv0.querySelector('span'), mvvB = box(mvVal, cx);
  const tc = B.toCaixa[0], tcd = B.toCaixa[1] - B.toCaixa[0];
  fromTo(cx, tc, tcd * 0.7, Object.assign({ opacity: 0 }, cxAt, { y: cxAt.y + 400 }), Object.assign({ opacity: 1 }, cxAt), EMPH);
  set(lblC, { x: X0, y: 976, scale: 3, opacity: 0 }); show(lblC, tc + 0.1, 0.25);
  set(line2, { x: CX - 1, y: 890, scaleY: 0, opacity: 1 }); to(line2, tc, 0.26, { scaleY: 1 }, EMPH);
  // the new movement opens room in the drawer's list, and the value becomes it
  set(mv0, { height: 0, opacity: 0, overflow: 'hidden' });
  to(mv0, tc + tcd * 0.45, tcd * 0.5, { height: mvB.h, opacity: 1 }, EMPH);
  set(mvVal, { opacity: 0 }); show(mvVal, B.toCaixa[1] - 0.02, 0.05);
  to(val, tc + tcd * 0.3, tcd * 0.7, { x: cxAt.x + mvvB.x * SC, y: cxAt.y + mvvB.y * SC, scale: SC * mvvB.h / tB.h }, EMPH);
  hide(val, B.toCaixa[1], 0.06);
  // …and the commission follows by itself, in the slot the attendance just left
  const cm = L('cm-row-m'), cmS = size(cm), cmAt = ctr(cmS.w, cmS.h, CX, 360, 2.3);
  const cmT = B.commission[0], cmd = B.commission[1] - B.commission[0];
  to(aI, cmT, cmd * 0.7, { opacity: 0, y: '-=120' }, STD); hide(lblAt, cmT, 0.15); hide(line1, cmT, 0.2);
  fromTo(cm, cmT, cmd, Object.assign({ opacity: 0 }, cmAt, { y: cmAt.y + 140 }), Object.assign({ opacity: 1 }, cmAt), EMPH);
  set(lblCm, { x: X0, y: 196, scale: 3, opacity: 0 }); show(lblCm, cmT + 0.08, 0.2);

  // ============================================================ 05 · TUDO CONECTADO — aceleração
  const si = B.spineIn[0], sid = B.spineIn[1] - B.spineIn[0];
  for (const el of [cx, cm, lblV, lblC, lblCm, line2]) to(el, si, sid * 0.8, { opacity: 0, x: '+=220' }, STD);
  // top: the product's real navigation, each module lighting up in turn;
  // bottom: that module's real component, large — a carousel that keeps accelerating
  const SP = 2.0, spines = MODS.map(([n]) => L('aside-' + n));
  spines.forEach(sp => set(sp, { x: 36, y: 40, scale: SP, opacity: 0 }));
  fromTo(spines[0], si, sid, { x: -420, opacity: 0 }, { x: 36, opacity: 1 }, EMPH);
  const comps = MODS.map((_, i) => L('m-' + i));
  const BOT = { top: 990, bottom: 1860, w: 1000 };
  const slot = el => { const sc = Math.min(BOT.w / el.offsetWidth, (BOT.bottom - BOT.top) / el.offsetHeight, 2.6);
    return { x: CX - el.offsetWidth * sc / 2, y: (BOT.top + BOT.bottom) / 2 - el.offsetHeight * sc / 2, scale: sc }; };
  B.modules.forEach((t, i) => {
    const c = comps[i], d = Math.max(0.2, 0.36 - i * 0.02);
    if (i) { show(spines[i], t - 0.02, 0.1); to(spines[i - 1], t + 0.1, 0.001, { opacity: 0 }); }
    if (i === comps.length - 1) return;                                            // Início is handled below
    const at = slot(c);
    fromTo(c, t, d, Object.assign({ opacity: 0 }, at, { x: at.x + 420 }), Object.assign({ opacity: 1 }, at), EMPH);
    if (i >= 1) { const p = slot(comps[i - 1]); to(comps[i - 1], t, d, { opacity: 0, x: p.x - 360 }, EMPH); }
  });
  // the last module is the one everything reports to: Início's KPIs take the frame
  const kpi = comps[comps.length - 1], kS = size(kpi), kAt = ctr(kS.w, kS.h, CX, CY, 0.95);
  const tk = B.toKpis[0], tkd = B.toKpis[1] - B.toKpis[0], tI = B.modules[B.modules.length - 1];
  const kIn = ctr(kS.w, kS.h, CX, (BOT.top + BOT.bottom) / 2, 0.92);
  fromTo(kpi, tI, 0.3, Object.assign({ opacity: 0 }, kIn, { x: kIn.x + 420 }), Object.assign({ opacity: 1 }, kIn), EMPH);
  { const p = slot(comps[comps.length - 2]); to(comps[comps.length - 2], tI, 0.3, { opacity: 0, x: p.x - 360 }, EMPH); }
  to(kpi, tk, tkd, kAt, GLIDE);
  for (const sp of spines) to(sp, tk, tkd * 0.7, { opacity: 0, y: -260 }, bez(0.5, 0, 0.75, 0));

  // ============================================================ 06 · VISÃO DE GESTÃO — revelação
  const app = $('#app'), main = app.querySelector('main');
  const appKpi = ancestorW(byText(main, 'Faturamento'), kS.w), akB = box(appKpi, app);
  const appAt0 = { x: kAt.x - akB.x * 0.95, y: kAt.y - akB.y * 0.95, scale: 0.95 };
  const AW = app.offsetWidth, AH = app.offsetHeight, SF = Math.min((W - 40) / AW, (H - 240) / AH);
  const appEnd = ctr(AW, AH, CX, CY, SF);
  const rv = B.reveal[0], rvd = B.reveal[1] - B.reveal[0];
  set(app, Object.assign({ opacity: 0 }, appAt0)); show(app, rv - 0.01); hide(kpi, rv + 0.05);
  to(app, rv + 0.05, rvd, appEnd, bez(0.65, 0, 0.2, 1));
  to(app, B.reveal[1], B.lockupOut[0] - B.reveal[1], ctr(AW, AH, CX, CY, SF * 0.975), bez(0.3, 0, 0.7, 1));
  // everything that isn't the KPIs settles in around them
  const kpiSiblings = appKpi.parentElement ? [...appKpi.parentElement.children].filter(el => el !== appKpi) : [];
  const sections = [...(main.firstElementChild ? main.firstElementChild.children : [])].filter(el => !el.contains(appKpi));
  [...kpiSiblings, ...sections].forEach((s, i) => { set(s, { opacity: 0, y: 70 }); to(s, rv + 0.2 + i * 0.06, 0.6, { opacity: 1, y: 0 }, EMPH); });
  const aAside = app.querySelector('aside'), aHead = app.querySelector('header');
  set(aAside, { opacity: 0, x: -90 }); to(aAside, rv + 0.3, 0.7, { opacity: 1, x: 0 }, EMPH);
  set(aHead, { opacity: 0, y: -36 }); to(aHead, rv + 0.35, 0.6, { opacity: 1, y: 0 }, EMPH);
  set($('#app-chrome'), { opacity: 0 }); to($('#app-chrome'), rv + 0.4, 0.6, { opacity: 1 }, STD);
  // the real revenue chart draws its own line
  const cpath = $$('svg path', main).filter(p => p.getAttribute('stroke') && p.getAttribute('fill') === 'none')[0];
  if (cpath && cpath.getTotalLength) {
    const len = cpath.getTotalLength();
    set(cpath, { strokeDasharray: len, strokeDashoffset: len });
    to(cpath, B.chartDraw[0], B.chartDraw[1] - B.chartDraw[0], { strokeDashoffset: 0 }, bez(0.5, 0, 0.2, 1));
  }

  // ============================================================ 07 · ASSINATURA — resolução
  const markLink = aAside.querySelector('a'), mlB = box(markLink, app);
  const lo = B.lockupOut[0], lod = B.lockupOut[1] - B.lockupOut[0];
  const endAppS = SF * 0.975, endApp = ctr(AW, AH, CX, CY, endAppS);
  const lock2 = $('#lock2'), K2 = 4.3, l2 = ctr(lock2.offsetWidth, lock2.offsetHeight, CX, 900, K2);
  set(lock2, { x: endApp.x + mlB.x * endAppS, y: endApp.y + mlB.y * endAppS, scale: endAppS, opacity: 0 });
  show(lock2, lo); to(markLink, lo, 0.001, { opacity: 0 });
  to(lock2, lo, lod, l2, GLIDE);
  to(app, lo - 0.1, 0.6, { opacity: 0, filter: 'blur(8px)' }, STD);
  const tg = $('#tagline'), tgY = 900 + lock2.offsetHeight * K2 + 70;
  set(tg, { opacity: 0, y: tgY + 14 });
  to(tg, B.tagline[0], B.tagline[1] - B.tagline[0], { opacity: 1, y: tgY }, EMPH);
  to($('#glow'), lo, 0.8, { opacity: 0.8 }, STD);
  to([lock2, tg], B.fadeOut[0], B.fadeOut[1] - B.fadeOut[0], { opacity: 0 }, STD);
  to($('#glow'), B.fadeOut[0], B.fadeOut[1] - B.fadeOut[0], { opacity: 0 }, STD);

  window.__timelines['film'] = tl;
}
