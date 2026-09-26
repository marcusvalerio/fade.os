/**
 * Captura 2x dos componentes REAIS do CORTEX em cada estado da história —
 * os mesmos que a landing renderiza (app/_landing/screens.tsx), com dados de
 * exemplo. Complementa `hyperframes capture` (que fotografa a página como
 * está): aqui o palco da seção "A operação" é posto em cada passo
 * (`data-step`) e cada tela/peça é fotografada sozinha, com fundo
 * transparente e sem a sombra (a sombra é do filme, não da captura).
 *
 * Também mede, em pixels da imagem (2x), onde ficam os alvos dos toques do
 * filme (Confirmar, Cliente chegou, Confirmar e fechar…) e grava em
 * capture/assets/ui/positions.json.
 *
 * Uso (com `npm run dev` do app na porta 3000):
 *   PLAYWRIGHT_MODULE=/caminho/para/playwright/index.mjs node scripts/capture-ui.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "capture/assets/ui");
const URL = process.env.CORTEX_URL ?? "http://localhost:3000/";
const DPR = 2;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: DPR,
  reducedMotion: "reduce",
  colorScheme: "light",
});
await page.goto(URL, { waitUntil: "networkidle" });
await page.addStyleTag({
  content: `
    html, body, .lp, .lp-ink, .lp-paper, .lp-white, section { background: transparent !important; }
    /* Início e Clientes vivem nos cartões de "O que muda", em print reduzido e
       cortados em degradê; para o filme saem inteiros, na largura de sempre. */
    #diferenciais .lp-prova { overflow: visible !important; }
    #diferenciais .lp-prova-tela { max-height: none !important; -webkit-mask-image: none !important; mask-image: none !important; }
    #diferenciais .lp-prova-tela .lp-window { zoom: 1 !important; }
    #diferenciais .lp-prova:nth-child(4) .lp-prova-tela { width: 790px !important; }
    #diferenciais .lp-prova:nth-child(2) .lp-prova-tela { width: 592px !important; }
    .lp-window { box-shadow: none !important; }
    .lp-phone { box-shadow: 0 0 0 1px rgb(255 255 255 / 10%) inset, 0 0 0 1.5px #1c252b !important; }
    .lp-nav { display: none !important; }
    .lp-hero-window { visibility: hidden !important; }
    .shadow-md { box-shadow: none !important; }
    /* Cada captura isola o alvo: o que está atrás dele (outra janela, o modal
       sobre o atendimento) não pode vazar pelos cantos arredondados. */
    body.cap-hide * { visibility: hidden !important; }
    body.cap-hide .cap-show, body.cap-hide .cap-show * { visibility: visible !important; }
  `,
});
await page.waitForTimeout(600);

const positions = {};

async function shot(name, selector, targets = {}, prepare) {
  if (prepare) await page.evaluate(prepare);
  await page.waitForTimeout(250);
  const el = page.locator(selector).first();
  await page.evaluate(() => {
    document.body.classList.add("cap-hide");
    document.querySelectorAll(".cap-show").forEach((n) => n.classList.remove("cap-show"));
  });
  await el.evaluate((n) => n.classList.add("cap-show"));
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await el.screenshot({ path: join(OUT, `${name}.png`), omitBackground: true, animations: "disabled" });
  const box = await el.boundingBox();
  const rects = {};
  for (const [key, spec] of Object.entries(targets)) {
    const r = await page.evaluate(
      ({ root, spec }) => {
        const rootEl = document.querySelector(root);
        const scope = rootEl;
        let t = null;
        if (spec.text) {
          const all = Array.from(scope.querySelectorAll(spec.within ?? "*")).filter(
            (n) => n.children.length === 0 && n.textContent.trim() === spec.text && n.getBoundingClientRect().width > 0
          );
          const visible = all.filter((n) => {
            let e = n;
            while (e && e !== rootEl) {
              if (parseFloat(getComputedStyle(e).opacity) === 0) return false;
              e = e.parentElement;
            }
            return true;
          });
          t = visible[spec.index ?? 0] ?? null;
          if (t && spec.closest) t = t.closest(spec.closest) ?? t;
        } else if (spec.selector) {
          t = scope.querySelector(spec.selector);
        }
        if (!t) return null;
        const a = rootEl.getBoundingClientRect();
        const b = t.getBoundingClientRect();
        return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
      },
      { root: selector, spec }
    );
    rects[key] = r && { x: Math.round(r.x * DPR), y: Math.round(r.y * DPR), w: Math.round(r.w * DPR), h: Math.round(r.h * DPR) };
  }
  positions[name] = { w: Math.round(box.width * DPR), h: Math.round(box.height * DPR), targets: rects };
  console.log(name, positions[name].w, "x", positions[name].h, Object.keys(rects).filter((k) => !rects[k]).length ? "MISSING " + Object.keys(rects).filter((k) => !rects[k]) : "");
}

const setStep = (n, extra = "") => `(() => { const s = document.getElementById("lp-story-stage"); s.dataset.step = "${n}"; ${extra} })()`;
const noPops = `document.querySelectorAll("#lp-story-stage .lp-pop").forEach((p) => (p.style.visibility = "hidden"));`;
const pops = `document.querySelectorAll("#lp-story-stage .lp-pop").forEach((p) => (p.style.visibility = ""));`;

// Celular do cliente (Hero): escolha de serviço → agendamento confirmado.
await shot("phone-servicos", ".lp-hero-phone .lp-phone", {
  servico: { text: "Corte + Barba", closest: ".material-solid" },
  continuar: { text: "Continuar" },
}, `(() => { document.querySelector(".lp-hero-phone-a").style.opacity = "1"; document.querySelector(".lp-hero-phone-b").style.opacity = "0"; })()`);
// O filme segue o Bruno (09:30), o mesmo horário que o palco da história passa
// ao AgendamentoConfirmado; o celular do Hero mostra outro cliente (10:30).
await shot("phone-confirmado", ".lp-hero-phone .lp-phone", {}, `(() => {
  document.querySelector(".lp-hero-phone-a").style.opacity = "0";
  const b = document.querySelector(".lp-hero-phone-b");
  b.style.opacity = "1";
  b.querySelectorAll("span").forEach((n) => { if (n.children.length === 0 && n.textContent.trim() === "10:30") n.textContent = "09:30"; });
})()`);

// Agenda nos três estados da história.
const stageWindow = "#lp-story-stage > .lp-layer:nth-child(1) .lp-window";
await shot("agenda-s1", stageWindow, {
  linha: { text: "Bruno Alves", closest: ".lp-row-focus" },
  whatsapp: { text: "WhatsApp" },
  confirmar: { text: "Confirmar", within: ".lp-row-focus *" },
}, setStep(1, noPops));
await shot("agenda-s2", stageWindow, {
  linha: { text: "Bruno Alves", closest: ".lp-row-focus" },
  chegou: { text: "Cliente chegou", within: ".lp-row-focus *" },
}, setStep(2, noPops));
await shot("agenda-s3", stageWindow, {
  linha: { text: "Bruno Alves", closest: ".lp-row-focus" },
  contadores: { selector: ".gap-px" },
}, setStep(3, noPops));

// Mensagem pronta (passo 2) e modal de fechamento (passo 4), sozinhos.
await shot("mensagem", "#lp-story-stage > .lp-layer:nth-child(1) .lp-pop:nth-of-type(2) > div", {}, setStep(2, pops));
await shot("atendimento", "#lp-story-stage > .lp-layer:nth-child(2) .lp-window", {
  fechar: { text: "Fechar e receber" },
}, setStep(4, noPops));
await shot("modal", "#lp-story-stage > .lp-layer:nth-child(2) .lp-pop > div", {
  confirmar: { text: "Confirmar e fechar" },
}, setStep(4, pops));

// Caixa antes (passo 4, camada forçada visível) e depois (passo 5).
await shot("caixa-antes", "#lp-story-stage > .lp-layer:nth-child(3) .lp-window", {}, setStep(4, `${noPops} document.querySelector("#lp-story-stage > .lp-layer:nth-child(3)").style.opacity = "1";`));
await shot("caixa-depois", "#lp-story-stage > .lp-layer:nth-child(3) .lp-window", {
  saldo: { text: "Saldo esperado agora", closest: "div" },
  venda: { selector: ".lp-collapse .lp-row-focus" },
  comissao: { text: "Diego Ramos", closest: ".lp-collapse" },
}, setStep(5, `${noPops} document.querySelector("#lp-story-stage > .lp-layer:nth-child(3)").style.opacity = "";`));

// Gestão e o celular do profissional.
await shot("inicio", "#diferenciais .lp-prova:nth-child(4) .lp-window", {}, "void 0");
await shot("clientes", "#diferenciais .lp-prova:nth-child(2) .lp-window", {}, "void 0");
await shot("phone-profissional", "#celular .lp-phone", {}, "void 0");

writeFileSync(join(OUT, "positions.json"), JSON.stringify(positions, null, 2));
await browser.close();
console.log("ok", Object.keys(positions).length, "capturas em", OUT);
