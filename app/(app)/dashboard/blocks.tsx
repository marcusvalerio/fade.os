import { metricDelta } from "@/components/ui/metric-card";

/**
 * Peças do Início (R23.7 — reinterpretação editorial).
 *
 * A pergunta que rege este arquivo mudou: não é mais "que caixa essa
 * informação mora?", é "essa informação precisa de uma superfície?". A
 * resposta, na maioria dos casos, passou a ser não — tipografia, divisores e
 * espaço fazem o trabalho que bordas e fundos faziam antes. Onde uma
 * superfície ainda existe (o campo "Atenção", o canvas do gráfico), ela tem
 * uma razão específica, não é o padrão default de "toda informação vira
 * card".
 */

// ---------------------------------------------------------------------------
// KPI — tipografia como composição, não ícone-em-chip
// ---------------------------------------------------------------------------
/**
 * Sem ícone, sem chip de cor: o brief foi explícito — "não use ícones
 * desnecessários" — e um círculo colorido ao lado de cada número é
 * exatamente a textura de dashboard genérico que esta rodada existe para
 * remover. O que separa o Faturamento dos outros três não é um selo, é
 * ESCALA: `dominante` não é "mais um degrau maior", é uma voz editorial de
 * verdade — Supreme em tamanho de manchete.
 */
export function Kpi({
  label,
  value,
  current,
  previous,
  context,
  index = 0,
  dominante = false,
}: {
  label: string;
  value: string;
  current: number;
  previous?: number | null;
  context?: string;
  index?: number;
  dominante?: boolean;
}) {
  const delta = previous !== undefined ? metricDelta(current, previous ?? null) : null;
  const subindo = delta?.startsWith("+");

  return (
    <div className="min-w-0 animate-rise-in" style={{ animationDelay: `${index * 45}ms` }}>
      <p className="text-label uppercase text-muted truncate">{label}</p>
      <p
        className={
          dominante
            ? "font-heading font-semibold text-foreground tabular-nums leading-[0.95] tracking-[-0.02em] text-[2.75rem] sm:text-[4rem] mt-2 truncate"
            : "text-[1.375rem] leading-none font-semibold tracking-[-0.01em] sm:text-metric text-foreground mt-2.5 tabular-nums truncate"
        }
      >
        {value}
      </p>
      {delta ? (
        <p className={`text-caption mt-2 font-medium ${subindo ? "text-success-ink" : "text-danger-ink"}`}>
          <span aria-hidden="true">{subindo ? "▲" : "▼"}</span> {delta.replace("+", "")}
          <span className="text-muted font-normal"> vs. período anterior</span>
        </p>
      ) : (
        <p className="text-caption text-muted mt-2">{context ?? "sem base de comparação"}</p>
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
          {/* bg-chart-accent: isto é contagem, não receita — o azul é quem
              representa informação/análise no sistema; o amarelo fica
              reservado para o que é dinheiro. */}
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
          {/* bg-chart-accent: ocupação é leitura analítica da operação, não
              dinheiro — mesma regra de Proporcao. */}
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
// Par — duas leituras relacionadas, um único divisor (R23.7)
// ---------------------------------------------------------------------------
/**
 * Antes disto era uma superfície elevada só para as duas metades morarem
 * dentro — mais uma caixa. A pergunta da rodada ("essa informação precisa de
 * superfície?") respondeu não: o que relaciona Ocupação a Clientes, ou
 * Serviços a Equipe, é estarem lado a lado, e um divisor faz isso sozinho.
 * Sem fundo, sem raio, sem sombra — só espaço e um filete.
 */
export function Par({
  esquerda,
  direita,
}: {
  esquerda: React.ReactNode;
  direita: React.ReactNode;
}) {
  return (
    <section className="grid sm:grid-cols-2 gap-6 sm:gap-10 sm:divide-x divide-border">
      <div className="sm:pr-10">{esquerda}</div>
      <div className="sm:pl-10">{direita}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Campo — uma seção aberta com rótulo, não um card (R23.7)
// ---------------------------------------------------------------------------
/**
 * Substitui o antigo `Bloco` (superfície elevada com padding) para o caso
 * comum: uma seção com título e conteúdo que não precisa de um contorno
 * fechado. Só um rótulo editorial e uma régua superior fina — o produto
 * inteiro é uma folha contínua, não uma pilha de caixas separadas.
 */
export function Campo({
  titulo,
  children,
  className = "",
}: {
  titulo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`pt-6 border-t border-border ${className}`}>
      {titulo && <p className="text-label uppercase text-muted mb-3">{titulo}</p>}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bloco — moldura fechada, reservada para quando ela tem um motivo real
// ---------------------------------------------------------------------------
/**
 * "Atenção" é o único lugar do Início que ainda ganha uma superfície de
 * verdade — porque ela precisa PARECER um momento que pede atenção, não só
 * mais uma seção de leitura. O tom de aviso entra pela borda esquerda, não
 * pelo fundo inteiro (fundo colorido em bloco grande é o que transforma a
 * interface em semáforo).
 */
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
    <section className={`rounded-md p-5 ${className}`} style={{ backgroundColor: "var(--surface-elevated)" }}>
      {titulo && <p className="text-label uppercase text-muted mb-3">{titulo}</p>}
      {children}
    </section>
  );
}
