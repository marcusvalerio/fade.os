/**
 * Gera compositions/frames/NN-*.html a partir do STORYBOARD.md (Step 5 do
 * product-launch-video, construído pelo orquestrador em vez de sub-agentes).
 *
 * Por que um gerador: todo clique, toque e anel de foco precisa cair em cima
 * do botão real da captura. As coordenadas vêm de capture/assets/ui/positions.json
 * (medidas no DOM do componente real, em pixels da imagem 2x) e são levadas ao
 * canvas 1920×1080 aqui, com a mesma escala e origem da superfície — nada de
 * conta de cabeça em oito arquivos.
 *
 * Cada frame sai como um <template> autossuficiente: @font-face local,
 * GSAP dentro do template, uma timeline pausada em window.__timelines[id],
 * entradas por fromTo, nenhum repeat/yoyo, nada de CSS transition.
 *
 * Uso: node scripts/build-frames.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "compositions/frames");
const POS = JSON.parse(readFileSync(join(ROOT, "capture/assets/ui/positions.json"), "utf8"));
mkdirSync(OUT, { recursive: true });

const C = {
  ink: "#041723",
  paper: "#F6F2F1",
  blue: "#0093D6",
  muted: "rgba(232, 230, 221, 0.72)",
  faint: "rgba(232, 230, 221, 0.60)",
  border: "rgba(232, 230, 221, 0.14)",
};
// GSAP 3.14.2 vendorizado: o Chrome headless do render não passa pelo proxy
// da CDN, e um render offline é o que garante o mesmo MP4 sempre.
const GSAP = "assets/vendor/gsap.min.js";

// ---------------------------------------------------------------- geometria

/** Superfície: captura `name` desenhada com escala `s` (sobre os px 2x) com canto em (x, y). */
function surface(name, s, x, y) {
  const p = POS[name];
  const r = (n) => Math.round(n * 10) / 10;
  return {
    name,
    s,
    x,
    y,
    w: r(p.w * s),
    h: r(p.h * s),
    /** Retângulo de um alvo medido, no canvas. */
    rect(key) {
      const t = p.targets[key];
      if (!t) throw new Error(`${name}: alvo ${key} não medido`);
      return { x: r(x + t.x * s), y: r(y + t.y * s), w: r(t.w * s), h: r(t.h * s) };
    },
    /** Centro de um alvo medido, no canvas. */
    center(key) {
      const b = this.rect(key);
      return { x: r(b.x + b.w / 2), y: r(b.y + b.h / 2) };
    },
  };
}
const inset = (b, d) => ({ x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d });
const box = (b) => `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;`;

// ---------------------------------------------------------------- blocos comuns

const fontFaces = `
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-Medium.woff2") format("woff2"); font-weight: 500; font-style: normal; }
      @font-face { font-family: "Geist"; src: url("assets/fonts/Geist-SemiBold.woff2") format("woff2"); font-weight: 600; font-style: normal; }
      @font-face { font-family: "Panchang"; src: url("assets/fonts/Panchang-Variable.woff2") format("woff2"); font-weight: 200 800; font-style: normal; }`;

function baseCss(P) {
  return `
      #root { position: absolute; inset: 0; overflow: hidden; font-family: "Geist", sans-serif; color: ${C.paper}; }
      .${P}-bg { position: absolute; inset: 0; background: ${C.ink}; }
      .${P}-stage { position: absolute; inset: 0; overflow: hidden; }
      .${P}-col { position: absolute; left: 128px; top: 300px; width: 548px; }
      .${P}-eyebrow { margin: 0; font-size: 22px; line-height: 1; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${C.faint}; font-variant-numeric: tabular-nums; }
      .${P}-num { color: ${C.blue}; }
      .${P}-title { margin: 30px 0 0; font-size: 76px; line-height: 1.02; font-weight: 600; letter-spacing: -0.035em; color: ${C.paper}; text-wrap: balance; }
      .${P}-line { display: block; }
      .${P}-word { display: inline-block; }
      .${P}-sub { margin: 30px 0 0; max-width: 470px; font-size: 28px; line-height: 1.35; font-weight: 400; letter-spacing: -0.01em; color: ${C.muted}; text-wrap: balance; }
      .${P}-win { position: absolute; border-radius: 16px; box-shadow: 0 0 0 1px ${C.border}; }
      .${P}-win img, .${P}-img { position: absolute; left: 0; top: 0; width: 100%; height: auto; display: block; }
      .${P}-ring { position: absolute; border: 2px solid ${C.blue}; border-radius: 12px; box-shadow: 0 0 0 6px rgba(0, 147, 214, 0.16), 0 0 28px rgba(0, 147, 214, 0.32); pointer-events: none; }
      .${P}-press { position: absolute; border-radius: 8px; background: rgba(4, 23, 35, 0.24); pointer-events: none; }
      .${P}-ripple { position: absolute; width: 84px; height: 84px; margin: -42px 0 0 -42px; border-radius: 50%; border: 2px solid ${C.paper}; pointer-events: none; }
      .${P}-cursor { position: absolute; left: -7px; top: -4px; width: 44px; height: 44px; transform-origin: 7px 4px; pointer-events: none; z-index: 20; filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4)); }
      .${P}-tap { position: absolute; left: -32px; top: -32px; width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 147, 214, 0.34); border: 3px solid rgba(246, 242, 241, 0.92); pointer-events: none; z-index: 20; }`;
}

