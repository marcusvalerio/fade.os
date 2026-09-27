import Link from "next/link";
import { checkPlatformHealth } from "@/lib/platform-health";
import { pulsoDaPlataforma, feedDeAuditoria, haQuanto, ROTULO_DA_ACAO, type JanelaDoPulso, type MedidasDoPulso, type PontoDiarioDaPlataforma } from "@/lib/admin";
import { alertasDaPlataforma } from "@/lib/admin-alertas-dados";
import { variacao } from "@/lib/inicio";
import { formatCurrency } from "@/lib/format";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/cn";
import { StatusIndicator } from "./StatusIndicator";
import { ListaDeAlertas } from "./ListaDeAlertas";

const JANELAS: { chave: JanelaDoPulso; rotulo: string; comparacao: string; descricao: string }[] = [
  { chave: "hoje", rotulo: "Hoje", comparacao: "vs ontem até esta hora", descricao: "desde 0h de hoje (Brasília)" },
  { chave: "7d", rotulo: "7 dias", comparacao: "vs 7 dias anteriores", descricao: "últimos 7 dias" },
  { chave: "30d", rotulo: "30 dias", comparacao: "vs 30 dias anteriores", descricao: "últimos 30 dias" },
];

const ESTADOS_DO_BETA = [
  { chave: "ativa", rotulo: "Operando", marca: "bg-primary" },
  { chave: "esfriando", rotulo: "Esfriando", marca: "bg-warning/60" },
  { chave: "parada", rotulo: "Parada", marca: "bg-warning" },
  { chave: "sem_uso", rotulo: "Sem uso", marca: "bg-danger/70" },
  { chave: "configurando", rotulo: "Configurando", marca: "bg-border-strong" },
  { chave: "suspensa", rotulo: "Suspensa", marca: "bg-surface-muted" },
] as const;

type Indicador = {
  rotulo: string;
  chave: keyof MedidasDoPulso;
  serie?: keyof Omit<PontoDiarioDaPlataforma, "dia">;
  formatar: (n: number) => string;
};

const inteiro = (n: number) => n.toLocaleString("pt-BR");
const INDICADORES: Indicador[] = [
  { rotulo: "Barbearias operando", chave: "empresas_com_movimento", serie: "empresas_com_movimento", formatar: inteiro },
  { rotulo: "Agendamentos criados", chave: "agendamentos", serie: "agendamentos", formatar: inteiro },
  { rotulo: "Atendimentos concluídos", chave: "atendimentos", serie: "atendimentos", formatar: inteiro },
  { rotulo: "Receita processada", chave: "receita", serie: "receita", formatar: (n) => formatCurrency(n) },
  { rotulo: "Clientes cadastrados", chave: "clientes_novos", formatar: inteiro },
  { rotulo: "Contas de cliente", chave: "contas_de_cliente_novas", formatar: inteiro },
];

/**
 * CENTRAL — "a plataforma está sendo usada, mais ou menos do que antes, e o
 * que pede ação agora?". Alertas primeiro; depois os números da janela
 * escolhida contra a janela anterior do mesmo tamanho, com a linha dos
 * últimos 30 dias; o retrato do beta; o que aconteceu por último. Nenhum
 * número é estimado e nenhum ranking de barbearias por volume.
 */
