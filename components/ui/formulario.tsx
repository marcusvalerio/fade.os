import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A gramática dos formulários.
 *
 * O padrão que existia era sempre o mesmo: um card grande, campo, campo,
 * campo, e um botão da largura toda no fim. Funciona, mas não diz nada — a
 * pessoa não sabe por que aqueles campos estão juntos, e todos parecem ter a
 * mesma importância, do nome do cliente à observação opcional.
 *
 * Aqui o formulário tem três partes, e elas são a mesma coisa em toda tela:
 *
 *   CONTEXTO   por que esta tela existe
 *   DADOS      agrupados por significado, cada grupo com um título curto
 *   AÇÃO       ancorada no fim, com a ação primária à direita
 *
 * O agrupamento é o ponto. "Identidade" (nome, telefone, e-mail) e "Contato
 * e preferências" (aniversário, observações, consentimento) são perguntas
 * diferentes, e separá-las custa uma linha de texto e devolve a leitura.
 *
 * Nada de card dentro de card: os grupos são separados por linha e espaço,
 * que é mais leve e não empilha bordas dentro de bordas no mobile.
 */
export function Formulario({
  children,
  className,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      // noValidate deixa a mensagem do Zod, em português, chegar à tela em vez
      // de o navegador barrar antes com o balão dele. O tradutor global
      // (ValidacaoEmPortugues) cobre o que ainda depende da checagem nativa.
      className={cn("material-solid rounded-md", className)}
      {...props}
    >
      {children}
    </form>
  );
}

/**
 * Um grupo de campos que responde a uma pergunta só.
 *
 * O título é curto e em caixa alta pequena — é etiqueta de seção, não
 * manchete. A descrição só aparece quando explica algo que o título não
 * consegue; texto de ajuda que repete o título é ruído.
 */
export function GrupoDeCampos({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("px-5 py-5 sm:px-6 border-b border-border last:border-b-0", className)}>
      <div className="mb-4">
        <h3 className="text-label uppercase text-muted">{titulo}</h3>
        {descricao && <p className="text-caption text-muted mt-1 max-w-prose opacity-80">{descricao}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * O rodapé de ações.
 *
 * A ação primária fica à direita no desktop, que é onde o olho termina a
 * leitura do formulário. No mobile a ordem inverte e ela sobe: com o polegar
 * numa mão, o alvo mais importante não pode ser o mais distante. Por isso
 * `flex-col-reverse` abaixo de sm — não é um empilhamento acidental, é a
 * ordem certa para o dedo.
 */
export function AcoesDoFormulario({
  children,
  ajuda,
  className,
}: {
  children: ReactNode;
  /** Uma linha sobre a consequência — "o cliente poderá ser agendado". */
  ajuda?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4 sm:px-6 bg-surface-muted rounded-b-md",
        "flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="text-caption text-muted min-w-0">{ajuda}</div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end shrink-0">
        {children}
      </div>
    </div>
  );
}

/**
 * O cabeçalho de contexto de uma tela de formulário.
 *
 * Responde "o que é isto e por que estou aqui" antes do primeiro campo. Fica
 * fora do quadro do formulário de propósito: é a tela falando, não o
 * formulário.
 */
export function ContextoDaTela({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 mb-5">
      <div className="min-w-0">
        <h1 className="text-page-title font-heading text-foreground">{titulo}</h1>
        {descricao && <p className="text-body-sm text-muted mt-1 max-w-prose">{descricao}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </header>
  );
}