const cursorSvg = (P) =>
  `<svg class="${P}-cursor" data-layout-allow-overflow viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2 L4 19.5 L8.6 15.2 L11.6 21.8 L14.4 20.6 L11.4 14.2 L17.6 14.2 Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

function textCol(P, { eyebrow, lines, sub }) {
  const title = lines
    .map((l, i) =>
      Array.isArray(l)
        ? `<span class="${P}-line ${P}-l${i + 1}" data-layout-allow-overlap>${l.map((w, j) => `<span class="${P}-word ${P}-w${i + 1}-${j + 1}" data-layout-allow-overlap>${w}</span>`).join(" ")}</span>`
        : `<span class="${P}-line ${P}-l${i + 1}" data-layout-allow-overlap>${l}</span>`,
    )
    .join("");
  return `
          <div class="${P}-col" data-layout-allow-overlap>
            <p class="${P}-eyebrow" data-layout-allow-overlap>${eyebrow}</p>
            <h1 class="${P}-title" data-layout-allow-overlap>${title}</h1>
            ${sub ? `<p class="${P}-sub" data-layout-allow-overlap>${sub}</p>` : ""}
          </div>`;
}

/** Monta o arquivo do frame: um único <template>, fundo e palco como clips. */
function frameFile({ id, P, duration, css = "", stage, script }) {
  return `<template>
  <style>${fontFaces}${baseCss(P)}${css}
  </style>

  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
    <div id="${P}-bg" class="clip ${P}-bg" data-start="0" data-duration="${duration}" data-track-index="0"></div>
    <div id="${P}-stage" class="clip ${P}-stage" data-start="0" data-duration="${duration}" data-track-index="1">${stage}
    </div>
  </div>

  <script src="${GSAP}"></script>
  <script>
    (function () {
      var tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
${script}
      window.__timelines = window.__timelines || {};
      window.__timelines["${id}"] = tl;
    })();
  </script>
