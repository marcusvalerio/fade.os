import { cn } from "@/lib/cn";
import { CortexMark } from "@/components/ui/cortex-mark";
import {
  IconeInicio,
  IconeAgenda,
  IconeClientes,
  IconeNegocio,
  IconeCatalogo,
  IconeEquipe,
  IconeFinanceiro,
  IconeConfiguracoes,
} from "@/components/ui/nav-icons";

/**
 * Molduras do produto na landing.
 *
 * `ProductWindow` não é uma "janela de sistema operacional com três
 * bolinhas": é o chrome real do CORTEX — o trilho recolhido da sidebar
 * (components/app-nav.tsx, estado `collapsed`, mesmos ícones e o item ativo
 * em Kahu Blue) e o header escuro da barbearia — com o conteúdo no
 * registro claro, como a barbearia vê o produto.
 *
 * Tudo aqui é ilustração: `inert` tira a moldura da ordem de tabulação e da
 * árvore de acessibilidade (nada nela é clicável de verdade), e a
 * `figcaption` descreve a tela para leitor de tela.
 */

export type AreaProduto = "inicio" | "agenda" | "clientes" | "negocio" | "catalogo" | "equipe" | "financeiro";

const TRILHO: { area: AreaProduto | "config"; Icone: (p: { className?: string }) => React.ReactElement }[] = [
  { area: "inicio", Icone: IconeInicio },
  { area: "agenda", Icone: IconeAgenda },
  { area: "clientes", Icone: IconeClientes },
  { area: "negocio", Icone: IconeNegocio },
  { area: "catalogo", Icone: IconeCatalogo },
  { area: "equipe", Icone: IconeEquipe },
  { area: "financeiro", Icone: IconeFinanceiro },
  { area: "config", Icone: IconeConfiguracoes },
];

export function ProductWindow({
  area,
  descricao,
  children,
  className,
  corpoClassName,
}: {
  area: AreaProduto;
  /** O que a tela mostra, em uma frase — lida só por leitor de tela. */
  descricao: string;
  children: React.ReactNode;
  className?: string;
  corpoClassName?: string;
}) {
  return (
    <figure className={cn("light m-0", className)}>
      <figcaption className="sr-only">{descricao}</figcaption>
      <div className="lp-window" inert>
        <div className="lp-window-rail">
          {/* Igual à sidebar recolhida do produto: da marca, sobra o quadrado. */}
          <span className="mb-3.5 mt-1 flex h-5 items-center">
            <CortexMark size={11} />
          </span>
          {TRILHO.map(({ area: a, Icone }) => (
            <span key={a} className="lp-window-rail-item" data-active={a === area ? "" : undefined}>
              <Icone className="size-[1.05rem]" />
            </span>
          ))}
        </div>
        <div className="lp-window-header">
          <span className="flex items-center gap-3 min-w-0">
            <span aria-hidden className="lp-window-burger flex-col gap-[3px]">
              <span className="block h-px w-3.5 bg-current" />
              <span className="block h-px w-3.5 bg-current" />
              <span className="block h-px w-3.5 bg-current" />
            </span>
            <span className="text-body-sm font-medium truncate">Sua Barbearia</span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-caption" style={{ color: "var(--shell-muted)" }}>
              Unidade Centro
            </span>
            <span
              className="size-6 rounded-full border grid place-items-center text-[0.625rem] font-medium"
              style={{ borderColor: "var(--shell-border)", background: "var(--neutral-graphite)" }}
            >
              MA
            </span>
          </span>
        </div>
        <div className={cn("lp-window-body", corpoClassName)}>{children}</div>
      </div>
    </figure>
  );
}

/**
 * Celular em CSS puro. O conteúdo é diagramado a 375px — a largura em que
 * o CORTEX é validado no celular — e reduzido com `zoom`, para a tela do
 * aparelho mostrar exatamente a composição real do produto, não uma versão
 * espremida dela.
 */
export function PhoneFrame({
  tamanho = "md",
  descricao,
  children,
  className,
  statusEscura = false,
}: {
  tamanho?: "sm" | "md" | "lg";
  descricao: string;
  children: React.ReactNode;
  className?: string;
  /** Barra de status sobre fundo escuro (ex.: header do app). */
  statusEscura?: boolean;
}) {
  return (
    <figure className={cn("light m-0", className)}>
      <figcaption className="sr-only">{descricao}</figcaption>
      <div className={cn("lp-phone", `lp-phone-${tamanho}`)} inert>
        <span className="lp-phone-island" aria-hidden />
        <div className="lp-phone-screen">
          <div
            className="lp-phone-status"
            style={statusEscura ? { background: "var(--shell-bg)" } : undefined}
            aria-hidden
          />
          <div className="lp-phone-content">{children}</div>
        </div>
      </div>
    </figure>
  );
}
