// Renders index.html frame-by-frame with headless Chromium and pipes PNGs into ffmpeg.
//   node render.mjs                 -> showreel.mp4 (muxes showreel.wav if present)
//   node render.mjs --stills 0.5,3  -> stills/t_0.50.png ... for quick review
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = 60, DUR = 15, FRAMES = FPS * DUR;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

const browser = await chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[page error]', e); process.exit(1); });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?render');
await page.evaluate(() => window.ready);
const canvas = await page.$('canvas');
const shot = async t => { await page.evaluate(t => window.renderFrame(t), t); return canvas.screenshot({ type: 'png' }); };

if (stillsArg) {
  mkdirSync(path.join(dir, 'stills'), { recursive: true });
  const { writeFileSync } = await import('node:fs');
  for (const t of stillsArg.split(',').map(Number)) writeFileSync(path.join(dir, 'stills', `t_${t.toFixed(2)}.png`), await shot(t));
} else {
  const wav = path.join(dir, 'showreel.wav');
  const audioIn = existsSync(wav) ? ['-i', wav] : [];
  const audioOut = existsSync(wav) ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : [];
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...audioIn,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ...audioOut,
    path.join(dir, 'showreel.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < FRAMES; f++) {
    const buf = await shot(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${FRAMES}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote showreel.mp4');
}
await browser.close();