</template>
`;
}

// ---------------------------------------------------------------- vocabulário de movimento
// Cada helper devolve linhas de GSAP. Só a primeira tween de uma propriedade num
// elemento renderiza de imediato; as seguintes usam immediateRender:false para o
// seek em qualquer ponto cair no estado certo.

const q = (sel) => JSON.stringify(sel);
const later = ", immediateRender: false";

/** Entrada: sobe `dy` px e aparece (spring-pop-entrance no registro suave). */
const rise = (sel, t, { dy = 36, dur = 0.8, first = true } = {}) =>
  `      tl.fromTo(${q(sel)}, { y: ${dy}, opacity: 0 }, { y: 0, opacity: 1, duration: ${dur}${first ? "" : later} }, ${t});`;

/** Aparece no lugar (crossfade de estado, anel, sub-rótulo). */
const fadeIn = (sel, t, dur = 0.35, first = true) =>
  `      tl.fromTo(${q(sel)}, { opacity: 0 }, { opacity: 1, duration: ${dur}, ease: "power2.out"${first ? "" : later} }, ${t});`;
const fadeOut = (sel, t, dur = 0.35) =>
  `      tl.fromTo(${q(sel)}, { opacity: 1 }, { opacity: 0, duration: ${dur}, ease: "power2.in"${later} }, ${t});`;

/** Pop a partir de um ponto de origem (popover/modal). */
const pop = (sel, t, { from = 0.9, dy = 14, dur = 0.55, first = true } = {}) =>
  `      tl.fromTo(${q(sel)}, { scale: ${from}, y: ${dy}, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: ${dur}${first ? "" : later} }, ${t});`;

/**
 * Clique (cursor-click-ripple): ator vai até o alvo, comprime junto com a
 * sombra de pressão do botão e solta um anel a partir do centro do alvo.
 */
function click(P, { actor, from, to, tMove, tClick, press, ripple, enter = false, heavy = false }) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const moveDur = Math.max(0.35, r2(tClick - tMove - 0.12));
  const lines = [];
  // Cada ator ganha um estado de repouso explícito em t=0 (tl.set) e todas as
  // tweens dele usam immediateRender:false — assim um seek para antes de
  // qualquer tween cai no repouso, nunca no "from" da última tween escrita.
  if (enter) {
    lines.push(`      tl.set(${q(actor)}, { x: ${from.x}, y: ${from.y}, opacity: 0, scale: 1 }, 0);`);
    lines.push(`      tl.fromTo(${q(actor)}, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out"${later} }, ${tMove});`);
  }
  lines.push(`      tl.fromTo(${q(actor)}, { x: ${from.x}, y: ${from.y} }, { x: ${to.x}, y: ${to.y}, duration: ${moveDur}, ease: "power2.inOut"${later} }, ${tMove});`);
  const s = heavy ? 0.8 : 0.86;
  const tUp = r2(tClick + 0.09);
  lines.push(`      tl.fromTo(${q(actor)}, { scale: 1 }, { scale: ${s}, duration: 0.08, ease: "power2.in"${later} }, ${tClick});`);
  lines.push(`      tl.fromTo(${q(actor)}, { scale: ${s} }, { scale: 1, duration: 0.16, ease: "power2.out"${later} }, ${tUp});`);
  if (press) {
    lines.push(`      tl.set(${q(press)}, { opacity: 0 }, 0);`);
    lines.push(`      tl.fromTo(${q(press)}, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: "power2.in"${later} }, ${tClick});`);
    lines.push(`      tl.fromTo(${q(press)}, { opacity: 1 }, { opacity: 0, duration: 0.22, ease: "power2.out"${later} }, ${tUp});`);
  }
  if (ripple) {
    const t0 = r2(tClick + 0.03);
    lines.push(`      tl.set(${q(ripple)}, { scale: 0.3, opacity: 0 }, 0);`);
    lines.push(`      tl.fromTo(${q(ripple)}, { scale: 0.3, opacity: 0.9 }, { scale: 3, opacity: 0, duration: 0.72, ease: "power2.out"${later} }, ${t0});`);
  }
  return lines.join("\n");
}

const wrote = [];
function write(file, content) {
  writeFileSync(join(OUT, file), content);
  wrote.push(file);
}

// ================================================================ Frame 1 — A ideia
// A frase da marca (a mesma do Hero da landing e do login). O ponto final é o
// quadrado azul — o símbolo da marca fechando a frase.
{
  const P = "f01";
  const linha1 = ["Cada", "corte", "move"];
  const linha2 = ["a", "barbearia", "inteira"];
  const palavra = (w, cls) => `<span class="${P}-word ${cls}" data-layout-allow-overlap>${w}</span>`;
  const stage = `
          <div class="${P}-type" data-layout-allow-overlap>
            <span class="${P}-row">${linha1.map((w, i) => palavra(w, `${P}-a${i + 1}`)).join(" ")}</span>
            <span class="${P}-row">${linha2.map((w, i) => palavra(w, `${P}-b${i + 1}`)).join(" ")}<span class="${P}-quadrado" data-layout-allow-overlap></span></span>
          </div>`;
  const css = `
      .${P}-type { position: absolute; left: 128px; top: 318px; font-size: 132px; line-height: 1.02; font-weight: 600; letter-spacing: -0.045em; color: ${C.paper}; }
      .${P}-row { display: block; white-space: nowrap; }
      .${P}-quadrado { display: inline-block; width: 0.2em; height: 0.2em; margin-left: 0.05em; background: ${C.blue}; transform-origin: 0% 100%; }`;
  const script = [
    ...linha1.map((_, i) => rise(`.${P}-a${i + 1}`, Math.round((0.15 + i * 0.16) * 100) / 100, { dy: 44, dur: 0.75 })),
    ...linha2.map((_, i) => rise(`.${P}-b${i + 1}`, Math.round((1.15 + i * 0.16) * 100) / 100, { dy: 44, dur: 0.75 })),
    // O quadrado chega grande e se assenta — o gesto da marca.
    `      tl.fromTo(".${P}-quadrado", { scale: 0, opacity: 1 }, { scale: 4, duration: 0.19, ease: "power2.out" }, 2.25);`,
    `      tl.fromTo(".${P}-quadrado", { scale: 4 }, { scale: 1, duration: 0.5, ease: "expo.out"${later} }, 2.45);`,
  ].join("\n");
  write("01-conceito.html", frameFile({ id: "01-conceito", P, duration: 3.6, css, stage, script }));
}

