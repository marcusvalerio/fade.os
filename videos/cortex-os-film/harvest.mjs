// Harvests REAL CORTEX.OS UI as live DOM for the film — not screenshots.
//
// Drives the running app (Next.js of this repo against the local Supabase, see
// ../cortex-os-launch/app-capture) through the story and, at each state, stores
// the outerHTML of the real components plus their size. It also copies the
// app's compiled production CSS and fonts, so the compositions render those
// components with the product's own styles, crisp at any zoom and animatable
// piece by piece.
//
//   node harvest.mjs            → assets/app/{app.css, media/*, fragments.json}
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(dir, '../..');
const CAPTURE = path.resolve(dir, '../cortex-os-launch/app-capture');
const OUT = path.join(dir, 'assets/app');
const APP = {
  baseUrl: 'http://127.0.0.1:3100', email: 'rafael@norte21.demo', password: 'cortex-demo-2026',
  fakeNow: '2026-09-25T13:26:00Z', viewport: { width: 1440, height: 900 }, focus: 'Henrique Rocha',
};

if (!process.argv.includes('--no-reset')) execFileSync(path.join(CAPTURE, 'scripts/setup-backend.sh'), ['--reset'], { stdio: 'inherit' });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(path.join(OUT, 'media'), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: APP.viewport, colorScheme: 'dark', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await ctx.newPage();
const anchor = Date.now();
writeFileSync(path.join(process.env.CORTEX_TRAILER_WORK || path.join(os.homedir(), '.cortex-trailer-supabase'), 'fake-now.json'), JSON.stringify({ fakeNow: APP.fakeNow, anchor }));
await page.clock.setSystemTime(new Date(Date.parse(APP.fakeNow) + (Date.now() - anchor)));
await new Promise(r => setTimeout(r, 400));

const F = {};
const settle = async (ms = 700) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(ms); };
const go = async p => { await page.goto(APP.baseUrl + p); await page.mouse.move(1439, 899); await settle(900); };
const text = t => page.getByText(t, { exact: true }).first();
const up = (loc, sel) => loc.locator(`xpath=ancestor::${sel}[1]`);
const row = name => up(page.locator('main').getByText(name, { exact: true }).first(), 'div[contains(@class,"px-4")]');

// outerHTML with live form state written back into attributes (value, selected, checked)
async function frag(name, loc) {
  if (!(await loc.count())) { console.warn(`  (missing ${name})`); return; }
  F[name] = await loc.first().evaluate(n => {
    for (const el of n.querySelectorAll('input, textarea')) { el.setAttribute('value', el.value); if (el.checked) el.setAttribute('checked', ''); }
    for (const sel of n.querySelectorAll('select')) for (const o of sel.options) o.selected ? o.setAttribute('selected', '') : o.removeAttribute('selected');
    const r = n.getBoundingClientRect();
    return { html: n.outerHTML, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
  });
  console.log(`✓ ${name}  ${F[name].w}×${F[name].h}`);
}
const aside = name => frag(`aside-${name}`, page.locator('aside').first());
// The same component in the product's own mobile layout (the app is responsive):
// built for a vertical screen, it fills a 9:16 frame at 2.5× and stays legible.
async function both(name, locFn) {
  await frag(name, locFn());
  await page.setViewportSize({ width: 430, height: 932 }); await page.waitForTimeout(350);
  await frag(name + '@m', locFn());
  await page.setViewportSize(APP.viewport); await page.waitForTimeout(250);
}

// ------------------------------------------------------------------ login
await page.goto(APP.baseUrl + '/login');
await page.fill('input[type=email]', APP.email);
await page.fill('input[type=password]', APP.password);
await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login')), page.click('form:has(input[value=signin]) button[type=submit]')]);

// the document context the fragments need: next/font variables + theme class
const doc = await page.evaluate(() => ({
  htmlClass: document.documentElement.className, bodyClass: document.body.className,
  css: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => new URL(l.href).pathname),
}));

// ----------------------------------------------------------------- Início
await go('/dashboard');
await frag('dash-main', page.locator('main').first());
await frag('dash-header', page.locator('header').first());
await aside('inicio');
await frag('dash-kpis', up(text('Faturamento'), 'div[.//*[normalize-space()="Atendimentos"]]'));
await both('dash-agora', () => up(page.getByText(/^Agora e a seguir$/i).first(), 'section'));
await both('dash-row-felipe', () => up(page.locator('main').getByText('Felipe Santos', { exact: true }).first(), 'a'));
await frag('dash-chart', up(text('Faturamento por dia'), 'section'));

