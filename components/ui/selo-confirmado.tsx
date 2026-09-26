import { cn } from "@/lib/cn";

/**
 * O selo de "pronto" do CORTEX: o quadrado azul da marca com um check.
 *
 * Aparece no momento em que algo se conclui para quem está do outro lado do
 * sistema (o cliente que acabou de marcar pela página da barbearia). O check
 * se desenha uma vez, na duração "momento" — é a única animação da tela e ela
 * diz exatamente o que aconteceu. Sem movimento para quem pediu menos
 * movimento: o check já nasce desenhado.
 *
 * Quadrado, não círculo: o círculo saiu da identidade.
 *
 * `tom="tinta"` inverte (quadrado ink, check azul) para quando o selo se
 * apoia numa superfície que já é o azul da marca — a conclusão da venda no
 * PDV — onde o quadrado azul desapareceria.
 */
export function SeloConfirmado({ className, tom = "marca" }: { className?: string; tom?: "marca" | "tinta" }) {
  return (
    <span aria-hidden="true" className={cn("selo-confirmado", className)} data-tom={tom === "tinta" ? "tinta" : undefined}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
        <path d="M5.5 12.5 10 17 18.5 7.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square" />
      </svg>
    </span>
  );
}
