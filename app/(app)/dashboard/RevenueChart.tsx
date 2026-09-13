"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";

export type SeriesPoint = {
  dia: string;
  faturamento: number;
  atendimentos: number;
  clientes_novos: number;
};

type Serie = "faturamento" | "atendimentos";

/**
 * Catmull-Rom → Bézier: a curva passa por cada ponto real (nada é
 * aproximado), só o traço entre eles vira suave em vez de reto. `tensao`
 * baixa (1/6 é o valor clássico) evita "barrigas" exageradas entre pontos
 * distantes — a curva flui sem desenhar montanhas que os dados não têm.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

  const tensao = 1 / 6;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * tensao;
    const c1y = p1.y + (p2.y - p0.y) * tensao;
    const c2x = p2.x - (p3.x - p1.x) * tensao;
    const c2y = p2.y - (p3.y - p1.y) * tensao;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Gráfico principal do Início.
 *
 * SVG à mão em vez de biblioteca, por duas razões: nenhuma dependência nova
 * para uma única visualização, e controle total sobre a linguagem visual —
 * traço fino, área quase imperceptível, grade recessiva, guia pontilhada só
 * no hover. Uma biblioteca genérica entrega "gráfico de Excel" e só sai disso
 * com mais configuração do que o desenho inteiro.
 *
 * Uma série por vez, de propósito. Faturamento (R$) e atendimentos (contagem)
 * têm escalas diferentes; sobrepor as duas num eixo só é o erro clássico de
 * dashboard — a correlação passa a vir do alinhamento arbitrário das escalas,
 * não dos dados. Por isso é um seletor, não duas linhas.
 */
