import Link from "next/link";
import { comunicadosDoAdmin, empresasNoBeta, haQuanto, type ComunicadoNoAdmin } from "@/lib/admin";
import { TIPOS_COMUNICAVEIS, PAPEIS_DE_DESTINO, ROTULO_DA_PRIORIDADE } from "@/lib/notificacoes/catalogo";
import { NovoComunicado } from "./NovoComunicado";
import { AcoesDoComunicado } from "./AcoesDoComunicado";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const STATUS: Record<ComunicadoNoAdmin["status"], { rotulo: string; marca: string }> = {
  rascunho: { rotulo: "Rascunho", marca: "border border-border-strong" },
  agendado: { rotulo: "Agendado", marca: "bg-warning" },
  enviando: { rotulo: "Enviando", marca: "bg-primary" },
  enviado: { rotulo: "Enviado", marca: "bg-primary" },
  cancelado: { rotulo: "Cancelado", marca: "bg-border-strong" },
};

const ROTULO_DO_TIPO: Record<string, string> = {
  ...Object.fromEntries(TIPOS_COMUNICAVEIS.map((t) => [t.chave, t.rotulo])),
  "produto.pesquisa": "Pesquisa",
};

function destino(c: ComunicadoNoAdmin) {
  const papeis = c.papeis.length === PAPEIS_DE_DESTINO.length ? "Todos" : c.papeis.map((p) => PAPEIS_DE_DESTINO.find((x) => x.chave === p)?.rotulo).join(", ");
  return `${papeis}${c.empresas?.length ? ` · ${c.empresas.length} ${c.empresas.length === 1 ? "barbearia" : "barbearias"}` : ""}`;
}

/**
 * Comunicados: o Admin fala com quem usa o CORTEX sem virar spam. Tudo o que
 * sai daqui passa pelas mesmas regras das notificações automáticas
 * (preferência de cada pessoa, papel real, push só para quem permitiu) e
 * pelos limites de produto.
 */
export default async function AdminNotificacoesPage() {
  const [comunicados, empresas] = await Promise.all([comunicadosDoAdmin(), empresasNoBeta(30)]);

  if (!comunicados) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar os comunicados.</p>
      </div>
    );
  }

  const enviados = comunicados.filter((c) => c.status === "enviado");
  const pessoas = enviados.reduce((s, c) => s + c.destinatarios, 0);
  const abertas = enviados.reduce((s, c) => s + c.abertas, 0);

  return (
    <div className="space-y-6">
      <header className="max-w-2xl animate-rise-in">
        <p className="eyebrow">Beta e produto</p>
        <h1 className="text-page-title text-foreground mt-2.5">Notificações</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Comunicados para donos, gerência, profissionais ou clientes. Pesquisas saem pela própria pesquisa (
          <Link href="/admin/pesquisas" className="underline underline-offset-4 hover:text-foreground">
            Pesquisas
          </Link>
          ).
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden">
        {[
          ["Enviados", String(enviados.length)],
          ["Pessoas alcançadas", String(pessoas)],
          ["Abertura", pessoas > 0 ? `${Math.round((abertas / pessoas) * 100)}%` : "—"],
        ].map(([r, v]) => (
          <div key={r} className="bg-surface p-4">
            <dt className="font-subtitle text-caption text-muted">{r}</dt>
            <dd className="numero text-metric-sm text-foreground mt-2">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex">
        <NovoComunicado empresas={(empresas ?? []).filter((e) => e.status === "active").map((e) => ({ id: e.id, name: e.name }))} />
      </div>

      {comunicados.length === 0 ? (
        <div className="painel p-6">
          <p className="text-body-sm text-foreground font-medium">Nenhum comunicado ainda.</p>
          <p className="text-caption text-muted mt-1">Avisos automáticos (agenda, estoque, caixa) não aparecem aqui — só o que o Admin envia.</p>
        </div>
      ) : (
        <section className="painel overflow-hidden" aria-labelledby="lista-comunicados">
          <h2 id="lista-comunicados" className="sr-only">
            Comunicados
          </h2>
          <ul className="divide-y divide-border">
            {comunicados.map((c) => {
              const s = STATUS[c.status];
              return (
                <li key={c.id} className="px-5 py-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span aria-hidden className={cn("size-2 shrink-0", s.marca)} />
                      <span className="text-body-sm text-foreground font-medium break-words">{c.titulo}</span>
                    </p>
                    <p className="text-caption text-muted mt-0.5 break-words">{c.mensagem}</p>
                    <p className="text-caption text-muted mt-1">
                      {s.rotulo} · {ROTULO_DO_TIPO[c.tipo] ?? c.tipo} · {ROTULO_DA_PRIORIDADE[c.prioridade]} · {destino(c)}
                      {c.pesquisa_id && (
                        <>
                          {" · "}
                          <Link href={`/admin/pesquisas/${c.pesquisa_id}`} className="underline underline-offset-4 hover:text-foreground">
                            {c.pesquisa_titulo ?? "pesquisa"}
                          </Link>
                        </>
                      )}
                      {c.url && <> · leva a <span className="mono">{c.url}</span></>}
                    </p>
                  </div>
                  <dl className="grid grid-cols-4 gap-2 text-caption">
                    {[
                      ["Pessoas", c.status === "enviado" ? c.destinatarios : "—"],
                      ["Leram", c.status === "enviado" ? c.lidas : "—"],
                      ["Abriram", c.status === "enviado" ? c.abertas : "—"],
                      ["Push", c.status === "enviado" ? c.push_enviados : "—"],
                    ].map(([r, v]) => (
                      <div key={r as string}>
                        <dt className="text-muted">{r}</dt>
                        <dd className="numero text-body-sm text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <span className="text-caption text-muted" title={formatDateTime(c.enviado_em ?? c.enviar_em ?? c.criado_em)}>
                      {c.status === "enviado" && c.enviado_em
                        ? haQuanto(c.enviado_em)
                        : c.status === "agendado" && c.enviar_em
                          ? `para ${formatDateTime(c.enviar_em)}`
                          : haQuanto(c.criado_em)}
                      {c.limitados > 0 && ` · ${c.limitados} pelo limite`}
                    </span>
                    {(c.status === "rascunho" || c.status === "agendado") && <AcoesDoComunicado id={c.id} status={c.status} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
