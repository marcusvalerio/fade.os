import Link from "next/link";
import { notFound } from "next/navigation";
import { pesquisasDoAdmin, resultadoDaPesquisa, haQuanto } from "@/lib/admin";
import { PUBLICOS, FUNCIONALIDADES, STATUS_DA_PESQUISA, TIPOS_DE_PESQUISA, type Publico } from "@/lib/pesquisas";
import { FormularioDePesquisa } from "../FormularioDePesquisa";
import { AcoesDaPesquisa } from "./AcoesDaPesquisa";
import { formatDateTime } from "@/lib/format";

const rotuloDoValor = (v: unknown) => (v === true ? "Sim" : v === false ? "Não" : Array.isArray(v) ? v.join(", ") : String(v));

/**
 * Uma pesquisa: o que foi perguntado, para quem, e o que voltou. Respostas
 * agregadas por valor e por público; comentários com público, barbearia e
 * data — nunca o nome de quem respondeu.
 */
export default async function AdminPesquisaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lista, resultado] = await Promise.all([pesquisasDoAdmin(), resultadoDaPesquisa(id)]);
  const p = lista?.find((x) => x.id === id);
  if (!lista) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar a pesquisa.</p>
      </div>
    );
  }
  if (!p) notFound();

  // Ordem natural dos valores, com zero onde ninguém escolheu.
  const base: (string | number | boolean)[] =
    p.tipo === "nota" ? [5, 4, 3, 2, 1] : p.tipo === "sim_nao" ? [true, false] : p.tipo === "texto" ? [] : p.opcoes;
  const contagem = new Map((resultado?.distribuicao ?? []).map((d) => [JSON.stringify(d.valor), d]));
  const linhas = base.map((v) => ({ valor: v, total: contagem.get(JSON.stringify(v))?.total ?? 0, porPublico: contagem.get(JSON.stringify(v))?.por_publico ?? {} }));
  const respostas = resultado?.respostas ?? 0;
  const taxa = resultado && resultado.exibicoes > 0 ? Math.round((resultado.respostas / resultado.exibicoes) * 100) : null;
  const maior = Math.max(1, ...linhas.map((l) => l.total));

  return (
    <div className="space-y-6">
      <nav aria-label="Caminho" className="text-caption text-muted">
        <Link href="/admin/pesquisas" className="hover:text-foreground">
          Pesquisas
        </Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{p.titulo}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 animate-rise-in">
        <div className="max-w-2xl min-w-0">
          <p className="eyebrow">
            {STATUS_DA_PESQUISA[p.status]} · {TIPOS_DE_PESQUISA[p.tipo]} · {FUNCIONALIDADES[p.funcionalidade]}
          </p>
          <h1 className="text-page-title text-foreground mt-2.5 break-words">{p.pergunta}</h1>
          <p className="text-body-sm text-muted mt-2.5">
            Para {p.publico.map((x) => PUBLICOS[x].toLowerCase()).join(", ")}
            {p.publicar_em && <> · a partir de {formatDateTime(p.publicar_em)}</>}
            {p.encerrar_em && <> · até {formatDateTime(p.encerrar_em)}</>}
          </p>
        </div>
        <AcoesDaPesquisa id={p.id} status={p.status} />
      </header>

      {p.status !== "rascunho" && (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border border-border rounded-md overflow-hidden">
            {[
              ["Viram", String(resultado?.exibicoes ?? 0)],
              ["Responderam", String(respostas)],
              ["Taxa de resposta", taxa === null ? "—" : `${taxa}%`],
              ["Fecharam sem responder", String(resultado?.dispensas ?? 0)],
              [p.tipo === "nota" ? "Média" : "Barbearias", p.tipo === "nota" ? (resultado?.media?.toFixed(1).replace(".", ",") ?? "—") : String(resultado?.empresas ?? 0)],
            ].map(([r, v], i) => (
              <div key={r} className={i === 4 ? "bg-surface p-4 col-span-2 md:col-span-1" : "bg-surface p-4"}>
                <dt className="font-subtitle text-caption text-muted">{r}</dt>
                <dd className="numero text-metric-sm text-foreground mt-2">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-6 xl:grid-cols-12 items-start">
            {p.tipo !== "texto" && (
              <section className="painel p-5 xl:col-span-7" aria-labelledby="distribuicao">
                <h2 id="distribuicao" className="text-section-title text-foreground">Respostas</h2>
                {respostas === 0 ? (
                  <p className="text-body-sm text-muted mt-2">Ninguém respondeu ainda.</p>
                ) : (
                  <>
                    <p className="text-caption text-muted mt-1">
                      {p.tipo === "multipla" ? "Cada pessoa pode marcar mais de uma; a porcentagem é sobre quem respondeu." : "Porcentagem sobre quem respondeu."}
                    </p>
                    <ul className="mt-4 space-y-3">
                      {linhas.map((l) => {
                        const pct = Math.round((l.total / respostas) * 100);
                        const detalhe = (Object.entries(l.porPublico) as [Publico, number][]).map(([k, n]) => `${PUBLICOS[k]}: ${n}`).join(" · ");
                        return (
                          <li key={JSON.stringify(l.valor)}>
                            <div className="flex items-baseline justify-between gap-3 text-body-sm">
                              <span className="text-foreground min-w-0 break-words">{rotuloDoValor(l.valor)}</span>
                              <span className="mono text-caption text-muted shrink-0">
                                {l.total} · {pct}%
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 bg-surface-muted" title={detalhe || undefined}>
                              <div className="h-full bg-chart rounded-r-[2px]" style={{ width: `${(l.total / maior) * 100}%` }} />
                            </div>
                            {detalhe && p.publico.length > 1 && <p className="text-micro text-muted mt-1">{detalhe}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            )}

            <section className={p.tipo === "texto" ? "painel p-5 xl:col-span-12" : "painel p-5 xl:col-span-5"} aria-labelledby="por-publico">
              <h2 id="por-publico" className="text-section-title text-foreground">Por público</h2>
              <table className="mt-3 w-full text-body-sm">
                <thead>
                  <tr className="text-micro font-subtitle text-muted">
                    <th className="text-left font-normal py-1.5">Público</th>
                    <th className="text-right font-normal py-1.5">Viram</th>
                    <th className="text-right font-normal py-1.5">Responderam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.publico.map((k) => {
                    const x = resultado?.por_publico?.[k];
                    return (
                      <tr key={k}>
                        <td className="py-2 text-foreground">{PUBLICOS[k]}</td>
                        <td className="py-2 text-right mono text-caption text-muted">{x?.exibicoes ?? 0}</td>
                        <td className="py-2 text-right mono text-caption text-foreground">{x?.respostas ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>

          <section className="painel overflow-hidden" aria-labelledby="comentarios">
            <h2 id="comentarios" className="text-section-title text-foreground px-5 pt-5 pb-3">
              {p.tipo === "texto" ? "Respostas" : "Comentários"}
              <span className="mono text-caption text-muted ml-2">{resultado?.comentarios.length ?? 0}</span>
            </h2>
            {!resultado || resultado.comentarios.length === 0 ? (
              <p className="px-5 pb-5 text-body-sm text-muted">
                {p.tipo === "texto" || p.permite_comentario ? "Nenhum texto recebido ainda." : "Esta pesquisa não pede comentário."}
              </p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {resultado.comentarios.map((c, i) => (
                  <li key={i} className="px-5 py-3.5">
                    <p className="text-body-sm text-foreground whitespace-pre-line break-words">{c.texto}</p>
                    <p className="text-caption text-muted mt-1">
                      {c.valor !== null && <>{rotuloDoValor(c.valor)} · </>}
                      {PUBLICOS[c.publico]}
                      {c.empresa && <> · {c.empresa}</>} · {haQuanto(c.em)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {p.status !== "encerrada" && (
        <section className="painel p-5 sm:p-6" aria-labelledby="editar">
          <h2 id="editar" className="text-section-title text-foreground mb-5">
            {p.status === "rascunho" ? "Editar rascunho" : "Ajustar"}
          </h2>
          <FormularioDePesquisa
            travada={p.status === "publicada"}
            inicial={{
              id: p.id,
              titulo: p.titulo,
              pergunta: p.pergunta,
              tipo: p.tipo,
              opcoes: p.opcoes,
              permiteComentario: p.permite_comentario,
              funcionalidade: p.funcionalidade,
              publico: p.publico,
              publicarEm: p.publicar_em,
              encerrarEm: p.encerrar_em,
            }}
          />
        </section>
      )}
    </div>
  );
}
