// Drives the REAL CORTEX.OS app (running locally, see scripts/) through the
// trailer's story and records every UI state it passes through: a 4K screenshot
// plus the DOM geometry of the elements the camera and cursor care about.
//
// Nothing is mocked in the browser: clicks hit real server actions against the
// local Supabase, so "Iniciar atendimento" really creates the attendance and
// "Confirmar e fechar" really closes the sale.
//
//   node app-capture/capture.mjs     -> assets/captures/manifest.json + assets/captures/*.png
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import config from '../trailer.config.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, '../assets/captures');
const { app, shots } = config;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Every capture starts from the same seeded morning: the story mutates the database.
if (!process.argv.includes('--no-reset')) {
  const { execFileSync } = await import('node:child_process');
  execFileSync(path.join(dir, 'scripts/setup-backend.sh'), ['--reset'], { stdio: 'inherit' });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: app.viewport, deviceScaleFactor: app.deviceScaleFactor, colorScheme: app.colorScheme,
  locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'no-preference',
});
const page = await ctx.newPage();
// Re-anchor the server clock (fake-now.cjs) and the browser clock to the same instant.
const anchor = Date.now();
writeFileSync(path.join(process.env.CORTEX_TRAILER_WORK || path.join(os.homedir(), '.cortex-trailer-supabase'), 'fake-now.json'),
  JSON.stringify({ fakeNow: app.fakeNow, anchor }));
await page.clock.setSystemTime(new Date(Date.parse(app.fakeNow) + (Date.now() - anchor)));
await new Promise(r => setTimeout(r, 400)); // server polls the anchor file every 250 ms
page.on('pageerror', e => console.error('[page error]', e.message));

const manifest = { viewport: app.viewport, scale: app.deviceScaleFactor, states: {} };
const MAX_DOC = 1400; // css px
const PARK = { x: app.viewport.width - 8, y: app.viewport.height - 8 }; // mouse rests off anything interactive

async function settle(ms = 700) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

// Geometry of named elements. Elements inside the sticky shell (aside/header)
// are stored in viewport space; everything else in document space.
async function measure(targets) {
  const rects = {};
  for (const [name, loc] of Object.entries(targets)) {
    const el = typeof loc === 'function' ? loc() : loc;
    if (!(await el.count())) { console.warn(`  (missing: ${name})`); continue; }
    rects[name] = await el.first().evaluate(n => {
      const r = n.getBoundingClientRect(), fixed = !!n.closest('aside, header, dialog');
      return { x: r.x, y: r.y + (fixed ? 0 : scrollY), w: r.width, h: r.height, fixed };
    });
  }
  return rects;
}

// One UI state = viewport shot (the sticky shell as it looks right now) + full
// page with the shell hidden (the scrollable content), so the compositor can
// scroll the content under a fixed shell exactly like the browser does.
async function snap(name, targets = {}, { fullPage = true } = {}) {
  const scrollY = await page.evaluate(() => scrollY);
  const rects = await measure(targets);
  await page.screenshot({ path: path.join(OUT, `${name}.chrome.png`) });
  let docHeight = app.viewport.height;
  if (fullPage) {
    await page.addStyleTag({ content: 'aside, header { visibility: hidden !important }', }).then(h => h.evaluate(n => n.id = '__hide'));
    // Only as much page as the camera can scroll to — keeps the 4K layers in memory budget.
    docHeight = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), MAX_DOC);
    await page.screenshot({ path: path.join(OUT, `${name}.page.png`), fullPage: true, clip: { x: 0, y: 0, width: app.viewport.width, height: docHeight } });
    await page.evaluate(() => document.getElementById('__hide')?.remove());
  }
  const shell = await measure({ aside: page.locator('aside').first(), header: page.locator('header').first() });
  manifest.states[name] = { url: new URL(page.url()).pathname, scrollY, docHeight, fullPage, rects: { ...shell, ...rects } };
  console.log(`✓ ${name}  ${manifest.states[name].url}  scroll=${scrollY}`);
}

