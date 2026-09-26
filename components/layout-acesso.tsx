import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * A moldura das telas de acesso — login, pedido de acesso ao Beta, esqueci a
 * senha, redefinir senha, primeira senha. Todas são a porta do mesmo produto,
 * então todas têm a mesma porta: o painel da marca (o mesmo Creeping Depth do
 * shell autenticado e das seções escuras da landing, com a frase do Hero) e a
 * tarefa na superfície clara de trabalho. No celular o painel vira uma faixa
 * curta no topo — quem abre estas telas está ali para fazer uma coisa só.
 *
 * Sem luz radial, sem forma decorativa: a tipografia e o quadrado azul fazem
 * o trabalho.
 */
export function LayoutAcesso({
  children,
  frase = "Cada corte move a barbearia inteira.",
  apoio = "Agenda, atendimento, caixa, comissão, estoque e clientes no mesmo sistema. Um fechamento, e tudo se atualiza junto.",
}: {
  children: React.ReactNode;
  frase?: string;
  apoio?: string;
}) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-background">
      <div className="relative bg-[var(--neutral-ink)] text-[var(--neutral-warm-white)] px-6 py-7 sm:px-10 sm:py-9 lg:px-14 lg:py-12 lg:min-h-dvh lg:flex lg:flex-col">
        <Link href="/" aria-label="CORTEX.OS — página inicial" className="inline-flex w-fit">
          <Wordmark tamanho="md" />
        </Link>

        <div className="mt-8 lg:mt-0 lg:flex-1 lg:flex lg:flex-col lg:justify-center">
          <p className="font-heading font-semibold text-[clamp(1.75rem,1rem+3.2vw,3.5rem)] leading-[0.98] tracking-[-0.045em] max-w-[13ch] text-balance">
            {frase}
          </p>
          <p className="hidden sm:block mt-5 max-w-[34ch] text-body-sm" style={{ color: "rgb(232 230 221 / 70%)" }}>
            {apoio}
          </p>
        </div>

        <p className="hidden lg:flex items-center gap-2.5 text-caption" style={{ color: "rgb(232 230 221 / 60%)" }}>
          <span aria-hidden className="size-1.5 bg-[var(--brand-blue)]" />
          Sistema operacional para barbearias
        </p>
      </div>

      <div className="flex items-start lg:items-center justify-center px-6 pt-10 pb-14 sm:pt-14 lg:py-16">
        <div className="w-full max-w-[23rem]">{children}</div>
      </div>
    </main>
  );
}