// ================================================================ Frame 2 — Marcou pelo celular
{
  const P = "f02";
  const ph = surface("phone-servicos", 0.66, 1071, 100);
  const card = inset(ph.rect("servico"), -3);
  const btn = ph.rect("continuar");
  const tapAt = ph.center("continuar");
  // Tela do celular dentro da moldura (px da captura 2x: moldura de ~20px, raio ~60px).
  const scr = { x: ph.x + 20 * ph.s, y: ph.y + 20 * ph.s, w: (560 - 40) * ph.s, h: (1195 - 40) * ph.s };
  const stage = `
          ${textCol(P, { eyebrow: `<span class="${P}-num">01</span> / 05`, lines: ["Marcou pelo celular."], sub: "Na página da barbearia, sem ligar." })}
          <div class="${P}-phone" style="${box(ph)}">
            <img class="${P}-img" src="assets/phone-servicos.png" alt="" />
            <div class="${P}-screen" style="left:${Math.round((scr.x - ph.x) * 10) / 10}px;top:${Math.round((scr.y - ph.y) * 10) / 10}px;width:${Math.round(scr.w * 10) / 10}px;height:${Math.round(scr.h * 10) / 10}px;">
              <img class="${P}-img ${P}-next" data-layout-allow-overflow src="assets/phone-confirmado.png" alt="" style="left:${-20 * ph.s}px;top:${-20 * ph.s}px;width:${ph.w}px;" />
            </div>
          </div>
          <div class="${P}-ring" style="${box(card)}"></div>
          <div class="${P}-press" style="${box(btn)}border-radius:6px;"></div>
          <div data-layout-allow-overflow class="${P}-ripple" style="left:${tapAt.x}px;top:${tapAt.y}px;"></div>
          <div class="${P}-tap" data-layout-allow-overflow></div>`;
  const css = `
      .${P}-phone { position: absolute; }
      .${P}-screen { position: absolute; overflow: hidden; border-radius: ${Math.round(56 * ph.s)}px; }`;
  const script = [
    rise(`.${P}-phone`, 0, { dy: 60, dur: 0.95 }),
    rise(`.${P}-eyebrow`, 0.3, { dy: 20, dur: 0.6 }),
    rise(`.${P}-title`, 0.45, { dy: 28, dur: 0.75 }),
    `      tl.fromTo(".${P}-ring", { scale: 1.04, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 }, 1.2);`,
    click(P, { actor: `.${P}-tap`, from: { x: tapAt.x + 150, y: tapAt.y + 170 }, to: tapAt, tMove: 2.2, tClick: 2.85, press: `.${P}-press`, ripple: `.${P}-ripple`, enter: true }),
    fadeOut(`.${P}-tap`, 3.1, 0.3),
    fadeOut(`.${P}-ring`, 3.1, 0.3),
    `      tl.fromTo(".${P}-next", { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 3.1);`,
    rise(`.${P}-sub`, 3.6, { dy: 18, dur: 0.6 }),
  ].join("\n");
  write("02-celular.html", frameFile({ id: "02-celular", P, duration: 5.4, css, stage, script }));
}

