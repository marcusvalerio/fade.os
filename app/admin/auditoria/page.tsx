import Link from "next/link";
import { feedDeAuditoria, ROTULO_DA_ACAO } from "@/lib/admin";
import { cn } from "@/lib/cn";

const FILTROS = [
  { chave: "todas", rotulo: "Tudo" },
  { chave: "plataforma", rotulo: "Plataforma" },
  { chave: "empresa", rotulo: "Barbearias" },
] as const;

/**
 * Auditoria — uma linha do tempo só: decisões de plataforma (Beta, admin,
 * suspensão) e ações sensíveis dentro das barbearias (fechamento, caixa,
 * cancelamento, ajuste de estoque, preço, reagendamento). Quem, o quê, em
 * qual empresa, quando e por quê.
 *
 * Não registrado hoje (e dito aqui, não simulado): tentativas de login
 * malsucedidas, IP e dispositivo de acesso.
 */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const { origem = "todas" } = await searchParams;
  const eventos = await feedDeAuditoria(300);

  if (!eventos) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar a auditoria.</p>
      </div>
    );
  }

  const lista = eventos.filter((e) => origem === "todas" || e.origem === origem);
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">Governança</p>
        <h1 className="text-page-title text-foreground mt-2.5">Auditoria.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Os {eventos.length} eventos mais recentes. Tentativas de login falhas, IP e dispositivo não são registrados hoje.
        </p>
      </header>

      <nav aria-label="Filtrar origem" className="flex flex-wrap gap-1">
        {FILTROS.map((f) => (
          <Link
            key={f.chave}
            href={`/admin/auditoria?origem=${f.chave}`}
            aria-current={origem === f.chave ? "page" : undefined}
            className={cn(
              "rounded-sm px-2.5 py-1.5 text-caption transition-colors duration-micro",
              origem === f.chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground hover:bg-surface"
            )}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <div className="painel p-8 text-center">
          <p className="text-body-sm text-foreground font-medium">Nenhum evento registrado ainda.</p>
          <p className="text-caption text-muted mt-1">Toda decisão administrativa e ação sensível passa a aparecer aqui.</p>
        </div>
      ) : (
        <ol className="painel divide-y divide-border">
          {lista.map((e, i) => (
            <li key={`${e.criado_em}-${i}`} className="px-5 py-3 grid gap-x-4 gap-y-1 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] items-baseline">
              <time dateTime={e.criado_em} className="mono text-caption text-muted">
                {fmt.format(new Date(e.criado_em))}
              </time>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-body-sm text-foreground">
                  <span aria-hidden className={cn("size-1.5 shrink-0", e.origem === "plataforma" ? "bg-primary" : "bg-neutral-sand")} />
                  <span className="truncate">{ROTULO_DA_ACAO[e.acao] ?? e.acao}</span>
                </span>
                <span className="block text-caption text-muted truncate pl-3.5">
                  {[e.empresa, e.ator ? `por ${e.ator}` : "sem autor identificado", e.motivo ? `“${e.motivo}”` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="font-subtitle text-micro uppercase tracking-label text-muted pl-3.5 sm:pl-0">
                {e.origem === "plataforma" ? "plataforma" : "barbearia"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