const nav = label => page.locator('aside nav a', { hasText: new RegExp(`^\\s*${label}\\s*$`) }).first();
const text = (t, root = page) => root.getByText(t, { exact: true }).first();
const up = (loc, sel) => loc.locator(`xpath=ancestor::${sel}[1]`);

// ------------------------------------------------------------------- login
await page.goto(app.baseUrl + '/login');
await page.fill('input[type=email]', app.login.email);
await page.fill('input[type=password]', app.login.password);
await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login')), page.click('form:has(input[value=signin]) button[type=submit]')]);

// ------------------------------------------------------------------ Início
await page.goto(app.baseUrl + shots.inicio);
await page.mouse.move(PARK.x, PARK.y);
await settle(1200);
const inicioTargets = () => ({
  mark: page.locator('aside .cortex-mark').first(),
  wordmark: page.locator('aside [aria-label="CORTEX.OS"]').first(),
  navInicio: nav('Início'),
  navAgenda: nav('Agenda'),
  greeting: page.getByText(/^Bom dia|^Boa tarde|^Boa noite/).first(),
  kpiAtendimentos: up(text('Atendimentos'), 'div'),
  faturamento: up(text('Faturamento'), 'div'),
  agora: up(page.getByText(/^Agora e a seguir$/i).first(), 'section'),
  chart: up(page.getByText('Faturamento por dia').first(), 'section'),
});
await snap('inicio', inicioTargets());
await page.hover('aside nav a:has-text("Agenda")');
await page.waitForTimeout(400);
await snap('inicio-hover', inicioTargets());
await page.mouse.down();
await page.waitForTimeout(160);
await snap('inicio-press', inicioTargets());
await page.mouse.up();
await page.waitForURL('**/agenda');
await page.mouse.move(PARK.x, PARK.y);
await settle(1000);

// ------------------------------------------------------------------ Agenda
const row = () => up(text(app.focusClient), 'div[contains(@class,"px-4")]');
const agendaTargets = () => ({
  navAgenda: nav('Agenda'),
  subAtendimento: page.locator('aside nav a[href="/atendimento"]').first(),
  title: page.getByRole('heading', { name: 'Agenda' }).first(),
  kpis: up(text('Aguardando'), 'div[contains(@class,"grid")]'),
  kpiAguardando: up(text('Aguardando'), 'div[contains(@class,"border") or contains(@class,"rounded")]'),
  kpiEmAtendimento: up(text('Em atendimento'), 'div[contains(@class,"border") or contains(@class,"rounded")]'),
  dateNav: page.locator('main nav, main [aria-label*="dia" i]').first(),
  rowFocus: row(),
  rowFirstInProgress: up(text('Felipe Santos'), 'div[contains(@class,"px-4")]'),
  agoraLine: page.locator('main li', { hasText: /^agora$/i }).first(),
  btnStart: row().getByRole('button', { name: 'Iniciar atendimento' }),
});
await snap('agenda', agendaTargets());
const btnStart = row().getByRole('button', { name: 'Iniciar atendimento' });
await btnStart.hover();
await page.waitForTimeout(400);
await snap('agenda-hover', agendaTargets());
await page.mouse.down();
await page.waitForTimeout(160);
await snap('agenda-press', agendaTargets());

// Hold the server action's response so the real pending state can be recorded.
let release; const held = new Promise(r => (release = r)); let passed;
const done = new Promise(r => (passed = r));
await page.route('**/*', async route => {
  const req = route.request();
  if (req.method() === 'POST' && req.headers()['next-action']) { await held; await route.continue(); passed(); }
  else await route.continue();
});
await page.mouse.up();
await page.getByRole('button', { name: 'Iniciando…' }).waitFor({ timeout: 5000 });
await page.waitForTimeout(150);
await snap('agenda-pending', agendaTargets());
release();
await done;
await page.unroute('**/*');
// KPI label + 3 rows. The action revalidates /agenda; if the router refresh is
// slow under interception, a reload shows the same server state.
await page.getByText('Em atendimento').nth(3).waitFor({ timeout: 4000 })
  .catch(async () => { await page.reload(); await page.getByText('Em atendimento').nth(3).waitFor(); });
