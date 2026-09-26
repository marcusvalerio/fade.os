// Renders compose/index.html frame by frame (headless Chromium) into trailer.mp4.
//   node render.mjs                  full render (+ soundtrack from audio.py if output.audio)
//   node render.mjs --stills 2,6.5   review frames → stills/
//   node render.mjs --serve          open http://127.0.0.1:4173/showreel/cortex/compose/ to scrub live
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from './config.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..'); // repo root: serves app/fonts and node_modules/geist too
const args = process.argv.slice(2);
const opt = k => (args.includes(k) ? args[args.indexOf(k) + 1] ?? true : null);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    const f = (await stat(p)).isDirectory() ? path.join(p, 'index.html') : p;
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(await readFile(f));
  } catch { res.writeHead(404); res.end(); }
}).listen(4173, '127.0.0.1');
const URL_ = 'http://127.0.0.1:4173/showreel/cortex/compose/index.html';
if (args.includes('--serve')) { console.log('scrub at', URL_.replace('index.html', '')); await new Promise(() => {}); }

const browser = await chromium.launch({ args: ['--js-flags=--max-old-space-size=4096'] });
const page = await browser.newPage({ viewport: { width: config.output.width, height: config.output.height }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('[page error]', e); process.exit(1); });
page.on('console', m => m.type() === 'error' && console.error('[page]', m.text()));
await page.goto(URL_ + '?render');
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const canvas = await page.$('canvas');
const shot = async (t, type = 'png') => { await page.evaluate(t => window.renderFrame(t), t); return canvas.screenshot({ type }); };

if (opt('--stills')) {
  mkdirSync(path.join(dir, 'stills'), { recursive: true });
  for (const t of String(opt('--stills')).split(',').map(Number))
    writeFileSync(path.join(dir, 'stills', `t_${t.toFixed(2).padStart(5, '0')}.png`), await shot(t));
} else {
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const wav = path.join(dir, 'trailer.wav');
  if (config.output.audio) {
    writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify({ ...config.output, timeline: config.timeline }));
    execFileSync('python3', [path.join(dir, 'audio.py'), path.join(dir, 'timeline.json'), wav], { stdio: 'inherit' });
  }
  const audio = config.output.audio && existsSync(wav);
  const fps = config.output.fps, total = Math.round(config.output.duration / config.output.speed * fps);
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...(audio ? ['-i', wav] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart',
    ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), path.join(dir, 'trailer.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const buf = await shot(f / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('wrote trailer.mp4');
}
await browser.close(); server.close();
