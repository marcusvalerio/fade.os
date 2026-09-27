import Link from "next/link";
import { pesquisasDoAdmin, haQuanto } from "@/lib/admin";
import { PUBLICOS, FUNCIONALIDADES, STATUS_DA_PESQUISA, TIPOS_DE_PESQUISA } from "@/lib/pesquisas";
import { NovaPesquisa } from "./NovaPesquisa";
import { cn } from "@/lib/cn";

const MARCA_DO_STATUS = {
  publicada: "bg-primary",
  rascunho: "border border-border-strong",
  encerrada: "bg-border-strong",
} as const;

/**
 * Pesquisas — perguntas curtas para quem usa o CORTEX no beta, com público
 * definido. Cada linha diz quantas pessoas viram, responderam e fecharam,
 * medido pelo que o banco registrou (nunca estimado).
 */
export default async function AdminPesquisasPage({ searchParams }: { searchParams: Promise<{ nova?: string }> }) {
  const { nova } = await searchParams;
  const pesquisas = await pesquisasDoAdmin();

  if (!pesquisas) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar as pesquisas.</p>
      </div>
    );
  }

  const ativas = pesquisas.filter((p) => p.status === "publicada");
  const respostas = pesquisas.reduce((s, p) => s + p.respostas, 0);
  const exibicoes = pesquisas.reduce((s, p) => s + p.exibicoes, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-rise-in">
        <div className="max-w-2xl">
          <p className="eyebrow">Beta</p>
          <h1 className="text-page-title text-foreground mt-2.5">Pesquisas</h1>
          <p className="font-subtitle text-subtitle text-muted mt-2.5">
            Uma pergunta por vez, no canto da tela, para o público escolhido. Quem responde ou fecha não vê a mesma pesquisa de novo.
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden">
        {[
          ["No ar agora", String(ativas.length)],
          ["Respostas", String(respostas)],
          ["Taxa de resposta", exibicoes > 0 ? `${Math.round((respostas / exibicoes) * 100)}%` : "—"],
        ].map(([r, v]) => (
          <div key={r} className="bg-surface p-4">
            <dt className="font-subtitle text-caption text-muted">{r}</dt>
            <dd className="numero text-metric-sm text-foreground mt-2">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex">
        <NovaPesquisa abertaDeInicio={nova === "1" || pesquisas.length === 0} />
      </div>

      {pesquisas.length > 0 && (
        <section className="painel overflow-hidden" aria-labelledby="lista-pesquisas">
          <h2 id="lista-pesquisas" className="sr-only">
            Todas as pesquisas
          </h2>
          <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_6rem_7rem_7rem] gap-3 px-5 py-2 border-b border-border text-micro font-subtitle text-muted">
            <span>Pesquisa</span>
            <span>Público</span>
            <span className="text-right">Respostas</span>
            <span className="text-right">Taxa</span>
            <span className="text-right">Última</span>
          </div>
          <ul className="divide-y divide-border">
            {pesquisas.map((p) => {
              const taxa = p.exibicoes > 0 ? Math.round((p.respostas / p.exibicoes) * 100) : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/pesquisas/${p.id}`}
                    className="grid grid-cols-2 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_6rem_7rem_7rem] gap-x-3 gap-y-1.5 items-center px-5 py-3.5 hover:bg-surface-muted/60 transition-colors duration-fast ease-standard"
                  >
                    <span className="col-span-2 md:col-span-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={cn("size-2 shrink-0", MARCA_DO_STATUS[p.status])} />
                        <span className="text-body-sm text-foreground font-medium truncate">{p.titulo}</span>
                      </span>
                      <span className="block text-caption text-muted mt-0.5 truncate">
                        {STATUS_DA_PESQUISA[p.status]} · {TIPOS_DE_PESQUISA[p.tipo]} · {FUNCIONALIDADES[p.funcionalidade]}
                      </span>
                    </span>
                    <span className="col-span-2 md:col-span-1 text-caption text-muted truncate">{p.publico.map((x) => PUBLICOS[x]).join(" · ")}</span>
                    <span className="mono text-caption text-foreground md:text-right">
                      {p.respostas}
                      <span className="text-muted">/{p.exibicoes}</span>
                    </span>
                    <span className="mono text-caption text-muted text-right">{taxa === null ? "—" : `${taxa}%`}</span>
                    <span className="hidden md:block mono text-caption text-muted text-right">{p.ultima_resposta ? haQuanto(p.ultima_resposta) : "—"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