// ================================================================ Frames 3 e 4 — Agenda
const AG = surface("agenda-s1", 0.75, 720, 112);
const AG_ROW = inset(AG.rect("linha"), 6);
// Repouso do ponteiro fora da janela, à direita: parado sobre a agenda ele
// pareceria prestes a clicar em outra linha.
const AG_REST = { x: 1846, y: 700 };
{
  const P = "f03";
  const wa = AG.rect("whatsapp");
  const cf = AG.rect("confirmar");
  const waC = AG.center("whatsapp");
  const cfC = AG.center("confirmar");
  const msg = { s: 0.8, w: 544 * 0.8, h: 419 * 0.8 };
  msg.x = Math.round(waC.x - msg.w * 0.43);
  msg.y = Math.round(wa.y - 40 - msg.h);
  const origin = `${Math.round(waC.x - msg.x)}px ${Math.round(msg.h + 40)}px`;
  const stage = `
          ${textCol(P, { eyebrow: `<span class="${P}-num">02</span> / 05`, lines: ["Caiu na agenda.", "Confirmou pelo WhatsApp."], sub: "Mensagem pronta, é só enviar." })}
          <div class="${P}-win" style="${box(AG)}">
            <img src="assets/agenda-s1.png" alt="" />
            <img class="${P}-s2" src="assets/agenda-s2.png" alt="" />
          </div>
          <div class="${P}-ring" style="${box(AG_ROW)}"></div>
          <div class="${P}-press ${P}-press-wa" style="${box(wa)}"></div>
          <div class="${P}-press ${P}-press-cf" style="${box(cf)}"></div>
          <div class="${P}-msg" style="left:${msg.x}px;top:${msg.y}px;width:${msg.w}px;height:${msg.h}px;transform-origin:${origin};">
            <img class="${P}-img" src="assets/mensagem.png" alt="" />
          </div>
          <div data-layout-allow-overflow class="${P}-ripple ${P}-rp-wa" style="left:${waC.x}px;top:${waC.y}px;"></div>
          <div data-layout-allow-overflow class="${P}-ripple ${P}-rp-cf" style="left:${cfC.x}px;top:${cfC.y}px;"></div>
          ${cursorSvg(P)}`;
  const css = `
      .${P}-msg { position: absolute; border-radius: 12px; box-shadow: 0 0 0 1px ${C.border}, 0 24px 60px -18px rgba(0, 0, 0, 0.55); }`;
  const script = [
    rise(`.${P}-win`, 0, { dy: 48, dur: 0.9 }),
    rise(`.${P}-eyebrow`, 0.25, { dy: 20, dur: 0.6 }),
    rise(`.${P}-l1`, 0.4, { dy: 28, dur: 0.75 }),
    `      tl.fromTo(".${P}-ring", { scale: 1.03, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 }, 0.85);`,
    click(P, { actor: `.${P}-cursor`, from: { x: 1860, y: 1000 }, to: waC, tMove: 1.1, tClick: 1.85, press: `.${P}-press-wa`, ripple: `.${P}-rp-wa`, enter: true }),
    pop(`.${P}-msg`, 2.0, { from: 0.55, dy: 24, dur: 0.6 }),
    rise(`.${P}-l2`, 2.35, { dy: 28, dur: 0.75 }),
    rise(`.${P}-sub`, 2.9, { dy: 18, dur: 0.6 }),
    click(P, { actor: `.${P}-cursor`, from: waC, to: cfC, tMove: 3.7, tClick: 4.3, press: `.${P}-press-cf`, ripple: `.${P}-rp-cf` }),
    fadeIn(`.${P}-s2`, 4.4, 0.35),
    `      tl.fromTo(".${P}-msg", { scale: 1, opacity: 1 }, { scale: 0.6, opacity: 0, duration: 0.35, ease: "power2.in"${later} }, 4.45);`,
    `      tl.fromTo(".${P}-cursor", { x: ${cfC.x}, y: ${cfC.y} }, { x: ${AG_REST.x}, y: ${AG_REST.y}, duration: 0.6, ease: "power2.inOut"${later} }, 4.7);`,
  ].join("\n");
  write("03-agenda.html", frameFile({ id: "03-agenda", P, duration: 6.2, css, stage, script }));
}
{
  const P = "f04";
  const ag3 = surface("agenda-s3", 0.75, AG.x, AG.y);
  const cont = inset(ag3.rect("contadores"), -6);
  const dy = cont.y - AG_ROW.y;
  const stage = `
          ${textCol(P, { eyebrow: `<span class="${P}-num">03</span> / 05`, lines: [["Chegou,", "sentou,", "começou."]], sub: "Os contadores do dia acompanham." })}
          <div class="${P}-win" style="${box(AG)}">
            <img src="assets/agenda-s2.png" alt="" />
            <img class="${P}-s3" src="assets/agenda-s3.png" alt="" />
          </div>
          <div class="${P}-ring ${P}-ring-a" style="${box(AG_ROW)}"></div>
          <div class="${P}-ring ${P}-ring-b" style="${box(cont)}"></div>
          ${cursorSvg(P)}`;
  const script = [
    // Continuidade do frame 3: janela, anel e ponteiro exatamente onde ficaram.
    `      tl.fromTo(".${P}-cursor", { x: ${AG_REST.x}, y: ${AG_REST.y}, opacity: 1 }, { x: ${AG_REST.x}, y: ${AG_REST.y + 44}, opacity: 0, duration: 0.4, ease: "power2.in" }, 0.05);`,
    rise(`.${P}-w1-1`, 0.1, { dy: 26, dur: 0.55 }),
    rise(`.${P}-w1-2`, 0.55, { dy: 26, dur: 0.55 }),
    rise(`.${P}-w1-3`, 1.0, { dy: 26, dur: 0.55 }),
    fadeIn(`.${P}-s3`, 1.2, 0.35),
    `      tl.fromTo(".${P}-ring-a", { y: 0, opacity: 1 }, { y: ${Math.round(dy * 0.6)}, opacity: 0, duration: 0.5, ease: "power2.inOut" }, 1.9);`,
    `      tl.fromTo(".${P}-ring-b", { y: ${Math.round(-dy * 0.4)}, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.inOut" }, 2.0);`,
    rise(`.${P}-sub`, 2.9, { dy: 18, dur: 0.6 }),
  ].join("\n");
  write("04-atendimento-inicia.html", frameFile({ id: "04-atendimento-inicia", P, duration: 4.4, stage, script }));
}