// ----------------------------------------------------------------- Agenda
await go('/agenda');
await aside('agenda');
await frag('ag-title', up(page.getByRole('heading', { name: 'Agenda' }).first(), 'div[contains(@class,"flex")]'));
await both('ag-stats', () => up(text('Aguardando'), 'div[contains(@class,"grid")]'));
await frag('ag-datenav', page.locator('main nav').first());
await frag('ag-aviso', up(page.getByText(/aguardando confirmação/).first(), 'div[contains(@class,"border")]'));
await both('ag-list', () => up(page.locator('main').getByText('Gustavo Lima', { exact: true }).first(), 'div[contains(@class,"rounded")]'));
await frag('ag-agora', page.locator('main li', { hasText: /^agora$/i }).first());
for (const c of ['Felipe Santos', 'Lucas Oliveira', 'Henrique Rocha', 'Leandro Costa', 'Mateus Ribeiro', 'Caio Martins', 'Pedro Nogueira', 'Bruno Alves'])
  await both(`ag-row-${c.split(' ')[0].toLowerCase()}`, () => row(c));

// Iniciar atendimento — the real pending state, then the real result
let release; const held = new Promise(r => (release = r)); let passed; const done = new Promise(r => (passed = r));
await page.route('**/*', async route => {
  const req = route.request();
  if (req.method() === 'POST' && req.headers()['next-action']) { await held; await route.continue(); passed(); } else await route.continue();
});
await row(APP.focus).getByRole('button', { name: 'Iniciar atendimento' }).click();
await page.getByRole('button', { name: 'Iniciando…' }).waitFor();
await both('ag-row-henrique-pending', () => row(APP.focus));
release(); await done; await page.unroute('**/*');
await page.getByText('Em atendimento').nth(3).waitFor({ timeout: 4000 }).catch(async () => { await page.reload(); await page.getByText('Em atendimento').nth(3).waitFor(); });
await page.mouse.move(1439, 899); await settle(700);
await both('ag-row-henrique-after', () => row(APP.focus));
await both('ag-stats-after', () => up(text('Aguardando'), 'div[contains(@class,"grid")]'));
await frag('ag-list-after', up(page.locator('main').getByText('Gustavo Lima', { exact: true }).first(), 'div[contains(@class,"rounded")]'));