export default async function AdminCentralPage({ searchParams }: { searchParams: Promise<{ janela?: string }> }) {
  const { janela: j } = await searchParams;
  const janela = JANELAS.find((x) => x.chave === j) ?? JANELAS[1];
  const [pulso, alertas, auditoria, saude] = await Promise.all([
    pulsoDaPlataforma(janela.chave),
    alertasDaPlataforma(),
    feedDeAuditoria(8),
    checkPlatformHealth(),
  ]);

  if (!pulso || !alertas) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar a Central agora.</p>
        <p className="text-caption text-muted mt-1">As leituras do Admin exigem um administrador de plataforma ativo.</p>
      </div>
    );
  }

  const conectados = saude.filter((s) => s.status !== "not_connected");
  const empresas = alertas.empresas ?? [];
  const totalBeta = empresas.length;
  const porEstado = ESTADOS_DO_BETA.map((e) => ({ ...e, qtd: empresas.filter((x) => x.estado === e.chave).length })).filter((e) => e.qtd > 0);
  const rotulosDaSerie = pulso.serie.map((p) => {
    const [, m, d] = p.dia.split("-");
    return `${d}/${m}`;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-rise-in">
        <div>
          <p className="eyebrow">CORTEX Admin · {janela.descricao}</p>
          <h1 className="text-page-title text-foreground mt-2.5">Central</h1>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <nav aria-label="Janela de tempo" className="flex gap-1">
            {JANELAS.map((x) => (
              <Link
                key={x.chave}
                href={x.chave === "7d" ? "/admin" : `/admin?janela=${x.chave}`}
                aria-current={janela.chave === x.chave ? "page" : undefined}
                className={cn("rounded-sm px-3 py-1.5 text-caption mono", janela.chave === x.chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground hover:bg-surface")}
              >
                {x.rotulo}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {conectados.map((s) => (
              <span key={s.service} className="inline-flex items-center gap-2 text-caption">
                <span className="text-muted">{s.service}</span>
                <StatusIndicator status={s.status} />
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-12 items-start">
        <section className="painel overflow-hidden xl:col-span-7" aria-labelledby="alertas">
          <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h2 id="alertas" className="text-section-title text-foreground">
              Pede ação
              <span className="mono text-caption text-muted ml-2">{alertas.alertas.length}</span>
            </h2>
            <Link href="/admin/alertas" className="text-caption text-muted hover:text-foreground">
              Regras e todos →
            </Link>
          </header>
          {alertas.alertas.length === 0 ? (
            <p className="px-5 pb-5 text-body-sm text-muted">Nada pedindo ação: barbearias operando, nenhum pedido esperando, nenhum erro novo.</p>
          ) : (
            <div className="border-t border-border">
              <ListaDeAlertas alertas={alertas.alertas} limite={5} />
            </div>
          )}
        </section>

        <section className="painel p-5 xl:col-span-5" aria-labelledby="beta">
          <div className="flex items-center justify-between gap-3">
            <h2 id="beta" className="text-section-title text-foreground">Beta agora</h2>
            <Link href="/admin/beta" className="text-caption text-muted hover:text-foreground">
              Barbearias →
            </Link>
          </div>
          {totalBeta === 0 ? (
            <p className="text-body-sm text-muted mt-3">Nenhuma barbearia no beta ainda.</p>
          ) : (
            <>
              <p className="mt-3 numero text-metric-sm text-foreground">
                {empresas.filter((e) => e.estado === "ativa").length}
                <span className="text-body text-muted"> de {totalBeta} operando</span>
              </p>
              <div className="mt-4 flex h-2.5 gap-0.5" role="img" aria-label={porEstado.map((e) => `${e.rotulo}: ${e.qtd}`).join(", ")}>
                {porEstado.map((e) => (
                  <span key={e.chave} className={cn("h-full first:rounded-l-[2px] last:rounded-r-[2px]", e.marca)} style={{ flexGrow: e.qtd }} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {porEstado.map((e) => (
                  <li key={e.chave} className="flex items-center justify-between gap-2 text-caption">
                    <span className="flex items-center gap-2 text-muted">
                      <span aria-hidden className={cn("size-2", e.marca)} />
                      {e.rotulo}
                    </span>
                    <span className="mono text-foreground">{e.qtd}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="numeros">
        <h2 id="numeros" className="sr-only">
          Números da plataforma
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-border border border-border rounded-md overflow-hidden">
          {INDICADORES.map((ind, i) => {
            const atual = pulso.atual[ind.chave];
            const v = variacao(atual, pulso.anterior[ind.chave]);
            const valores = ind.serie ? pulso.serie.map((p) => p[ind.serie!]) : [];
            return (
              <div key={ind.chave} className="bg-surface p-4 min-w-0 flex flex-col animate-rise-in motion-reduce:animate-none" style={{ animationDelay: `${i * 35}ms` }}>
                <dt className="font-subtitle text-caption text-muted truncate">{ind.rotulo}</dt>
                <dd className="numero text-metric-sm text-foreground mt-2 truncate">{ind.formatar(atual)}</dd>
                <dd className={cn("text-micro mt-1", v.tipo === "subiu" ? "text-success-ink" : v.tipo === "caiu" ? "text-danger-ink" : "text-muted")}>
                  {v.tipo === "sem-base"
                    ? `sem base ${janela.chave === "hoje" ? "ontem" : "anterior"}`
                    : v.tipo === "igual"
                      ? `igual · ${janela.comparacao}`
                      : `${v.tipo === "subiu" ? "↑" : "↓"} ${v.pct}% · era ${ind.formatar(pulso.anterior[ind.chave])}`}
                </dd>
                {ind.serie && (
                  <dd className="mt-auto pt-3">
                    <Sparkline valores={valores} rotulos={rotulosDaSerie} formatar={ind.formatar} descricao={`${ind.rotulo} por dia, últimos 30 dias`} largura={140} altura={28} className="w-full" />
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
        <p className="text-micro text-muted mt-2">
          Variação {janela.comparacao} (“era” = valor naquele período). Linhas: um ponto por dia, últimos 30 dias; o último ponto é hoje.
        </p>
      </section>

      <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 border-y border-border py-4">
        {[
          ["Pessoas que entraram", inteiro(pulso.usuarios_que_entraram), "sem comparação: só o último login é guardado"],
          ["Vendas concluídas", inteiro(pulso.atual.vendas), `${inteiro(pulso.anterior.vendas)} no período anterior`],
          ["Barbearias novas", inteiro(pulso.atual.empresas_novas), `${inteiro(pulso.anterior.empresas_novas)} no período anterior`],
          ["Pedidos de beta", inteiro(pulso.atual.pedidos_beta), `${pulso.beta_pendentes} esperando análise`],
          ["Respostas de pesquisa", inteiro(pulso.atual.pesquisas_respondidas), `${inteiro(pulso.anterior.pesquisas_respondidas)} no período anterior`],
        ].map(([r, v, apoio]) => (
          <div key={r} className="min-w-0">
            <dt className="font-subtitle text-micro text-muted truncate">{r}</dt>
            <dd className="numero text-body text-foreground mt-1">{v}</dd>
            <dd className="text-micro text-muted mt-0.5">{apoio}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section className="painel p-5 min-w-0" aria-labelledby="erros-resumo">
          <div className="flex items-center justify-between gap-3">
            <h2 id="erros-resumo" className="text-section-title text-foreground">Erros em produção</h2>
            <Link href="/admin/sistema#erros" className="text-caption text-muted hover:text-foreground">
              Saúde →
            </Link>
          </div>
          {alertas.erros.estado === "ok" ? (
            <dl className="mt-3 grid grid-cols-3 gap-px bg-border border-y border-border">
              {[
                ["Abertos", alertas.erros.resumo.abertos],
                ["Novos em 24 h", alertas.erros.resumo.novos24h],
                ["Recorrentes", alertas.erros.resumo.recorrentes],
              ].map(([r, v]) => (
                <div key={r} className="bg-surface py-3 pr-3 [&:not(:first-child)]:pl-3">
                  <dt className="font-subtitle text-micro text-muted">{r}</dt>
                  <dd className="numero text-body text-foreground mt-1">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 flex items-center gap-3 text-body-sm text-muted">
              <StatusIndicator status={alertas.erros.estado === "nao_conectado" ? "not_connected" : "unknown"} />
              {alertas.erros.estado === "nao_conectado" ? "Leitura do Sentry sem token no servidor." : alertas.erros.motivo}
            </p>
          )}
        </section>

        <section className="painel p-5 min-w-0" aria-labelledby="recente">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recente" className="text-section-title text-foreground">Atividade recente</h2>
            <Link href="/admin/auditoria" className="text-caption text-muted hover:text-foreground">
              Auditoria →
            </Link>
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
