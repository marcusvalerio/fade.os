// Preloaded into the Next.js server (NODE_OPTIONS=--require) so the product's
// "today", its greeting and its "agora" line land on the trailer's business
// moment. Time keeps flowing; only the origin moves.
//
// The origin is re-read from FAKE_NOW_FILE ({ fakeNow, anchor }) so capture.mjs
// can re-anchor server and browser to the same instant right before it starts —
// otherwise server-rendered times and hydrated client times disagree.
const fs = require('node:fs');
const file = process.env.FAKE_NOW_FILE;
const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);
let offset = process.env.FAKE_NOW ? Date.parse(process.env.FAKE_NOW) - realNow() : 0, checked = 0, mtime = 0;
function now() {
  const r = realNow();
  if (file && r - checked > 250) {
    checked = r;
    try {
      const m = fs.statSync(file).mtimeMs;
      if (m !== mtime) { mtime = m; const { fakeNow, anchor } = JSON.parse(fs.readFileSync(file, 'utf8')); offset = Date.parse(fakeNow) - anchor; }
    } catch {}
  }
  return r + offset;
}
if (process.env.FAKE_NOW || file) {
  globalThis.Date = new Proxy(RealDate, {
    construct(T, args, newTarget) { return Reflect.construct(T, args.length ? args : [now()], newTarget); },
    apply() { return new RealDate(now()).toString(); },
    get(T, key, recv) { return key === 'now' ? now : Reflect.get(T, key, recv); },
  });
}
