import { cn } from "@/lib/cn";

export type Consequencia = {
  /** Chave estável (React) — não aparece. */
  chave: string;
  /** O módulo do CORTEX que recebeu o registro: "Caixa", "Estoque"… */
  modulo: string;
  /** O que mudou nele, em linguagem de balcão. */
  texto: string;
  /** Valor à direita, quando houver (sempre tabular). */
  valor?: string;
};

/**
 * O Pulso do produto: o que um fechamento acabou de escrever em cada módulo.
 *
 * É o mesmo gesto da landing ("Fechou o atendimento. O resto já sabe."), só
 * que com o registro de verdade: cada linha é uma consequência que o banco
 * grava na MESMA transação (close_attendance / venda do PDV). Nada aqui é
 * estimado — quem monta a lista só inclui a linha quando o dado que a
 * justifica está na tela (houve dinheiro → Caixa; houve produto → Estoque).
 *
 * As linhas acendem em sequência (o quadrado de cada módulo se enche, o texto
 * assenta), deslocadas pelo --stagger: a pessoa vê a venda chegar ao caixa, à
 * comissão, ao estoque. Com movimento reduzido tudo já nasce aceso.
 */
export function Consequencias({
  itens,
  titulo = "O que o CORTEX já registrou",
  tom = "superficie",
  className,
}: {
  itens: Consequencia[];
  titulo?: string;
  /** "marca": sobre o painel azul (PDV); "superficie": sobre superfície neutra. */
  tom?: "superficie" | "marca";
  className?: string;
}) {
  if (itens.length === 0) return null;
  return (
    <section className={cn("consequencias", className)} data-tom={tom} aria-label={titulo}>
      <p className="text-label uppercase consequencias-titulo">{titulo}</p>
      <ol className="mt-2.5">
        {itens.map((c, i) => (
          <li
            key={c.chave}
            className="consequencia"
            style={{ ["--i" as string]: i }}
          >
            <span aria-hidden="true" className="consequencia-sinal" />
            <span className="min-w-0 flex-1">
              <span className="consequencia-modulo">{c.modulo}</span>
              <span className="consequencia-texto">{c.texto}</span>
            </span>
            {c.valor && <span className="consequencia-valor tabular-nums">{c.valor}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