// ================================================================ Frame 5 — Fechou e recebeu
{
  const P = "f05";
  const at = surface("atendimento", 0.75, 720, 180);
  const md = surface("modal", 0.9, 0, 0);
  md.x = Math.round(at.x + at.w / 2 - md.w / 2);
  md.y = Math.round(at.y + at.h / 2 - md.h / 2 - 16);
  const mdS = surface("modal", 0.9, md.x, md.y);
  const fe = at.rect("fechar");
  const feC = at.center("fechar");
  const cf = mdS.rect("confirmar");
  const cfC = mdS.center("confirmar");
  const focus = { x: Math.round(md.x + md.w / 2), y: Math.round(md.y + md.h / 2) };
  const stage = `
          ${textCol(P, { eyebrow: `<span class="${P}-num">04</span> / 05`, lines: ["Fechou e recebeu."], sub: "R$ 112,00 em dinheiro." })}
          <div class="${P}-world" data-layout-allow-overflow style="transform-origin:${focus.x}px ${focus.y}px;">
            <div class="${P}-win" style="${box(at)}">
              <img src="assets/atendimento.png" alt="" />
              <div class="${P}-dim"></div>
            </div>
            <div class="${P}-press ${P}-press-fe" style="${box(fe)}"></div>
            <div data-layout-allow-overflow class="${P}-ripple ${P}-rp-fe" style="left:${feC.x}px;top:${feC.y}px;"></div>
            <div class="${P}-modal" style="${box(mdS)}">
              <img class="${P}-img" src="assets/modal.png" alt="" />
            </div>
            <div class="${P}-press ${P}-press-cf" style="${box(cf)}"></div>
            <div data-layout-allow-overflow class="${P}-ripple ${P}-rp-cf" style="left:${cfC.x}px;top:${cfC.y}px;"></div>
            ${cursorSvg(P)}
          </div>`;
  const css = `
      .${P}-world { position: absolute; inset: 0; }
      .${P}-dim { position: absolute; inset: 0; border-radius: 16px; background: rgba(4, 23, 35, 0.5); }
      .${P}-modal { position: absolute; border-radius: 14px; box-shadow: 0 0 0 1px ${C.border}, 0 30px 80px -20px rgba(0, 0, 0, 0.6); }`;
  const script = [
    rise(`.${P}-win`, 0, { dy: 48, dur: 0.9 }),
    rise(`.${P}-eyebrow`, 0.25, { dy: 20, dur: 0.6 }),
    rise(`.${P}-title`, 0.4, { dy: 28, dur: 0.75 }),
    click(P, { actor: `.${P}-cursor`, from: { x: 1860, y: 1000 }, to: feC, tMove: 1.0, tClick: 1.7, press: `.${P}-press-fe`, ripple: `.${P}-rp-fe`, enter: true }),
    // depth-of-field-blur: a janela escurece e perde foco enquanto o modal chega.
    `      tl.fromTo(".${P}-dim", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, 1.85);`,
    `      tl.fromTo(".${P}-win img", { filter: "blur(0px)" }, { filter: "blur(2px)", duration: 0.45, ease: "power2.out" }, 1.85);`,
    pop(`.${P}-modal`, 1.9, { from: 0.92, dy: 16, dur: 0.6 }),
    // coordinate-target-zoom: push curto centrado no modal, e para.
    `      tl.fromTo(".${P}-world", { scale: 1 }, { scale: 1.05, duration: 0.9 }, 1.9);`,
    rise(`.${P}-sub`, 2.9, { dy: 18, dur: 0.6 }),
    click(P, { actor: `.${P}-cursor`, from: feC, to: cfC, tMove: 3.4, tClick: 4.15, press: `.${P}-press-cf`, ripple: `.${P}-rp-cf`, heavy: true }),
  ].join("\n");
  write("05-fechar.html", frameFile({ id: "05-fechar", P, duration: 5.4, css, stage, script }));
}

