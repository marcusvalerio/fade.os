import { cn } from "@/lib/cn";

/**
 * A marca: CORTEX ■ OS.
 *
 * A composição é panorâmica de propósito. A Panchang tem contadores largos e
 * ombros retos, e é isso que a torna reconhecível — condensá-la ou esticá-la
 * para "caber" destruiria justamente a característica pela qual ela foi
 * escolhida. Então nada de `transform: scaleX`, nada de `font-stretch`: a
 * largura vem do próprio desenho da fonte, e o único ajuste é o tracking, que
 * abre em tamanhos grandes (onde a fonte já é densa) e fecha nos pequenos.
 *
 * O QUADRADO AZUL é o símbolo oficial da marca — o elemento que separa CORTEX
 * de OS e o único que ganha cor. Ele não é mais o caractere "." da fonte: é um
 * elemento próprio (`.marca-quadrado`, em globals.css) com a geometria exata do
 * ponto da Panchang, medida no arquivo da fonte — lado de 0,20em apoiado na
 * linha de base, 0,04em de respiro de cada lado. Ser elemento, e não glifo, é
 * o que garante que ele seja sempre o azul da marca (o glifo herdava
 * `--signal`, que muda com o tema e sumia no fundo escuro do shell) e que ele
 * possa se mover sozinho — é o quadrado que conduz a entrada no produto
 * (components/entrada-cortex.tsx) e que vira o símbolo quando a marca precisa
 * caber em pouco espaço (<CortexMark />). Nunca um círculo.
 */
type Tamanho = "sm" | "md" | "lg" | "xl";

const TAMANHO: Record<Tamanho, string> = {
  // Tracking negativo cresce com o corpo: em 12px a Panchang precisa de ar,
  // em 56px precisa do contrário.
  sm: "text-[0.8125rem] tracking-[0.01em]",
  md: "text-[1.0625rem] tracking-[-0.005em]",
  lg: "text-[2rem] tracking-[-0.02em]",
  xl: "text-[clamp(2.75rem,11vw,4.5rem)] tracking-[-0.03em]",
};

export function Wordmark({
  nome = "CORTEX",
  sufixo = "OS",
  tamanho = "md",
  /** O quadrado herda a cor do texto quando a marca é assinatura e não precisa gritar. */
  pontoNeutro = false,
  className,
}: {
  nome?: string;
  sufixo?: string;
  tamanho?: Tamanho;
  pontoNeutro?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("font-brand inline-flex items-baseline leading-none whitespace-nowrap", TAMANHO[tamanho], className)}
      // Uma palavra só para leitor de tela: "CORTEX ponto O S" é ruído.
      role="img"
      aria-label={`${nome}.${sufixo}`}
    >
      <span aria-hidden="true">{nome}</span>
      <span aria-hidden="true" className="marca-quadrado" data-neutro={pontoNeutro ? "" : undefined} />
      <span aria-hidden="true">{sufixo}</span>
    </span>
  );
}

/**
 * A assinatura do produto sob o nome da barbearia.
 *
 * O usuário abriu o sistema para operar a NORTE 21, não para admirar a marca
 * de quem fez o software. Então ela aparece pequena, em tinta apagada, e o
 * "by" fica ainda menor que o nome — hierarquia dentro da própria assinatura.
 */
export function AssinaturaProduto({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-[0.625rem] tracking-[0.08em] uppercase opacity-70">by</span>
      <Wordmark tamanho="sm" pontoNeutro />
    </span>
  );
}
