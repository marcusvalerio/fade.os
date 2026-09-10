import { cn } from "@/lib/cn";

/**
 * A marca.
 *
 * A composição é panorâmica de propósito. A Panchang tem contadores largos e
 * ombros retos, e é isso que a torna reconhecível — condensá-la ou esticá-la
 * para "caber" destruiria justamente a característica pela qual ela foi
 * escolhida. Então nada de `transform: scaleX`, nada de `font-stretch`: a
 * largura vem do próprio desenho da fonte, e o único ajuste é o tracking, que
 * abre em tamanhos grandes (onde a fonte já é densa) e fecha nos pequenos.
 *
 * O ponto entre nome e sufixo é o único elemento que ganha cor. Ele é o que
 * transforma duas palavras num nome de sistema, e é onde a marca guarda o
 * sinal amarelo — em espaço pequeno é a última coisa que ainda se lê como
 * identidade.
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
  /** O ponto some quando a marca é assinatura e não precisa gritar. */
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
      className={cn("font-brand inline-flex items-baseline leading-none", TAMANHO[tamanho], className)}
      // Uma palavra só para leitor de tela: "CORTEX ponto O S" é ruído.
      aria-label={`${nome}.${sufixo}`}
    >
      <span aria-hidden="true">{nome}</span>
      <span aria-hidden="true" className={pontoNeutro ? undefined : "text-signal"}>
        .
      </span>
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
    <span className={cn("inline-flex items-baseline gap-1 text-muted", className)}>
      <span className="text-[0.625rem] tracking-[0.08em] uppercase opacity-70">by</span>
      <Wordmark tamanho="sm" pontoNeutro />
    </span>
  );
}