export function RevenueChart({ data }: { data: SeriesPoint[] }) {
  const [serie, setSerie] = useState<Serie>("faturamento");
  const [ativo, setAtivo] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /*
   * A largura é MEDIDA, não deixada para o viewBox resolver. Com um viewBox
   * fixo e `preserveAspectRatio` no padrão, o desenho é encaixado inteiro na
   * altura disponível e sobra faixa vazia dos dois lados — foi exatamente o
   * que aconteceu: o gráfico ocupava 720 de 1080px de card. `none` resolveria
   * a largura, mas esticaria círculos e texto junto.
   *
   * Medindo, cada coordenada já sai em pixel real: nada é escalado, então
   * traço, ponto e rótulo saem com a espessura e o tamanho pedidos.
   */
  const [medido, setMedido] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setMedido(Math.max(280, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = medido;
  const H = 260;
  const PAD = { top: 16, right: 12, bottom: 26, left: 12 };

  const valores = useMemo(
    () => data.map((d) => (serie === "faturamento" ? Number(d.faturamento) : Number(d.atendimentos))),
    [data, serie]
  );

  const max = Math.max(...valores, 0);
  // Um teto ligeiramente acima do pico dá respiro e evita a linha encostando
  // no topo do quadro.
  const teto = max === 0 ? 1 : max * 1.15;

  const x = (i: number) =>
    data.length <= 1
      ? PAD.left + (W - PAD.left - PAD.right) / 2
      : PAD.left + (i * (W - PAD.left - PAD.right)) / (data.length - 1);
  const y = (v: number) => PAD.top + (1 - v / teto) * (H - PAD.top - PAD.bottom);

  /*
   * R23.3: a linha reta (M/L) lia como planilha, não como identidade
   * CORTEX.OS — a direção pediu explicitamente uma curva "fluida, orgânica,
   * contínua". Catmull-Rom→Bézier passa por TODOS os pontos reais (não
   * aproxima, não inventa dado) e só suaviza como o traço chega e sai de
   * cada um — os valores em `valores` são exatamente os mesmos de antes.
   */
  const pontos = valores.map((v, i) => ({ x: x(i), y: y(v) }));
  const linha = pontos.length < 2 ? "" : smoothPath(pontos);
  const area =
    pontos.length < 2
      ? ""
      : `${linha} L ${pontos[pontos.length - 1].x.toFixed(1)} ${H - PAD.bottom} L ${pontos[0].x.toFixed(1)} ${H - PAD.bottom} Z`;

  const picoIdx = valores.indexOf(max);
  const ultimoIdx = valores.length - 1;
  const destaque = ativo ?? ultimoIdx;
  const ponto = data[destaque];
  const valorDestaque = valores[destaque] ?? 0;

  const rotulo = (v: number) =>
    serie === "faturamento" ? formatCurrency(v) : `${v} atendimento${v === 1 ? "" : "s"}`;

  const dataCurta = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  /**
   * Um caminho só para mouse e dedo: a posição horizontal vira índice.
   *
   * Os handlers de toque são explícitos em vez de depender de o navegador
   * sintetizar eventos de ponteiro a partir do toque — isso varia por
   * plataforma, e o gráfico precisa responder ao dedo com a mesma
   * confiabilidade com que responde ao cursor.
   */
  function apontar(clientX: number) {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const util = W - PAD.left - PAD.right;
    const frac = Math.min(1, Math.max(0, (clientX - rect.left - PAD.left) / util));
    setAtivo(Math.round(frac * (data.length - 1)));
  }

  const aoMover = (event: React.PointerEvent<SVGSVGElement>) => apontar(event.clientX);
  const aoTocar = (event: React.TouchEvent<SVGSVGElement>) => {
    const toque = event.touches[0];
    if (toque) apontar(toque.clientX);
  };

  // Quatro linhas de grade, sempre sólidas e a um passo da superfície:
  // pontilhado em grade lê como "projeção" ou "limite" e só faz ruído.
  const grades = [0, 0.25, 0.5, 0.75, 1];

  return (
    // R23.7: nem "sem borda com fundo" — sem NENHUMA superfície. A pergunta
    // da rodada era "essa informação precisa de card?", e um gráfico com
    // título e eixos próprios não precisa de uma caixa em volta para se
    // separar da página — uma régua superior fina já faz esse trabalho, e o
    // resultado é a curva respirando direto no campo da tela, não presa
    // dentro de outro retângulo.
    <section className="pt-6 border-t border-border">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-section-title text-foreground">
            {serie === "faturamento" ? "Faturamento por dia" : "Atendimentos por dia"}
          </h2>
          <p className="text-caption text-muted mt-1">
            {ponto ? `${dataCurta(ponto.dia)} · ${rotulo(valorDestaque)}` : "Sem movimento no período"}
          </p>
        </div>

        <div
          className="inline-flex shrink-0 rounded-full border border-border p-0.5 text-caption"
          role="radiogroup"
          aria-label="Série do gráfico"
        >
          {(["faturamento", "atendimentos"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={serie === s}
              onClick={() => setSerie(s)}
              className={
                "px-3 py-1 rounded-full transition-colors duration-fast ease-standard " +
                (serie === s ? "bg-signal text-signal-foreground" : "text-muted hover:text-foreground")
              }
            >
              {s === "faturamento" ? "Faturamento" : "Atendimentos"}
            </button>
          ))}
        </div>
      </header>

      <div ref={wrapRef} className="relative">
        <svg
          ref={svgRef}
          width={W}
          height={H}
          className="block touch-none select-none"
          role="img"
          aria-label={`${serie === "faturamento" ? "Faturamento" : "Atendimentos"} por dia no período`}
          onPointerMove={aoMover}
          onPointerDown={aoMover}
          onTouchStart={aoTocar}
          onTouchMove={aoTocar}
          // Só o mouse limpa a seleção ao sair. No toque, tirar o dedo não
          // significa "esqueça o que eu escolhi" — o valor lido continua na
          // tela até o próximo toque.
          onMouseLeave={() => setAtivo(null)}
        >
          <defs>
            <linearGradient id="fade-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
            </linearGradient>
            {/* Glow discreto (R23.3): um blur pequeno atrás do próprio traço,
                não um efeito neon — a curva ganha uma respiração de luz sem
                parecer letreiro. */}
            <filter id="linha-glow" x="-20%" y="-60%" width="140%" height="220%">
              <feGaussianBlur stdDeviation="2.5" result="desfoque" />
              <feMerge>
                <feMergeNode in="desfoque" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grade quase imperceptível: um degrau de opacidade abaixo da
              versão anterior — ela orienta a leitura sem competir com a
              curva, que é a única coisa que precisa de atenção aqui. */}
          {grades.map((g) => {
            const gy = PAD.top + g * (H - PAD.top - PAD.bottom);
            return (
              <line
                key={g}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={gy}
                y2={gy}
                stroke="var(--border)"
                strokeOpacity="0.5"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {valores.length > 1 && <path d={area} fill="url(#fade-area)" />}
          {valores.length > 1 && (
            <path
              d={linha}
              fill="none"
              stroke="var(--chart)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#linha-glow)"
            />
          )}

          {/* Guia do ponto ativo. Pontilhada aqui é intencional: distingue o
              cursor da grade, que é sólida. */}
          {ponto && (
            <>
              <line
                x1={x(destaque)}
                x2={x(destaque)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--border-strong)"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={x(destaque)}
                cy={y(valorDestaque)}
                r="4.5"
                fill="var(--chart)"
                stroke="var(--surface)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}

          {/* Rótulo direto só no pico — um número por ponto vira ruído. */}
          {max > 0 && picoIdx !== destaque && (
            <text
              x={Math.min(Math.max(x(picoIdx), 40), W - 40)}
              y={Math.max(y(max) - 10, 12)}
              textAnchor="middle"
              className="fill-muted"
              style={{ fontSize: 11 }}
            >
              {serie === "faturamento" ? formatCurrency(max) : max}
            </text>
          )}

          {data.length > 0 && (
            <>
              <text x={PAD.left} y={H - 6} className="fill-muted" style={{ fontSize: 11 }}>
                {dataCurta(data[0].dia)}
              </text>
              <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>
                {dataCurta(data[data.length - 1].dia)}
              </text>
            </>
          )}
        </svg>
      </div>
    </section>
  );
}
