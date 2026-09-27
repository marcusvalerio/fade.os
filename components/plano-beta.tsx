import { formatCurrency } from "@/lib/format";
import { PRECO_REFERENCIA_MENSAL, PLANOS_DISPONIVEIS_A_PARTIR_DE, O_QUE_O_PLANO_INCLUI } from "@/lib/beta";
import { cn } from "@/lib/cn";

/**
 * O plano do CORTEX durante o beta: produto comercial, valor de referência
 * riscado, estado BETA. Não é oferta nem checkout — não há o que contratar
 * ainda, e a tela diz isso.
 */
export function PlanoBeta({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <div className={cn("painel overflow-hidden", className)}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-subtitle text-caption text-muted">Plano</p>
            <p className="font-heading text-section-title text-foreground mt-0.5">CORTEX completo</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xs bg-foreground text-background px-2 py-1 font-subtitle text-micro uppercase tracking-label">
            <span aria-hidden className="size-1.5 bg-brand-blue" />
            Beta
          </span>
        </div>

        <p className="mt-4 flex items-baseline gap-2">
          <s
            className="numero text-metric-sm text-muted decoration-1"
            aria-label={`Valor de referência: ${formatCurrency(PRECO_REFERENCIA_MENSAL)} por mês`}
          >
            {formatCurrency(PRECO_REFERENCIA_MENSAL).replace(",00", "")}
          </s>
          <span className="text-caption text-muted">/mês · referência</span>
        </p>
        <p className="text-body-sm text-foreground mt-1">Sem cobrança enquanto durar o beta.</p>

        {!compacto && (
          <ul className="mt-5 space-y-2 border-t border-border pt-4">
            {O_QUE_O_PLANO_INCLUI.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-body-sm text-foreground">
                <span aria-hidden className="mt-2 size-1 shrink-0 bg-brand-blue" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="border-t border-border bg-surface-muted/50 px-5 sm:px-6 py-3 text-caption text-muted">
        Planos disponíveis a partir de {PLANOS_DISPONIVEIS_A_PARTIR_DE}. Nada é contratado nem cobrado agora.
      </p>
    </div>
  );
}
