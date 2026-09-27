import Link from "next/link";
import { haQuanto } from "@/lib/admin";
import type { LeituraDoSentry, AmbienteDoSentry } from "@/lib/sentry-leitura";
import { StatusIndicator } from "../StatusIndicator";
import { cn } from "@/lib/cn";

const AMBIENTES: { chave: AmbienteDoSentry; rotulo: string }[] = [
  { chave: "production", rotulo: "Produção" },
  { chave: "preview", rotulo: "Preview" },
];

const MARCA_DO_NIVEL: Record<string, string> = {
  fatal: "bg-danger",
  error: "bg-danger",
  warning: "bg-warning",
  info: "bg-primary",
  debug: "border border-border-strong",
};
const ROTULO_DO_NIVEL: Record<string, string> = { fatal: "Fatal", error: "Erro", warning: "Aviso", info: "Info", debug: "Debug" };

/**
 * Erros lidos do Sentry (só no servidor). Mostra o que está aberto no
 * ambiente escolhido: novo, recorrente, rota, frequência, última vez e o
 * link para o Sentry. Mensagens já chegam limpas de dados pessoais — a
 * limpeza acontece antes do envio (lib/observabilidade-limpeza).
 */
export function ErrosDoSentry({ leitura, ambiente }: { leitura: LeituraDoSentry; ambiente: AmbienteDoSentry }) {
  return (
    <section id="erros" className="painel overflow-hidden scroll-mt-6" aria-labelledby="erros-titulo">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 id="erros-titulo" className="text-section-title text-foreground">Erros da aplicação</h2>
          <p className="text-caption text-muted mt-1">Sentry · navegador, servidor e edge · abertos nos últimos 14 dias</p>
        </div>
        <div className="flex items-center gap-3">
          {leitura.estado === "ok" ? (
            <StatusIndicator status={leitura.resumo.novos24h > 0 ? "degraded" : "operational"} detail="conectado" />
          ) : leitura.estado === "indisponivel" ? (
            <StatusIndicator status="unknown" detail="indisponível" />
          ) : (
            <StatusIndicator status="not_connected" />
          )}
        </div>
      </header>

      {leitura.estado === "nao_conectado" && (
        <div className="px-5 pb-5 text-body-sm text-muted space-y-2 max-w-3xl">
          <p>
            O CORTEX já <span className="text-foreground">envia</span> os erros para o Sentry quando <code className="mono text-caption">NEXT_PUBLIC_SENTRY_DSN</code> está configurado no deploy. Para
            <span className="text-foreground"> ler</span> aqui, falta um token de leitura no servidor:
          </p>
          <p className="mono text-caption text-foreground">SENTRY_API_TOKEN (escopos: event:read, project:read)</p>
          <p className="text-caption">Enquanto isso, os erros ficam no painel do Sentry (organização cortexos, projeto cortex-os). Nada aqui é estimado.</p>
        </div>
      )}

      {leitura.estado === "indisponivel" && <p className="px-5 pb-5 text-body-sm text-muted">{leitura.motivo} Nada é mostrado para não exibir dado velho como se fosse atual.</p>}

      {leitura.estado === "ok" && (
        <>
          <nav aria-label="Ambiente" className="flex gap-1 px-5 pb-3">
            {AMBIENTES.map((a) => (
              <Link
                key={a.chave}
                href={`/admin/sistema?ambiente=${a.chave}#erros`}
                aria-current={ambiente === a.chave ? "page" : undefined}
                className={cn("rounded-sm px-2.5 py-1.5 text-caption mono", ambiente === a.chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground hover:bg-surface")}
              >
                {a.rotulo}
              </Link>
            ))}
            <a href={leitura.painel} target="_blank" rel="noreferrer" className="ml-auto self-center text-caption text-muted hover:text-foreground">
              Abrir no Sentry ↗
            </a>
          </nav>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border-y border-border">
            {[
              ["Abertos", leitura.resumo.abertos],
              ["Novos em 24 h", leitura.resumo.novos24h],
              ["Recorrentes", leitura.resumo.recorrentes],
              ["Ocorrências", leitura.resumo.ocorrencias],
            ].map(([r, v]) => (
              <div key={r} className="bg-surface px-5 py-3">
                <dt className="font-subtitle text-micro text-muted">{r}</dt>
                <dd className="numero text-body text-foreground mt-1">{v}</dd>
              </div>
            ))}
          </dl>
          {leitura.problemas.length === 0 ? (
            <p className="px-5 py-5 text-body-sm text-muted">Nenhum erro aberto em {ambiente === "production" ? "produção" : "preview"} nos últimos 14 dias.</p>
          ) : (
            <ul className="divide-y divide-border">
              {leitura.problemas.map((p) => (
                <li key={p.id} className="px-5 py-3.5 grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro font-subtitle uppercase tracking-label">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <span aria-hidden className={cn("size-2", MARCA_DO_NIVEL[p.nivel])} />
                        {ROTULO_DO_NIVEL[p.nivel]}
                      </span>
                      {p.novo && <span className="text-danger-ink">novo</span>}
                      {p.recorrente && <span className="text-warning-ink">recorrente</span>}
                      {p.naoTratado && <span className="text-muted">não tratado</span>}
                      <span className="mono normal-case tracking-normal text-muted">{p.codigo}</span>
                    </p>
                    <a href={p.link} target="_blank" rel="noreferrer" className="block mt-1 text-body-sm text-foreground font-medium break-words hover:underline underline-offset-4">
                      {p.titulo}
                    </a>
                    {p.rota && <p className="mono text-caption text-muted truncate">{p.rota}</p>}
                  </div>
                  <p className="mono text-caption text-muted sm:text-right whitespace-nowrap">
                    {p.ocorrencias}× · {p.pessoas} {p.pessoas === 1 ? "pessoa" : "pessoas"}
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> · </span>
                    última {haQuanto(p.ultimaVez)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
