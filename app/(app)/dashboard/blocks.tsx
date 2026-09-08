import { metricDelta } from "@/components/ui/metric-card";

/**
 * Peças do Início. Cada uma responde uma pergunta e tem o peso visual que
 * essa pergunta merece — o problema do Dashboard anterior era dar a treze
 * informações exatamente a mesma caixa, o que faz todas pesarem igual e
 * nenhuma se destacar.
 */

// ---------------------------------------------------------------------------
// KPI principal — compacto, sem caixa
// ---------------------------------------------------------------------------
/**
 * Sem borda e sem fundo: quatro números lado a lado separados por espaço já
 * se leem como um grupo. A caixa em volta de cada um era o que produzia a
 * "parede de cards".
 */
export function Kpi({
  label,
  value,
  current,
  previous,
  context,
}: {
  label: string;
  value: string;
  current: number;
  previous?: number | null;
  context?: string;
}) {
  const delta = previous !== undefined ? metricDelta(current, previous ?? null) : null;
  const subindo = delta?.startsWith("+");

  return (
    <div className="min-w-0">
      <p className="text-label uppercase text-muted">{label}</p>
      {/* Em 390px cabem dois KPIs por linha, e "R$ 3.030,00" em 32px não
          cabe na coluna — o valor era cortado no meio. O tamanho cede no
          celular e volta ao normal a partir de sm. */}
      <p className="text-[1.5rem] leading-none font-semibold tracking-[-0.01em] sm:text-metric text-foreground mt-1.5 tabular-nums truncate">
        {value}
      </p>
      {delta ? (
        <p className={`text-caption mt-1 font-medium ${subindo ? "text-success" : "text-danger"}`}>
          {/* A seta carrega a direção junto com a cor: quem não distingue
              verde de vermelho continua lendo a tendência. */}
          <span aria-hidden="true">{subindo ? "↑" : "↓"}</span> {delta.replace("+", "")}
          <span className="text-muted font-normal"> vs. anterior</span>
        </p>
      ) : (
        <p className="text-caption text-muted mt-1">{context ?? "sem base de comparação"}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Métrica secundária — uma linha, não um card
// ---------------------------------------------------------------------------
export function LinhaMetrica({
  label,
  value,
  tom = "neutro",
  detalhe,
}: {
  label: string;
  value: string;
  tom?: "neutro" | "atencao";
  detalhe?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-body-sm text-foreground truncate">{label}</p>
        {detalhe && <p className="text-caption text-muted mt-0.5 truncate">{detalhe}</p>}
      </div>
      <p
        className={`text-body-sm font-medium tabular-nums shrink-0 ${
          tom === "atencao" ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranking com barra proporcional
// ---------------------------------------------------------------------------
/**
 * Uma cor só para todas as barras. Escurecer a barra maior seria codificar o
 * tamanho duas vezes — o comprimento já diz isso — e gastar o único canal
 * livre com informação repetida.
 */
export function Ranking({
  itens,
  vazio,
}: {
  itens: { nome: string; valor: number; rotulo: string; secundario?: string }[];
  vazio: string;
}) {
  if (itens.length === 0) {
    return <p className="text-body-sm text-muted py-2">{vazio}</p>;
  }
  const max = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <ul className="space-y-3">
      {itens.map((item) => (
        <li key={item.nome}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <p className="text-body-sm text-foreground truncate">{item.nome}</p>
            <p className="text-body-sm text-foreground tabular-nums shrink-0">{item.rotulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-chart"
                style={{ width: `${Math.max(2, (item.valor / max) * 100)}%` }}
              />
            </div>
            {item.secundario && (
              <span className="text-caption text-muted tabular-nums shrink-0 w-16 text-right">
                {item.secundario}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Proporção — parte de um todo, em uma barra só
// ---------------------------------------------------------------------------
/**
 * Duas categorias não pedem duas cores: o sinal marca a parte em foco e o
 * resto fica neutro, com os dois lados rotulados. Isso evita um par
 * categórico que teria de passar por validação de daltonismo para dizer algo
 * que dois rótulos já dizem.
 */
export function Proporcao({
  titulo,
  foco,
  focoLabel,
  resto,
  restoLabel,
}: {
  titulo: string;
  foco: number;
  focoLabel: string;
  resto: number;
  restoLabel: string;
}) {
  const total = foco + resto;
  const pct = total > 0 ? Math.round((foco / total) * 100) : 0;

  return (
    <div>
      <p className="text-label uppercase text-muted mb-3">{titulo}</p>
      {total === 0 ? (
        <p className="text-body-sm text-muted">Nenhum atendimento concluído no período.</p>
      ) : (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-muted" role="img"
            aria-label={`${foco} ${focoLabel}, ${resto} ${restoLabel}`}>
            <div className="bg-chart" style={{ width: `${pct}%` }} />
            {/* 2px de superfície separam as duas partes, em vez de um contorno. */}
            <div className="w-0.5 bg-surface" />
          </div>
          <div className="flex items-baseline justify-between gap-4 mt-2.5">
            <p className="text-body-sm text-foreground">
              <span className="tabular-nums font-medium">{foco}</span>{" "}
              <span className="text-muted">{focoLabel}</span>
            </p>
            <p className="text-body-sm text-foreground">
              <span className="tabular-nums font-medium">{resto}</span>{" "}
              <span className="text-muted">{restoLabel}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ocupação — um medidor, não um card
// ---------------------------------------------------------------------------
export function Ocupacao({
  pct,
  detalhe,
}: {
  pct: number | null;
  detalhe: string;
}) {
  return (
    <div>
      <p className="text-label uppercase text-muted mb-3">Ocupação da agenda</p>
      {pct === null ? (
        <p className="text-body-sm text-muted">
          Configure a jornada da equipe para acompanhar ocupação.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-metric text-foreground tabular-nums">{pct}%</p>
            <p className="text-caption text-muted">da capacidade</p>
          </div>
          <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mt-3">
            <div className="h-full rounded-full bg-chart" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="text-caption text-muted mt-2">{detalhe}</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bloco — moldura comum das seções secundárias
// ---------------------------------------------------------------------------
export function Bloco({
  titulo,
  children,
  className = "",
}: {
  titulo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      {titulo && <p className="text-label uppercase text-muted mb-3">{titulo}</p>}
      {children}
    </section>
  );
}