// ================================================================ Frame 6 — Caixa e comissão
{
  const P = "f06";
  const antes = surface("caixa-antes", 0.72, 740, 70);
  const depois = surface("caixa-depois", 0.72, 740, 70);
  const saldo = inset(depois.rect("saldo"), -4);
  const venda = inset(depois.rect("venda"), 2);
  const comissao = inset(depois.rect("comissao"), -2);
  const stage = `
          ${textCol(P, { eyebrow: `<span class="${P}-num">05</span> / 05`, lines: ["No caixa e na comissão."], sub: "No mesmo instante, sem digitar de novo." })}
          <div class="${P}-surf" style="left:${antes.x}px;top:${antes.y}px;width:${antes.w}px;">
            <img class="${P}-img ${P}-antes" src="assets/caixa-antes.png" alt="" />
            <img class="${P}-img ${P}-depois" src="assets/caixa-depois.png" alt="" />
          </div>
          <div class="${P}-ring" style="${box(saldo)}"></div>`;
  const css = `
      .${P}-surf { position: absolute; height: ${depois.h}px; }
      .${P}-img { border-radius: 16px; }
      .${P}-ring { transform-origin: 50% 0%; }
      .${P}-antes { box-shadow: 0 0 0 1px ${C.border}; }
      /* A venda entra como uma varredura de cima para baixo: acima da frente, o
         Caixa novo; abaixo, o antigo. Crossfade aqui daria dupla exposição,
         porque a linha nova empurra as de baixo. */
      .${P}-depois { --wipe: 0px; -webkit-mask-image: linear-gradient(to bottom, #000 calc(var(--wipe) - 56px), transparent var(--wipe)); mask-image: linear-gradient(to bottom, #000 calc(var(--wipe) - 56px), transparent var(--wipe)); }`;
  const ringTo = (b, t) =>
    `      tl.fromTo(".${P}-ring", { y: ${0}, scaleY: 1 }, { y: ${Math.round((b.y - saldo.y) * 10) / 10}, scaleY: ${Math.round((b.h / saldo.h) * 1000) / 1000}, duration: 0.6, ease: "power2.inOut"${later} }, ${t});`;
  const script = [
    rise(`.${P}-surf`, 0, { dy: 44, dur: 0.85 }),
    rise(`.${P}-eyebrow`, 0.25, { dy: 20, dur: 0.6 }),
    rise(`.${P}-title`, 0.4, { dy: 28, dur: 0.75 }),
    `      tl.fromTo(".${P}-depois", { "--wipe": "0px" }, { "--wipe": "${Math.ceil(depois.h + 60)}px", duration: 0.75, ease: "power2.inOut" }, 0.85);`,
    `      tl.fromTo(".${P}-ring", { opacity: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: 0.45 }, 1.4);`,
    ringTo(venda, 1.95),
    `      tl.fromTo(".${P}-ring", { y: ${Math.round((venda.y - saldo.y) * 10) / 10}, scaleY: ${Math.round((venda.h / saldo.h) * 1000) / 1000} }, { y: ${Math.round((comissao.y - saldo.y) * 10) / 10}, scaleY: ${Math.round((comissao.h / saldo.h) * 1000) / 1000}, duration: 0.7, ease: "power2.inOut"${later} }, 2.75);`,
    rise(`.${P}-sub`, 3.6, { dy: 18, dur: 0.6 }),
  ].join("\n");
  write("06-caixa.html", frameFile({ id: "06-caixa", P, duration: 5.2, css, stage, script }));
}

// ================================================================ Frame 7 — Início
{
  const P = "f07";
  const ini = surface("inicio", 0.66, 740, 90);
  const cli = surface("clientes", 0.55, 1180, 470);
  // Regiões lidas da captura (px 2x): os quatro indicadores do Início e a coluna
  // linhas em Atenção / Recuperação da lista de Clientes.
  const kpis = { x: Math.round(ini.x + 140 * ini.s), y: Math.round(ini.y + 196 * ini.s), w: Math.round(1300 * ini.s), h: Math.round(392 * ini.s) };
  const selos = { x: Math.round(cli.x + 116 * cli.s), y: Math.round(cli.y + 206 * cli.s), w: Math.round(1058 * cli.s), h: Math.round(250 * cli.s) };
  const stage = `
          ${textCol(P, { eyebrow: "A semana", lines: ["Os números saem da operação."], sub: "E quem está demorando a voltar." })}
          <div class="${P}-win ${P}-ini" style="${box(ini)}"><img src="assets/inicio.png" alt="" /></div>
          <div class="${P}-ring ${P}-ring-a" style="${box(kpis)}"></div>
          <div class="${P}-win ${P}-cli" style="${box(cli)}"><img src="assets/clientes.png" alt="" /></div>
          <div class="${P}-ring ${P}-ring-b" style="${box(selos)}"></div>`;
  const css = `
      .${P}-cli { box-shadow: 0 0 0 1px ${C.border}, 0 30px 80px -24px rgba(0, 0, 0, 0.6); }`;
  const script = [
    rise(`.${P}-eyebrow`, 0.15, { dy: 20, dur: 0.6 }),
    rise(`.${P}-title`, 0.3, { dy: 28, dur: 0.8 }),
    rise(`.${P}-ini`, 1.1, { dy: 48, dur: 0.9 }),
    `      tl.fromTo(".${P}-ring-a", { scale: 1.02, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 }, 1.85);`,
    rise(`.${P}-cli`, 2.4, { dy: 48, dur: 0.85 }),
    fadeOut(`.${P}-ring-a`, 2.4, 0.3),
    rise(`.${P}-sub`, 2.65, { dy: 18, dur: 0.6 }),
    `      tl.fromTo(".${P}-ring-b", { scale: 1.06, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 }, 3.2);`,
  ].join("\n");
  write("07-inicio.html", frameFile({ id: "07-inicio", P, duration: 4.4, css, stage, script }));
}

