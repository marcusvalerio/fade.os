/**
 * Sparkline de stat tile: uma série só, traço de 2px no tom neutro (o
 * histórico é contexto) e o último ponto no acento (é o agora). Sem eixo,
 * sem legenda — o rótulo do tile nomeia a série. Cada ponto tem uma área de
 * toque maior que o traço, com dica nativa (rótulo + valor).
 *
 * Sem dado suficiente (menos de 2 pontos com valor), não desenha nada: uma
 * linha reta no zero não conta tendência nenhuma.
 */
export function Sparkline({
  valores,
  rotulos,
  formatar,
  descricao,
  largura = 120,
  altura = 32,
  className,
}: {
  valores: (number | null)[];
  rotulos: string[];
  formatar: (v: number) => string;
  /** Nome acessível: o que a linha mostra e o intervalo. */
  descricao: string;
  largura?: number;
  altura?: number;
  className?: string;
}) {
  const comValor = valores.filter((v): v is number => v !== null);
  if (comValor.filter((v) => v > 0).length < 2) return null;

  const max = Math.max(...comValor, 0);
  const min = Math.min(...comValor, 0);
  const faixa = max - min || 1;
  const pad = 3;
  const passo = (largura - pad * 2) / Math.max(valores.length - 1, 1);
  const y = (v: number) => pad + (altura - pad * 2) * (1 - (v - min) / faixa);
  const pontos = valores.map((v, i) => ({ x: pad + i * passo, y: v === null ? null : y(v), v, i }));

  // Semanas sem valor (ticket sem atendimento) quebram a linha em vez de
  // fingir zero.
  const trechos: string[] = [];
  let atual: string[] = [];
  for (const p of pontos) {
    if (p.y === null) {
      if (atual.length) trechos.push(atual.join(" "));
      atual = [];
    } else atual.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  if (atual.length) trechos.push(atual.join(" "));

  const ultimo = pontos[pontos.length - 1];
  const ultimoValor = valores[valores.length - 1];

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura}
      height={altura}
      role="img"
      aria-label={`${descricao}. Agora: ${ultimoValor === null ? "sem dado" : formatar(ultimoValor)}.`}
      className={className}
      preserveAspectRatio="none"
    >
      {trechos.map((t, i) => (
        <polyline
          key={i}
          points={t}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="text-border-strong"
        />
      ))}
      {ultimo.y !== null && <circle cx={ultimo.x} cy={ultimo.y} r={3} fill="var(--chart-accent)" />}
      {pontos.map((p) => (
        <rect key={p.i} x={p.x - passo / 2} y={0} width={passo} height={altura} fill="transparent">
          <title>{`${rotulos[p.i]}: ${p.v === null ? "sem dado" : formatar(p.v)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