await row().scrollIntoViewIfNeeded();
await page.mouse.move(PARK.x, PARK.y);
await settle(900);
await snap('agenda-result', agendaTargets());

// ------------------------------------------------------------- Atendimento
await page.evaluate(() => scrollTo(0, 0));
await page.hover('aside nav a[href="/atendimento"]');
await page.waitForTimeout(300);
await page.mouse.down();
await page.waitForTimeout(160);
await snap('agenda-press-subnav', { ...agendaTargets() });
await page.mouse.up();
await page.waitForURL('**/atendimento');
await page.mouse.move(PARK.x, PARK.y);
await settle(900);
const listRow = () => page.locator('main a[href^="/atendimento/"]', { hasText: app.focusClient }).first();
const listTargets = () => ({
  subAtendimento: page.locator('aside nav a[href="/atendimento"]').first(),
  title: page.getByRole('heading', { name: /Atendimentos/ }).first(),
  rowFocus: listRow(),
});
await snap('atendimentos', listTargets());
manifest.attendanceId = (await listRow().getAttribute('href')).split('/').pop();
await listRow().hover();
await page.waitForTimeout(300);
await snap('atendimentos-hover', listTargets());
await page.mouse.down();
await page.waitForTimeout(160);
await snap('atendimentos-press', listTargets());
await page.mouse.up();
await page.waitForURL('**/atendimento/*');
await page.mouse.move(PARK.x, PARK.y);
await settle(900);

const detailTargets = () => ({
  subAtendimento: page.locator('aside nav a[href="/atendimento"]').first(),
  title: page.getByRole('heading', { name: app.focusClient }).first(),
  item: up(page.locator('main').getByText('Total', { exact: true }).first(), 'div[contains(@class,"rounded")]'),
  total: up(page.locator('main').getByText('Total', { exact: true }).first(), 'div'),
  addService: up(page.locator('main').getByText('Adicionar serviço', { exact: true }).first(), 'div[contains(@class,"rounded")]'),
  btnFechar: page.getByRole('button', { name: 'Fechar e receber' }),
  btnCancelar: page.getByRole('button', { name: 'Cancelar' }).first(),
});
await snap('atendimento', detailTargets());
await page.getByRole('button', { name: 'Fechar e receber' }).hover();
await page.waitForTimeout(300);
await snap('atendimento-hover', detailTargets());
await page.mouse.down();
await page.waitForTimeout(160);
await snap('atendimento-press', detailTargets());
await page.mouse.up();
const dialog = page.locator('dialog[open]');
await dialog.waitFor();
const methodSelect = dialog.locator('select').first();
if (await methodSelect.locator('option[value="pix"]').count()) await methodSelect.selectOption('pix');
await dialog.getByRole('button', { name: 'Confirmar e fechar' }).hover();
await page.waitForTimeout(500);
const modalTargets = () => ({
  dialog: page.locator('dialog[open]'),
  modalTotal: up(dialog.getByText('Total a receber').first(), 'div'),
  payment: methodSelect,
  btnConfirm: dialog.getByRole('button', { name: 'Confirmar e fechar' }),
});
await snap('modal', modalTargets(), { fullPage: false });
await page.mouse.down();
await page.waitForTimeout(160);
await snap('modal-press', modalTargets(), { fullPage: false });
await page.mouse.up();
await page.waitForURL(u => u.pathname === '/atendimento', { timeout: 15000 });

// --------------------------------------------------- Início, after the sale
await page.goto(app.baseUrl + shots.inicio);
await page.mouse.move(PARK.x, PARK.y);
await settle(1200);
await snap('inicio-final', inicioTargets());

writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('wrote assets/captures/manifest.json');
await browser.close();
