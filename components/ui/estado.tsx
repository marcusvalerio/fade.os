import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CortexMark } from "@/components/ui/cortex-mark";

/**
 * A linguagem dos estados.
 *
 * O problema não era falta de estados — era que cada tela inventava o seu.
 * Uma lista vazia dizia "Nenhum dado", outra abria um card cinza, um erro
 * virava texto vermelho solto e "carregando" às vezes era spinner, às vezes
 * nada. O usuário aprendia cada tela separadamente.
 *
 * Aqui existe uma regra única, e ela é semântica antes de ser visual:
 *
 *   VAZIO      não existe dado. NÃO é erro, então não usa vermelho e não
 *              pede desculpa — oferece o próximo passo.
 *   CARREGANDO ainda não chegou. Mostra a forma do que vem, não um spinner
 *              no meio do nada.
 *   ERRO       não terminou. Diz o que falhou e o que dá para fazer.
 *   ATENCAO    terminou, mas alguém precisa olhar.
 *   SUCESSO    terminou como devia.
 *
 * A cor entra pela borda e por um filete, nunca pelo fundo inteiro: fundo
 * colorido em bloco grande é o que transforma a interface em semáforo.
 */
type Tom = "vazio" | "erro" | "atencao" | "sucesso";

const FILETE: Record<Tom, string> = {
  vazio: "bg-border",
  erro: "bg-danger",
  atencao: "bg-warning",
  sucesso: "bg-success",
};

const TINTA: Record<Tom, string> = {
  vazio: "text-muted",
  erro: "text-danger-ink",
  atencao: "text-warning-ink",
  sucesso: "text-success-ink",
};

/**
 * Estado vazio.
 *
 * Nunca "Nenhum dado.". O título diz o que não existe, no vocabulário da
 * barbearia, e a ação diz o que fazer a respeito — é a diferença entre uma
 * tela que informa e uma tela que destrava.
 */
export function Vazio({
  titulo,
  descricao,
  acao,
  compacto = false,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div className={cn("text-center animate-fade-in px-6", compacto ? "py-8" : "py-14")}>
      {/* CORTEX MARK (R23): marca o vazio como um estado desenhado, não uma
          ausência — sem virar ilustração. Só nos estados vazios não-compactos,
          onde há espaço de sobra para ele significar algo. */}
      {!compacto && (
        <div className="mb-3 flex justify-center opacity-40">
          <CortexMark size={28} toneA="var(--muted-foreground)" toneB="var(--muted-foreground)" />
        </div>
      )}
      <p className="text-section-title text-foreground">{titulo}</p>
      {descricao && <p className="text-body-sm text-muted mt-1.5 max-w-sm mx-auto">{descricao}</p>}
      {acao && <div className="mt-5 flex justify-center">{acao}</div>}
    </div>
  );
}

/**
 * Aviso ancorado num lugar da tela — erro de operação, alerta, confirmação
 * que precisa ficar visível em vez de passar num toast.
 */
export function Aviso({
  tom,
  titulo,
  children,
  acao,
  className,
}: {
  tom: Exclude<Tom, "vazio">;
  titulo?: string;
  children?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-md border border-border bg-surface px-4 py-3 animate-rise-in",
        className
      )}
    >
      <span aria-hidden="true" className={cn("w-0.5 shrink-0 rounded-full", FILETE[tom])} />
      <div className="min-w-0 flex-1">
        {titulo && <p className={cn("text-body-sm font-medium", TINTA[tom])}>{titulo}</p>}
        {children && <div className="text-body-sm text-muted [&:not(:first-child)]:mt-0.5">{children}</div>}
      </div>
      {acao && <div className="shrink-0 self-center">{acao}</div>}
    </div>
  );
}

/**
 * Carregando.
 *
 * Mostra a forma do que está por vir — linhas do tamanho das linhas reais —
 * em vez de um spinner centralizado. O spinner diz "espere"; isto diz "é uma
 * lista de cinco itens e ela já está chegando", que é menos ansioso e evita o
 * salto de layout quando o conteúdo entra.
 */
export function Carregando({
  linhas = 4,
  rotulo = "Carregando",
}: {
  linhas?: number;
  rotulo?: string;
}) {
  return (
    <div role="status" aria-label={rotulo} className="divide-y divide-border">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-11 shrink-0 rounded-sm bg-surface-muted animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className="h-3 rounded-sm bg-surface-muted animate-pulse"
              // Larguras irregulares: barras idênticas parecem tabela, não
              // conteúdo esperando para existir.
              style={{ width: `${58 - (i % 3) * 11}%`, animationDelay: `${i * 70}ms` }}
            />
            <div
              className="h-2.5 rounded-sm bg-surface-muted animate-pulse"
              style={{ width: `${34 - (i % 2) * 8}%`, animationDelay: `${i * 70 + 40}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