// ------------------------------------------------------------ Atendimento
await go('/atendimento');
await aside('atendimento');
const href = await page.locator('main a[href^="/atendimento/"]', { hasText: APP.focus }).first().getAttribute('href');
await frag('at-list', up(page.locator('main a[href^="/atendimento/"]').first(), 'div[.//a[contains(@href,"/atendimento/")][3]]'));
await go(href);
await both('at-header', () => up(page.getByRole('heading', { name: APP.focus }).first(), 'div[contains(@class,"justify-between")]'));
await both('at-item', () => up(page.locator('main').getByText('Total', { exact: true }).first(), 'div[contains(@class,"rounded")]'));
await frag('at-main', page.locator('main').first());
await page.getByRole('button', { name: 'Fechar e receber' }).click();
const dialog = page.locator('dialog[open]'); await dialog.waitFor();
// cash: in CORTEX.OS only cash payments move the drawer, and the film follows the sale into the Caixa
const sel = dialog.locator('select').first();
if (await sel.locator('option[value="cash"]').count()) await sel.selectOption('cash');
await page.mouse.move(1439, 899); await page.waitForTimeout(500);
await both('modal', () => dialog);
await dialog.getByRole('button', { name: 'Confirmar e fechar' }).click();
await page.waitForURL(u => u.pathname === '/atendimento', { timeout: 15000 });
// The database stamps the sale with its own clock; move it to the story's 10:41 (local demo DB only).
execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-q', '-c', `
  set session_replication_role = replica;
  with a as (select at.id from attendance at join client c on c.id = at.client_id where c.name = '${APP.focus}' and at.origin = 'from_appointment'),
       s as (update sale set created_at = timestamptz '2026-09-25 10:41-03', updated_at = timestamptz '2026-09-25 10:41-03' where attendance_id in (select id from a) returning id)
  select count(*) from s;
  update payment set created_at = timestamptz '2026-09-25 10:41-03' where sale_id in (select id from sale where created_at = timestamptz '2026-09-25 10:41-03');
  update cash_movement set created_at = timestamptz '2026-09-25 10:41-03' where reference_id in (select id from payment where created_at = timestamptz '2026-09-25 10:41-03');
  update sale_item set created_at = timestamptz '2026-09-25 10:41-03' where sale_id in (select id from sale where created_at = timestamptz '2026-09-25 10:41-03');
  update commission set created_at = timestamptz '2026-09-25 10:41-03' where sale_item_id in (select id from sale_item where created_at = timestamptz '2026-09-25 10:41-03');`],
  { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'ignore' });

// ------------------------------------------- where the sale lands, and the rest of the system
await go('/vendas');     await aside('vendas');     await frag('vd-list', up(page.locator('main').getByText(APP.focus, { exact: true }).first(), 'div[contains(@class,"rounded")]'));
                         await frag('vd-row', up(page.locator('main').getByText(APP.focus, { exact: true }).first(), 'div[contains(@class,"px-4") or contains(@class,"py-3")]'));
await go('/caixa');      await aside('caixa');      await both('cx-card', () => up(text('Caixa principal'), 'div[contains(@class,"rounded")]'));
await go('/comissoes');  await aside('comissoes');  await both('cm-total', () => up(page.getByText(/^Devido no momento$/i).first(), 'div[contains(@class,"rounded")]'));
                         await frag('cm-list', up(page.locator('main').getByText('Marcar paga').first(), 'div[contains(@class,"rounded")][.//*[contains(.,"Marcar paga")]][last()]'));
                         await both('cm-row', () => up(page.locator('main').getByText('Thiago Moura', { exact: true }).first(), 'div[.//button[contains(.,"Marcar paga")]][1]'));
await go('/financeiro'); await aside('financeiro'); await both('fin-result', () => up(page.getByText(/^Resultado do período$/i).first(), 'div[contains(@class,"rounded")]'));
await go('/clientes');   await aside('clientes');   await both('cl-chamar', () => up(page.getByText('Clientes para chamar hoje').first(), 'section|div[contains(@class,"space-y")]'));
await go('/servicos');   await aside('servicos');   await both('sv-list', () => up(page.locator('main').getByText('Corte + Barba', { exact: true }).first(), 'div[contains(@class,"rounded")]'));
await go('/estoque');    await aside('estoque');    await both('es-critico', () => up(page.getByText('Estoque crítico', { exact: true }).first(), 'div[contains(@class,"border")]'));
await go('/produtos');   await aside('produtos');   await both('pd-list', () => up(page.locator('main').getByText('Pomada Modeladora', { exact: true }).first(), 'div[contains(@class,"rounded") or contains(@class,"border")][.//*[contains(.,"Cera Matte")]]'));
await go('/profissionais'); await aside('profissionais'); await frag('pr-list', up(page.locator('main').getByText('Marcus Vieira', { exact: true }).first(), 'div[contains(@class,"rounded")]'));
await go('/kpis');       await aside('kpis');       await frag('kpi-main', page.locator('main').first());
await go('/dashboard');  await frag('dash-main-final', page.locator('main').first());
await both('dash-kpis-final', () => up(text('Faturamento'), 'div[.//*[normalize-space()="Atendimentos"]]'));

// ---------------------------------------------------- css + fonts, made relative
let css = '';
for (const href of doc.css) css += readFileSync(path.join(REPO, '.next/static/css', path.basename(href)), 'utf8') + '\n';
const media = path.join(REPO, '.next/static/media');
for (const f of readdirSync(media)) if (css.includes(f)) copyFileSync(path.join(media, f), path.join(OUT, 'media', f));
css = css.replace(/\/_next\/static\/media\//g, 'media/');
writeFileSync(path.join(OUT, 'app.css'), css);
writeFileSync(path.join(OUT, 'fragments.json'), JSON.stringify({ doc, fragments: F }, null, 1));
console.log(`wrote assets/app (${Object.keys(F).length} fragments, css ${(css.length / 1024).toFixed(0)} KB)`);
await browser.close();