// ================================================================ Frame 8 — Marca
// O mesmo gesto da entrada no produto (components/entrada-cortex.tsx): o
// quadrado aparece grande no centro exato, se assenta, e CORTEX e OS saem dele.
{
  const P = "f08";
  const stage = `
          <div class="${P}-lockup">
            <p class="${P}-mark"><span class="${P}-name">CORTEX</span><span class="${P}-quadrado"></span><span class="${P}-os">OS</span></p>
            <p class="${P}-tag">Sistema operacional para barbearias.</p>
            <p class="${P}-cta-wrap"><span class="${P}-cta">Pedir acesso ao Beta</span></p>
          </div>
          <p class="${P}-note">Telas do CORTEX com dados de exemplo.</p>`;
  const css = `
      .${P}-lockup { position: absolute; left: 0; right: 0; top: 300px; text-align: center; }
      .${P}-mark { margin: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; font-family: "Panchang", sans-serif; font-weight: 700; font-variation-settings: "wght" 700; font-size: 128px; line-height: 1; letter-spacing: -0.03em; color: ${C.paper}; }
      .${P}-name { justify-self: end; }
      .${P}-os { justify-self: start; }
      .${P}-quadrado { width: 0.2em; height: 0.2em; margin-inline: 0.04em 0.044em; background: ${C.blue}; }
      .${P}-tag { margin: 44px 0 0; font-size: 36px; line-height: 1.3; font-weight: 400; letter-spacing: -0.015em; color: ${C.muted}; }
      .${P}-cta-wrap { margin: 56px 0 0; }
      .${P}-cta { display: inline-block; padding: 22px 40px; border-radius: 6px; background: ${C.blue}; color: #FFFFFF; font-size: 28px; line-height: 1; font-weight: 600; letter-spacing: -0.01em; }
      .${P}-note { position: absolute; left: 0; right: 0; top: 846px; margin: 0; text-align: center; font-size: 20px; line-height: 1; font-weight: 400; color: ${C.faint}; }`;
  const script = [
    `      tl.fromTo(".${P}-quadrado", { scale: 0 }, { scale: 4.5, duration: 0.19, ease: "power2.out" }, 0.1);`,
    `      tl.fromTo(".${P}-quadrado", { scale: 4.5 }, { scale: 1, duration: 0.55, ease: "expo.out"${later} }, 0.3);`,
    `      tl.fromTo(".${P}-name", { clipPath: "inset(0% 0% 0% 100%)", x: 44 }, { clipPath: "inset(0% 0% 0% 0%)", x: 0, duration: 0.6, ease: "expo.out" }, 0.34);`,
    `      tl.fromTo(".${P}-os", { clipPath: "inset(0% 100% 0% 0%)", x: -44 }, { clipPath: "inset(0% 0% 0% 0%)", x: 0, duration: 0.6, ease: "expo.out" }, 0.38);`,
    // Montada a partir do quadrado (no centro exato), a marca desliza até o
    // centro óptico do lockup — CORTEX é mais longo que OS. Medido na
    // Panchang: 2,1285em × 128px ≈ 272px.
    `      tl.fromTo(".${P}-mark", { x: 0 }, { x: 272, duration: 0.8, ease: "power3.inOut" }, 1.0);`,
    rise(`.${P}-tag`, 1.45, { dy: 20, dur: 0.7 }),
    pop(`.${P}-cta`, 2.3, { from: 0.94, dy: 12, dur: 0.6 }),
    fadeIn(`.${P}-note`, 3.0, 0.6),
  ].join("\n");
  write("08-marca.html", frameFile({ id: "08-marca", P, duration: 4.2, css, stage, script }));
}

console.log("frames:", wrote.join(", "));
