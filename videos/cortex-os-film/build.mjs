// Assembles the HyperFrames project for the CORTEX.OS product film (9:16).
//
//   node build.mjs   → compositions/film.html + index.html (+ assets/film.wav)
//
// film.html is one sub-composition: the app's compiled production CSS (inline),
// every real component harvested by harvest.mjs as a live DOM layer, and the GSAP
// timeline from film.timeline.js. index.html mounts it with the sound design.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from './film.config.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const { output: OUT, brand: BR, modules: MODS } = config;
const K = 1 / (OUT.speed || 1);
const B = Object.fromEntries(Object.entries(config.beats).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => +(x * K).toFixed(4)) : typeof v === 'number' && k !== 'typeStep' ? +(v * K).toFixed(4) : v * K]));
const DUR = OUT.duration * K, W = OUT.width, H = OUT.height;
const { fragments: F } = JSON.parse(readFileSync(path.join(dir, 'assets/app/fragments.json'), 'utf8'));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// the app's own css, with its font files resolved from the project root
const GEIST = (readFileSync(path.join(dir, 'assets/app/app.css'), 'utf8').match(/font-family:GeistSans;src:url\(media\/([^)]+)\)/) || [])[1];
const appCss = readFileSync(path.join(dir, 'assets/app/app.css'), 'utf8').replace(/url\(media\//g, 'url(assets/app/media/');

const layer = (id, name, cls = '') => {
  const f = F[name]; if (!f) throw new Error(`missing fragment ${name} — run node harvest.mjs`);
  // real product css: its truncate/leading combos overflow their line box by a few px, as in the app
  return `<div class="L ${cls}" data-layout-allow-overflow id="L-${id.replace('@m', '-m')}" style="width:${f.w}px;height:${f.h}px">${f.html}</div>`;
};
const MARK = (() => {
  const c = 16, r = 13, a = 22, rad = d => d * Math.PI / 180, f = n => n.toFixed(4);
  const p1 = [c + r * Math.cos(rad(90 - a)), c - r * Math.sin(rad(90 - a))], p2 = [c + r * Math.cos(rad(270 - a)), c - r * Math.sin(rad(270 - a))];
  return id => `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" class="mark"><g${id ? ` id="${id}-markg"` : ''}>` +
    `<path${id ? ` id="${id}-pa"` : ''} d="M ${f(p1[0])} ${f(p1[1])} A 13 13 0 0 1 ${f(p2[0])} ${f(p2[1])} Z" fill="var(--shell-foreground)"/>` +
    `<path${id ? ` id="${id}-pb"` : ''} d="M ${f(p1[0])} ${f(p1[1])} A 13 13 0 0 0 ${f(p2[0])} ${f(p2[1])} Z" fill="var(--shell-accent)" stroke="var(--shell-accent)" stroke-width="0.35" stroke-linejoin="round"/></g></svg>`; // the hairline stroke closes the antialiasing seam between the halves (visible when the camera dives in)
})();
// the AppNav lockup, with the product's own classes (Wordmark tamanho="md")
const lockup = id => `<div class="L lockup" id="${id}">${MARK(id)}<span class="font-brand inline-flex items-baseline leading-none text-[1.0625rem] tracking-[-0.005em] text-shell-foreground wordmark">` +
  [...`${BR.name}.${BR.suffix}`].map(c => `<span${c === '.' ? ' class="text-signal"' : ''}>${c}</span>`).join('') + '</span></div>';
// the Agenda's "agora" marker, reused for the chain labels (same classes as LinhaDoAgora)
const label = (id, text) => `<div class="L lbl" id="${id}"><span class="size-1.5 rounded-full bg-accent shrink-0"></span><span class="text-[0.625rem] uppercase tracking-[0.08em] text-accent font-semibold">${esc(text)}</span></div>`;

const app = `<div class="L" data-layout-allow-overflow id="app" style="width:1440px;height:${Math.ceil(54 + F['dash-main-final'].h)}px">
    <div class="app-aside">${F['aside-inicio'].html}</div>
    <div class="app-header">${F['dash-header'].html}</div>
    <div class="app-main">${F['dash-main-final'].html}</div>
    <div id="app-chrome"></div>
  </div>`;

const body = [
  '<div id="glow"></div>',
  '<div class="L" id="blue"></div>',
  app,
  layer('dash-agora@m', 'dash-agora@m'),
  layer('ag-list@m', 'ag-list@m'), '<div class="L" id="band"></div>', layer('ag-stats', 'ag-stats'), layer('ag-stats-after', 'ag-stats-after'),
  layer('ag-row-henrique@m', 'ag-row-henrique@m', 'src'), layer('ag-row-henrique-pending@m', 'ag-row-henrique-pending@m', 'src'), layer('ag-row-henrique-after@m', 'ag-row-henrique-after@m', 'src'),
  layer('at-header@m', 'at-header@m'), layer('at-item@m', 'at-item@m'),
  layer('modal@m', 'modal@m', 'dlg'),
  layer('cx-card@m', 'cx-card@m'), layer('cm-row@m', 'cm-row@m'),
  '<div class="line" id="line1" style="height:170px"></div>', '<div class="line" id="line2" style="height:180px"></div>',
  label('lbl-at', 'Atendimento'), label('lbl-venda', 'Venda'), label('lbl-caixa', 'Caixa'), label('lbl-com', 'Comissões'),
  ...MODS.map(([n]) => layer('aside-' + n, 'aside-' + n, 'spine')),
  ...MODS.map(([, c], i) => layer('m-' + i, c, 'mod')),
  '<div id="parts"></div>',
  '<div class="L bigtype" id="t-agora">Agora e a seguir</div>',
  lockup('lock'), lockup('lock2'),
  `<p class="L" id="tagline">${esc(BR.tagline)}</p>`,
].join('\n  ');

const film = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>CORTEX.OS — film</title></head>
<body>
<template>
<style>
/* the film layer; the product's own css lives unscoped in index.html */
#root { position: absolute; inset: 0; overflow: hidden; background: #041723; font-family: var(--font-sans); color: var(--foreground); -webkit-font-smoothing: antialiased; }
#root *, #root *::before, #root *::after { animation: none !important; transition: none !important; }
#root .L { position: absolute; left: 0; top: 0; transform-origin: 0 0; opacity: 0; visibility: hidden; }
#root .L.src { top: -4000px; }
#root .spine { height: 470px !important; overflow: hidden; border-bottom: 1px solid var(--shell-border); }
#root .spine aside { height: 900px !important; }
#root .spine aside { position: relative !important; }
#root .dlg dialog { position: static; display: block; margin: 0; width: 100% !important; max-width: none !important; }
#root #glow { position: absolute; inset: 0; background: radial-gradient(circle at 50% 10%, rgba(0,147,214,0.20), rgba(0,147,214,0) 60%); opacity: 0; }
#root #blue { width: ${W}px; height: ${H}px; background: #0093D6; }
#root #app { background: var(--background); border-radius: 14px; overflow: hidden; }
#root #app .app-aside { position: absolute; left: 0; top: 0; width: 240px; height: 100%; }
#root #app .app-aside aside { height: 100% !important; position: relative !important; }
#root #app .app-header { position: absolute; left: 240px; top: 0; width: 1200px; }
#root #app .app-main { position: absolute; left: 264px; top: 54px; width: 1152px; }
#root #app-chrome { position: absolute; inset: 0; border-radius: 14px; border: 1px solid rgba(232,230,221,0.16); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); pointer-events: none; }
#root #parts { position: absolute; inset: 0; }
#root #band { width: ${W}px; height: 470px; background: linear-gradient(to bottom, #041723 0%, #041723 72%, rgba(4,23,35,0) 100%); }
#root .part { position: absolute; left: 0; top: 0; transform-origin: 0 0; white-space: nowrap; visibility: hidden; }
#root .part > * { width: 100%; }
#root .line { position: absolute; left: 0; top: 0; width: 2px; background: var(--brand-blue); opacity: 0; transform-origin: 50% 0; }
#root .lbl { display: flex; align-items: center; gap: 0.625rem; transform: none; white-space: nowrap; }
#root .bigtype { font-weight: 600; font-size: 104px; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(232,230,221,0.16); white-space: nowrap; line-height: 1; }
#root .lockup { display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
#root .lockup .mark { display: block; flex: none; }
#root #tagline { left: 0; width: ${W}px; text-align: center; font-weight: 600; font-size: 30px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(232,230,221,0.62); }
</style>
<div id="root" data-composition-id="film" data-width="${W}" data-height="${H}">
  ${body}
</div>
<script>
const B = ${JSON.stringify(B)};
const MODS = ${JSON.stringify(MODS)};
${readFileSync(path.join(dir, 'film.timeline.js'), 'utf8')}
(document.fonts && document.fonts.load ? Promise.all([document.fonts.load('600 16px GeistSans'), document.fonts.load('400 16px GeistSans'), document.fonts.load('700 17px panchang')]).then(() => document.fonts.ready) : Promise.resolve()).then(buildFilm);
</script>
</template>
</body>
</html>
`;
mkdirSync(path.join(dir, 'compositions'), { recursive: true });
writeFileSync(path.join(dir, 'compositions/film.html'), film);

// ------------------------------------------------------------ index + sound
mkdirSync(path.join(dir, 'assets/vendor'), { recursive: true });
const gsapSrc = path.resolve(dir, '../cortex-os-launch/assets/vendor/gsap.min.js');
if (!existsSync(path.join(dir, 'assets/vendor/gsap.min.js'))) copyFileSync(gsapSrc, path.join(dir, 'assets/vendor/gsap.min.js'));
if (OUT.audio && !process.argv.includes("--no-audio")) {
  writeFileSync(path.join(dir, '.beats.json'), JSON.stringify({ duration: DUR, beats: B }));
  execFileSync('python3', [path.join(dir, 'film-audio.py'), path.join(dir, '.beats.json'), path.join(dir, 'assets/film.wav')], { stdio: 'inherit' });
}
writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>CORTEX.OS — product film</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #041723; }
      #main { width: 100%; height: 100%; position: relative; background: #041723; }
      #main .scene { position: absolute; inset: 0; }
    </style>
    <style>
/* ---- CORTEX.OS production css (app/globals.css + Tailwind build), harvested from the running app ---- */
${appCss}
/* next/font sets these on <html> in the app; Tailwind resolves --font-sans / --font-logo at :root */
:root { --font-panchang: "panchang", "panchang Fallback"; --font-geist-sans: "GeistSans", "GeistSans Fallback"; }
/* names that only appear as fallbacks in the product's font stacks */
@font-face { font-family: "Geist Sans"; src: url(assets/app/media/${GEIST}) format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Apple Color Emoji"; src: local("Apple Color Emoji"); }
@font-face { font-family: "Segoe UI Emoji"; src: local("Segoe UI Emoji"); }
@font-face { font-family: "Segoe UI Symbol"; src: local("Segoe UI Symbol"); }
@font-face { font-family: "SFMono-Regular"; src: local("SFMono-Regular"); }
    </style>
  </head>
  <body>
    <!-- generated by build.mjs from film.config.mjs — edit the config / film.timeline.js, then \`node build.mjs\` -->
    <div id="main" data-composition-id="main" data-start="0" data-duration="${DUR.toFixed(3)}" data-width="${W}" data-height="${H}">
      <div class="scene" id="film-host" data-composition-id="film" data-composition-src="compositions/film.html" data-start="0" data-duration="${DUR.toFixed(3)}" data-track-index="1" data-width="${W}" data-height="${H}"></div>
${OUT.audio ? `      <audio id="score" src="assets/film.wav" data-start="0" data-duration="${DUR.toFixed(3)}" data-track-index="2" data-volume="1"></audio>` : ''}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`);
console.log(`✓ compositions/film.html (${(film.length / 1024).toFixed(0)} KB, ${Object.keys(F).length} fragments available) · index.html ${DUR}s`);
