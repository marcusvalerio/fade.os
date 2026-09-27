import Link from "next/link";
import { usoDosModulos, atividadeDasEmpresas, visaoDaPlataforma, matrizDeUso, haQuanto } from "@/lib/admin";
import { MatrizDeUso } from "./MatrizDeUso";
import { cn } from "@/lib/cn";

const JANELAS = [7, 30, 90] as const;

/**
 * Produto — "como o CORTEX está sendo usado?". Por módulo: quantas empresas
 * ativas usaram, quantos registros e quando foi a última vez. Mede uso por
 * registro criado — não existe telemetria de clique ou de página, e isso é
 * dito aqui em vez de inventar "acessos".
 */
export default async function AdminProductPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams;
  const dias = JANELAS.includes(Number(diasParam) as (typeof JANELAS)[number]) ? Number(diasParam) : 30;
  const [modulos, empresas, visao, matriz] = await Promise.all([usoDosModulos(dias), atividadeDasEmpresas(dias), visaoDaPlataforma(dias), matrizDeUso(dias)]);

  if (!modulos || !empresas || !visao) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar o uso do produto.</p>
      </div>
    );
  }

  const ativas = empresas.filter((e) => e.status === "active").length;
  const ordenados = [...modulos].sort((a, b) => b.empresas - a.empresas || b.registros - a.registros);
  const poucoUsados = ordenados.filter((m) => ativas > 0 && m.empresas / ativas < 0.34);
  const distribuicao = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => empresas.filter((e) => e.status === "active" && e.modulos_usados === k).length);
  const maxDist = Math.max(...distribuicao, 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-rise-in">
        <div>
          <p className="eyebrow">Plataforma</p>
          <h1 className="text-page-title text-foreground mt-2.5">Como o CORTEX está sendo usado.</h1>
          <p className="font-subtitle text-subtitle text-muted mt-2.5">
            Uso medido por registro criado em cada módulo. Não há telemetria de cliques ou páginas vistas.
          </p>
        </div>
        <nav aria-label="Janela de tempo" className="flex gap-1">
          {JANELAS.map((d) => (
            <Link
              key={d}
              href={`/admin/uso?dias=${d}`}
              aria-current={dias === d ? "page" : undefined}
              className={cn(
                "rounded-sm px-2.5 py-1.5 text-caption mono",
                dias === d ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground hover:bg-surface"
              )}
            >
              {d}d
            </Link>
          ))}
        </nav>
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
        {[
          ["Empresas ativas", String(ativas)],
          ["Com movimento", String(visao.empresas_com_movimento)],
          ["Usuários que entraram", String(visao.usuarios_ativos)],
          ["Usuários novos", String(visao.usuarios_novos)],
        ].map(([r, v]) => (
          <div key={r} className="bg-surface p-4">
            <dt className="font-subtitle text-caption text-muted">{r}</dt>
            <dd className="numero text-metric-sm text-foreground mt-2">{v}</dd>
          </div>
        ))}
      </dl>

      {matriz && <MatrizDeUso linhas={matriz} empresas={empresas} dias={dias} />}

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="painel overflow-hidden xl:col-span-8" aria-labelledby="modulos">
          <h2 id="modulos" className="text-section-title text-foreground px-5 pt-5 pb-3">
            Módulos · últimos {dias} dias
          </h2>
          <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_5rem_7rem] gap-3 px-5 py-2 border-y border-border text-micro font-subtitle text-muted">
            <span>Módulo</span>
            <span>Empresas ativas usando</span>
            <span className="text-right">Registros</span>
            <span className="text-right">Último uso</span>
          </div>
          <ul className="divide-y divide-border">
            {ordenados.map((m, i) => {
              const pct = ativas > 0 ? Math.min(100, Math.round((m.empresas / ativas) * 100)) : 0;
              return (
                <li key={m.modulo} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_5rem_7rem] gap-x-3 gap-y-1.5 items-center px-5 py-3">
                  <span className="col-span-2 sm:col-span-1 text-body-sm text-foreground truncate">{m.modulo}</span>
                  <span className="col-span-2 sm:col-span-1 flex items-center gap-3">
                    <span className="flex-1 h-1 bg-surface-muted" role="img" aria-label={`${pct}% das empresas ativas`}>
                      <span
                        className="block h-full bg-primary origin-left animate-crescer motion-reduce:animate-none"
                        style={{ width: `${pct}%`, animationDelay: `${i * 35}ms` }}
                      />
                    </span>
                    <span className="mono text-caption text-muted w-12 text-right">
                      {m.empresas}/{ativas}
                    </span>
                  </span>
                  <span className="mono text-caption text-foreground sm:text-right">{m.registros}</span>
                  <span className="mono text-caption text-muted text-right">{haQuanto(m.ultima)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="xl:col-span-4 space-y-6">
          <section className="painel p-5" aria-labelledby="profundidade">
            <h2 id="profundidade" className="text-section-title text-foreground">Profundidade de uso</h2>
            <p className="text-caption text-muted mt-1">Empresas ativas por quantidade de módulos usados (de 7 medidos).</p>
            <ul className="mt-4 space-y-1.5">
              {distribuicao.map((qtd, k) => (
                <li key={k} className="flex items-center gap-3 text-caption">
                  <span className="mono text-muted w-4 text-right">{k}</span>
                  <span className="flex-1 h-3 bg-surface-muted">
                    <span className="block h-full bg-primary/70" style={{ width: `${(qtd / maxDist) * 100}%` }} />
                  </span>
                  <span className="mono text-foreground w-6 text-right">{qtd}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="painel p-5" aria-labelledby="pouco">
            <h2 id="pouco" className="text-section-title text-foreground">Pouco usados</h2>
            {poucoUsados.length === 0 ? (
              <p className="text-body-sm text-muted mt-2">Todos os módulos são usados por pelo menos um terço das empresas ativas.</p>
            ) : (
              <>
                <p className="text-caption text-muted mt-1">Menos de um terço das empresas ativas usou no período.</p>
                <ul className="mt-3 space-y-1.5">
                  {poucoUsados.map((m) => (
                    <li key={m.modulo} className="flex justify-between gap-3 text-body-sm">
                      <span className="text-foreground truncate">{m.modulo}</span>
                      <span className="mono text-caption text-muted">{m.empresas}/{ativas}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
