import { metricDelta } from "@/components/ui/metric-card";

/**
 * Peças do Início. Cada uma responde uma pergunta e tem o peso visual que
 * essa pergunta merece — o problema do Dashboard anterior era dar a treze
 * informações exatamente a mesma caixa, o que faz todas pesarem igual e
 * nenhuma se destacar.
 */

// ---------------------------------------------------------------------------
// Ícones do KPI — linha simples, sem biblioteca nova
// ---------------------------------------------------------------------------
type IconProps = { className?: string };
const ICONE_PROPS = { viewBox: "0 0 20 20", fill: "none", "aria-hidden": true } as const;

export function IconeFaturamento({ className }: IconProps) {
  return (
    <svg {...ICONE_PROPS} className={className}>
      <path d="M4 15V9M10 15V5M16 15v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function IconeRecebido({ className }: IconProps) {
  return (
    <svg {...ICONE_PROPS} className={className}>
      <path d="M4.5 13.5 15 3M15 3H8M15 3v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconeTicket({ className }: IconProps) {
  return (
    <svg {...ICONE_PROPS} className={className}>
      <rect x="3" y="5.5" width="14" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8.5h14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
export function IconeAtendimentos({ className }: IconProps) {
  return (
    <svg {...ICONE_PROPS} className={className}>
      <circle cx="7.5" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 16c0-2.5 2-4 4.5-4S12 13.5 12 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 16c.1-2 1.4-3.3 3.3-3.3S19.9 14 19.9 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// KPI — leve, com um pequeno acento de cor, sem virar card
// ---------------------------------------------------------------------------
/**
 * Sem borda e sem fundo no container: o chip do ícone é o único elemento com
 * forma fechada, e existe para dar à cor de função um lugar pequeno e
 * controlado — não para embrulhar o número numa caixa. O valor continua
 * sendo o elemento de maior peso visual do bloco.
 */
export function Kpi({
  label,
  value,
  current,
  previous,
  context,
  index = 0,
  icon,
  tone = "accent",
  dominante = false,
}: {
  label: string;
  value: string;
  current: number;
  previous?: number | null;
  context?: string;
  index?: number;
  icon?: React.ReactNode;
  tone?: "accent" | "signal" | "neutral";
  /** Reservado para composições que precisem de um número dominante; o
   *  Início (R23.3) usa os quatro KPIs em peso igual, como a referência. */
  dominante?: boolean;
}) {
  const delta = previous !== undefined ? metricDelta(current, previous ?? null) : null;
  const subindo = delta?.startsWith("+");
  const chipClass =
    tone === "signal"
      ? "bg-signal text-signal-foreground"
      : tone === "neutral"
        ? "bg-surface-muted text-muted"
        : "bg-accent text-accent-foreground";

  return (
    <div className="min-w-0 animate-rise-in" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className={`size-7 rounded-full flex items-center justify-center shrink-0 ${chipClass}`}>
            {icon}
          </span>
        )}
        <p className="text-label uppercase text-muted truncate">{label}</p>
      </div>
      {/* Em 390px cabem dois KPIs por linha, e "R$ 3.030,00" em 32px não
          cabe na coluna — o valor era cortado no meio. O tamanho cede no
          celular e volta ao normal a partir de sm. */}
      <p
        className={
          dominante
            ? "text-[2.25rem] leading-none font-heading font-semibold tracking-[-0.015em] sm:text-display text-foreground mt-2.5 tabular-nums truncate"
            : "text-[1.5rem] leading-none font-semibold tracking-[-0.01em] sm:text-metric text-foreground mt-2.5 tabular-nums truncate"
        }
      >
        {value}
      </p>
      {delta ? (
        <p className={`text-caption mt-1.5 font-medium ${subindo ? "text-success-ink" : "text-danger-ink"}`}>
          {/* A seta carrega a direção junto com a cor: quem não distingue
              verde de vermelho continua lendo a tendência. */}
          <span aria-hidden="true">{subindo ? "▲" : "▼"}</span> {delta.replace("+", "")}
          <span className="text-muted font-normal"> vs. período anterior</span>
        </p>
      ) : (
        <p className="text-caption text-muted mt-1.5">{context ?? "sem base de comparação"}</p>
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
          tom === "atencao" ? "text-warning-ink" : "text-foreground"
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
            {/* Sem largura fixa: com w-16 o "R$ 1.350,00" era cortado. O valor
                manda no espaço que ocupa; quem cede é a barra, que é
                proporcional e continua legível mais curta. */}
            {item.secundario && (
              <span className="text-caption text-muted tabular-nums shrink-0 text-right whitespace-nowrap">
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
          {/* bg-chart-accent (R23.1): isto é contagem, não receita — o azul
              é quem representa informação/análise no sistema; o amarelo
              fica reservado para o que é dinheiro. */}
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-muted" role="img"
            aria-label={`${foco} ${focoLabel}, ${resto} ${restoLabel}`}>
            <div className="bg-chart-accent" style={{ width: `${pct}%` }} />
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
            <p className="text-metric font-heading text-foreground tabular-nums">{pct}%</p>
            <p className="text-caption text-muted">da capacidade</p>
          </div>
          {/* bg-chart-accent (R23.1): ocupação é leitura analítica da
              operação, não dinheiro — mesma regra de Proporcao. */}
          <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mt-3">
            <div className="h-full rounded-full bg-chart-accent" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="text-caption text-muted mt-2">{detalhe}</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Par — duas leituras relacionadas, uma superfície só (R23.1)
// ---------------------------------------------------------------------------
/**
 * Antes, cada dupla de blocos (Ocupação+Clientes, Serviços+Equipe,
 * Atenção+Financeiro) eram DUAS caixas com gap entre si — visualmente seis
 * cards de peso idêntico, a "parede de cards" que a direção pediu para
 * eliminar. Aqui as duas metades dividem uma única superfície elevada,
 * separadas por um filete — a diferença entre duas perguntas relacionadas e
 * duas telas empilhadas.
 */
export function Par({
  esquerda,
  direita,
}: {
  esquerda: React.ReactNode;
  direita: React.ReactNode;
}) {
  // R23.3: sem borda nem sombra — "evitar bordas em excesso, sombras
  // pesadas" é literal no brief. O tom de superfície e o filete interno (só
  // entre as duas metades, nunca ao redor) já separam o bloco do fundo.
  return (
    <section
      className="rounded-lg grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border"
      style={{ backgroundColor: "var(--surface-elevated)" }}
    >
      <div className="p-5">{esquerda}</div>
      <div className="p-5">{direita}</div>
    </section>
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
  // R23.3: era material-elevated (borda + sombra); o brief pede
  // explicitamente menos borda e menos sombra — o tom de superfície sozinho
  // já basta para separar a seção do fundo escuro da página.
  return (
    <section className={`rounded-lg p-5 ${className}`} style={{ backgroundColor: "var(--surface-elevated)" }}>
      {titulo && <p className="text-label uppercase text-muted mb-3">{titulo}</p>}
      {children}
    </section>
  );
}
