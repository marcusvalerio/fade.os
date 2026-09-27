import Link from "next/link";
import { checkPlatformHealth } from "@/lib/platform-health";
import { visaoDaPlataforma, atividadeDasEmpresas, usoDosModulos, feedDeAuditoria, haQuanto, ROTULO_DA_ACAO } from "@/lib/admin";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StatusIndicator } from "./StatusIndicator";
import { SerieSemanal } from "./SerieSemanal";

const DIAS = 30;

/**
 * CENTRAL — "o CORTEX está de pé, está sendo usado e o que pede decisão?".
 * Saúde primeiro (é a pergunta que não pode esperar), depois a plataforma
 * em números, o movimento semanal, quem está ativo, quem parou e que
 * módulos estão sendo usados. Tudo sai de funções que só um admin de
 * plataforma consegue chamar; nenhum número é estimado.
 */
export default async function AdminCentralPage() {
  const [visao, empresas, modulos, auditoria, saude] = await Promise.all([
    visaoDaPlataforma(DIAS),
    atividadeDasEmpresas(DIAS),
    usoDosModulos(DIAS),
    feedDeAuditoria(8),
    checkPlatformHealth(),
  ]);

  if (!visao || !empresas) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar a Central agora.</p>
        <p className="text-caption text-muted mt-1">As leituras do Admin exigem um administrador de plataforma ativo.</p>
      </div>
    );
  }

  const ativas = empresas.filter((e) => e.status === "active");
  const maisAtivas = [...ativas]
    .filter((e) => e.agendamentos_periodo + e.atendimentos_periodo > 0 || e.receita_periodo > 0)
    .sort((a, b) => b.receita_periodo - a.receita_periodo || b.agendamentos_periodo - a.agendamentos_periodo)
    .slice(0, 5);
  const semAtividade = ativas.filter((e) => e.agendamentos_periodo + e.atendimentos_periodo === 0 && e.receita_periodo === 0);
  const degradados = saude.filter((s) => s.status === "degraded" || s.status === "down");
  const conectados = saude.filter((s) => s.status !== "not_connected");

  const decisoes = [
    visao.beta_pendentes > 0 && { texto: `${visao.beta_pendentes} pedido(s) de Beta aguardando análise`, href: "/admin/acessos" },
    visao.empresas_sem_onboarding > 0 && {
      texto: `${visao.empresas_sem_onboarding} empresa(s) sem concluir a configuração inicial`,
      href: "/admin/empresas?filtro=configuracao",
    },
    visao.empresas_suspensas > 0 && { texto: `${visao.empresas_suspensas} empresa(s) suspensa(s)`, href: "/admin/empresas?filtro=suspensas" },
    semAtividade.length > 0 && {
      texto: `${semAtividade.length} empresa(s) ativa(s) sem movimento em ${DIAS} dias`,
      href: "/admin/empresas?filtro=paradas",
    },
    ...degradados.map((s) => ({ texto: `${s.service}: ${s.status === "down" ? "fora do ar" : "degradado"} (${s.detail})`, href: "/admin/sistema" })),
  ].filter(Boolean) as { texto: string; href: string }[];

  const numeros: [string, string, string?][] = [
    ["Empresas ativas", String(visao.empresas_ativas), `${visao.empresas_com_movimento} com movimento`],
    ["Usuários", String(visao.usuarios), `${visao.usuarios_ativos} entraram em ${DIAS}d`],
    ["Clientes finais", String(visao.clientes), `${visao.contas_de_cliente} com conta`],
    ["Agendamentos", String(visao.agendamentos_periodo), `${visao.agendamentos} no total`],
    ["Atendimentos", String(visao.atendimentos_periodo), `${visao.vendas_periodo} vendas`],
    ["Receita processada", formatCurrency(visao.receita_periodo), `${formatCurrency(visao.receita_total)} no total`],
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-rise-in">
        <div>
          <p className="eyebrow">CORTEX Admin · últimos {DIAS} dias</p>
          <h1 className="text-page-title text-foreground mt-2.5">Central da plataforma.</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {conectados.map((s) => (
            <span key={s.service} className="inline-flex items-center gap-2 text-caption">
              <span className="text-muted">{s.service}</span>
              <StatusIndicator status={s.status} />
            </span>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-border border border-border rounded-md overflow-hidden">
        {numeros.map(([rotulo, valor, apoio], i) => (
          <div key={rotulo} className="bg-surface p-4 min-w-0 animate-rise-in motion-reduce:animate-none" style={{ animationDelay: `${i * 40}ms` }}>
            <dt className="font-subtitle text-caption text-muted truncate">{rotulo}</dt>
            <dd className="numero text-metric-sm text-foreground mt-2 truncate">{valor}</dd>
            {apoio && <dd className="text-micro text-muted mt-1 truncate">{apoio}</dd>}
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="painel p-5 sm:p-6 xl:col-span-8 min-w-0" aria-label="Movimento semanal">
          <SerieSemanal pontos={visao.serie} />
        </section>

        <section className="painel p-5 sm:p-6 xl:col-span-4" aria-labelledby="decisoes">
          <h2 id="decisoes" className="text-section-title text-foreground">Pede decisão</h2>
          {decisoes.length === 0 ? (
            <p className="text-body-sm text-muted mt-3">Nada pendente. Serviços conectados operando, nenhum pedido esperando.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {decisoes.map((d) => (
                <li key={d.texto}>
                  <Link href={d.href} className="group flex items-start justify-between gap-3 py-3 text-body-sm text-foreground">
                    <span className="flex gap-2.5">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-warning" />
                      {d.texto}
                    </span>
                    <span aria-hidden className="text-muted group-hover:text-foreground">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="painel overflow-hidden" aria-labelledby="ativas">
          <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-3">
            <h2 id="ativas" className="text-section-title text-foreground">Mais movimento</h2>
            <Link href="/admin/empresas" className="text-caption text-muted hover:text-foreground">Empresas →</Link>
          </div>
          {maisAtivas.length === 0 ? (
            <p className="px-5 sm:px-6 pb-5 text-body-sm text-muted">Nenhuma empresa com movimento nos últimos {DIAS} dias.</p>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-micro text-muted font-subtitle border-y border-border">
                  <th className="px-5 sm:px-6 py-2 font-normal">Empresa</th>
                  <th className="px-2 py-2 font-normal text-right">Agend.</th>
                  <th className="px-5 sm:px-6 py-2 font-normal text-right">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {maisAtivas.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 sm:px-6 py-2.5 max-w-0 w-full">
                      <Link href={`/admin/empresas/${e.id}`} className="block truncate text-foreground hover:underline underline-offset-4">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-right mono text-muted">{e.agendamentos_periodo}</td>
                    <td className="px-5 sm:px-6 py-2.5 text-right mono text-foreground whitespace-nowrap">{formatCurrency(e.receita_periodo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="painel p-5 sm:p-6" aria-labelledby="modulos">
          <div className="flex items-center justify-between gap-3">
            <h2 id="modulos" className="text-section-title text-foreground">Adoção dos módulos</h2>
            <Link href="/admin/uso" className="text-caption text-muted hover:text-foreground">Produto →</Link>
          </div>
          <p className="text-caption text-muted mt-1">Empresas ativas que usaram cada módulo em {DIAS} dias.</p>
          {!modulos || ativas.length === 0 ? (
            <p className="text-body-sm text-muted mt-4">Sem empresas ativas para medir adoção.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {modulos.slice(0, 7).map((m, i) => {
                const pct = Math.min(100, Math.round((m.empresas / ativas.length) * 100));
                return (
                  <li key={m.modulo}>
                    <div className="flex items-baseline justify-between gap-3 text-body-sm">
                      <span className="text-foreground truncate">{m.modulo}</span>
                      <span className="mono text-caption text-muted shrink-0">
                        {m.empresas}/{ativas.length}
                      </span>
                    </div>
                    <span className="mt-1 block h-1 bg-surface-muted" role="img" aria-label={`${m.modulo}: ${pct}% das empresas ativas`}>
                      <span
                        className="block h-full bg-primary origin-left animate-crescer motion-reduce:animate-none"
                        style={{ width: `${pct}%`, animationDelay: `${i * 40}ms` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="painel p-5 sm:p-6" aria-labelledby="paradas">
          <h2 id="paradas" className="text-section-title text-foreground">Sem movimento em {DIAS} dias</h2>
          {semAtividade.length === 0 ? (
            <p className="text-body-sm text-muted mt-3">Todas as empresas ativas movimentaram algo no período.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {semAtividade.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 py-2.5 text-body-sm">
                  <Link href={`/admin/empresas/${e.id}`} className="truncate text-foreground hover:underline underline-offset-4">
                    {e.name}
                  </Link>
                  <span className="mono text-caption text-muted shrink-0">
                    {e.ultima_atividade ? `última ${haQuanto(e.ultima_atividade)}` : e.onboarding_completed ? "nunca operou" : "em configuração"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="painel p-5 sm:p-6" aria-labelledby="recente">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recente" className="text-section-title text-foreground">Atividade recente</h2>
            <Link href="/admin/auditoria" className="text-caption text-muted hover:text-foreground">Auditoria →</Link>
          </div>
          {!auditoria || auditoria.length === 0 ? (
            <p className="text-body-sm text-muted mt-3">Nenhum evento registrado ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {auditoria.map((a, i) => (
                <li key={`${a.criado_em}-${i}`} className="py-2.5 flex items-baseline gap-3 text-body-sm">
                  <span className={cn("size-1.5 shrink-0 self-center", a.origem === "plataforma" ? "bg-primary" : "bg-neutral-sand")} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {ROTULO_DA_ACAO[a.acao] ?? a.acao}
                    {a.empresa && <span className="text-muted"> · {a.empresa}</span>}
                  </span>
                  <span className="mono text-micro text-muted shrink-0">{haQuanto(a.criado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
