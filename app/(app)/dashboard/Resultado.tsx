import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardComparison, fetchDashboardSeries, type PeriodPreset } from "@/actions/dashboard";
import { formatCurrency } from "@/lib/format";
import { businessToday, formatBusinessDayLabel } from "@/lib/time";
import { getClientBehaviors } from "@/lib/crm";
import { variacao, textoDaVariacao, ritmoDaMeta, proporcao, reposicao } from "@/lib/inicio";
import { formatarDuracao } from "@/lib/agenda-ocupacao";
import { NumeroQueChega } from "@/components/ui/numero-que-chega";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PeriodPicker } from "./PeriodPicker";
import { RevenueChart } from "./RevenueChart";

type Panorama = {
  vendas: { servicos: number; produtos: number; quantidade: number; avulsas: number };
  mes: { faturamento: number };
  equipe: {
    id: string;
    name: string;
    atendimentos: number;
    receita: number;
    comissao: number;
    capacidade_minutos: number;
    minutos_agendados: number;
  }[];
  clientes: { cadastrados: number; ativos_90d: number; atendidos: number; gasto_medio: number };
  estoque: {
    valor_custo: number;
    valor_venda: number;
    produtos_ativos: number;
    criticos: { id: string; nome: string; atual: number; minimo: number }[];
    criticos_total: number;
    maior_saida: { nome: string; quantidade: number; receita: number }[];
    parados: { nome: string; atual: number }[];
    parados_total: number;
  };
  agenda: { total: number; concluidos: number; cancelados: number; nao_compareceu: number };
};

const ROTULO_PERIODO: Record<string, string> = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  mes: "Este mês",
};

/**
 * RESULTADO — como o negócio está indo no período. Cada bloco responde uma
 * pergunta e termina num lugar para agir. Sem gráfico de enfeite: o único
 * gráfico é a série do faturamento; o resto são números com contexto e
 * barras de proporção.
 */
export async function Resultado({ companyId, preset }: { companyId: string; preset: PeriodPreset }) {
  const supabase = await createClient();
  const { current: m, previous: anterior, period } = await fetchDashboardComparison(companyId, null, preset);

  const [serie, { data: panoramaBruto }, { data: unit }, comportamentos] = await Promise.all([
    fetchDashboardSeries(companyId, null, period.start, period.end),
    supabase.rpc("get_inicio_panorama", { p_company_id: companyId, p_start: period.start, p_end: period.end }),
    supabase.from("unit").select("settings").eq("company_id", companyId).order("created_at").limit(1).maybeSingle(),
    getClientBehaviors(companyId),
  ]);

  const rotuloPeriodo = `${formatBusinessDayLabel(period.start, { day: "numeric", month: "short" })} a ${formatBusinessDayLabel(period.end, { day: "numeric", month: "short" })}`;

  if (!m || !panoramaBruto) {
    return (
      <section className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar os números do período agora.</p>
        <p className="text-caption text-muted mt-1">Recarregue a página em alguns segundos. Nada foi perdido.</p>
      </section>
    );
  }

  const p = panoramaBruto as Panorama;
  const n = (v: unknown) => Number(v ?? 0);

  const semMovimento = m.atendimentos_count === 0 && Number(m.faturamento) === 0 && n(p.agenda.total) === 0;

  const cabecalho = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">Resultado · {rotuloPeriodo}</p>
        <h2 className="text-[clamp(1.5rem,1.25rem+0.8vw,2rem)] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground mt-2.5">
          Como o negócio está indo.
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <span className="sr-only">Período: {ROTULO_PERIODO[preset] ?? rotuloPeriodo}</span>
        <PeriodPicker current={preset} />
      </div>
    </div>
  );

  if (semMovimento) {
    return (
      <section aria-label="Resultado do período" className="space-y-5">
        {cabecalho}
        <div className="painel p-8 sm:p-12 text-center">
          <p className="text-section-title text-foreground">Nenhum movimento neste período.</p>
          <p className="text-body-sm text-muted mt-2 max-w-md mx-auto">
            Quando atendimentos e vendas acontecerem, aqui aparecem faturamento, clientes, equipe e estoque — com os
            números reais da sua barbearia. Tente um período maior ou comece pela agenda.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link href="/agenda/novo" className={buttonClasses()}>
              Criar um agendamento
            </Link>
            <Link href="/atendimento/novo" className={buttonClasses({ variant: "secondary" })}>
              Atender agora
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Financeiro
  const faturamento = Number(m.faturamento);
  const varFat = variacao(faturamento, anterior ? Number(anterior.faturamento) : null);
  const servicos = n(p.vendas.servicos);
  const produtos = n(p.vendas.produtos);
  const pctServicos = proporcao(servicos, servicos + produtos);

  const hoje = businessToday();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const settings = (unit?.settings ?? {}) as Record<string, unknown>;
  const meta = Number(settings.meta_faturamento_mensal ?? 0);
  const ritmo = ritmoDaMeta(n(p.mes.faturamento), meta, dia, diasNoMes);

  // Clientes
  const emRisco = Array.from(comportamentos.values()).filter((c) => c.status === "atencao" || c.status === "recuperacao").length;
  const daCasa = proporcao(m.clientes_recorrentes, m.clientes_novos + m.clientes_recorrentes);

  // Equipe: só quem trabalhou ou tinha jornada no período — cadastro parado não vira linha.
  const equipe = p.equipe
    .filter((e) => n(e.capacidade_minutos) > 0 || n(e.atendimentos) > 0 || n(e.minutos_agendados) > 0)
    .map((e) => ({
      ...e,
      ocupacao: proporcao(n(e.minutos_agendados), n(e.capacidade_minutos)),
      ticket: n(e.atendimentos) > 0 ? n(e.receita) / n(e.atendimentos) : 0,
    }));
  const capacidadeTotal = equipe.reduce((s, e) => s + n(e.capacidade_minutos), 0);
  const agendadoTotal = equipe.reduce((s, e) => s + n(e.minutos_agendados), 0);
  const ocupacaoAgenda = proporcao(agendadoTotal, capacidadeTotal);

  // Agenda
  const agTotal = n(p.agenda.total);
  const faltas = n(p.agenda.nao_compareceu);
  // Comparecimento só sobre horários que já se resolveram: concluído ou falta.
  // Agendado que ainda não aconteceu não conta nem a favor nem contra.
  const comparecimento = proporcao(n(p.agenda.concluidos), n(p.agenda.concluidos) + faltas);

  return (
    <section aria-label="Resultado do período" className="space-y-5">
      {cabecalho}

      {/* FINANCEIRO — o número que a tela existe para mostrar, com contexto. */}
      <article className="painel overflow-hidden animate-rise-in">
        <div className="grid lg:grid-cols-12">
          <div className="lg:col-span-5 p-5 sm:p-7 lg:border-r border-border">
            <p className="font-subtitle text-caption text-muted">Faturamento</p>
            <p className="numero text-[clamp(2.5rem,2rem+2vw,3.5rem)] leading-none text-foreground mt-2">
              <NumeroQueChega valor={faturamento} formato="moeda" />
            </p>
            <p
              className={cn(
                "text-caption mt-2.5",
                varFat.tipo === "subiu" ? "text-success-ink" : varFat.tipo === "caiu" ? "text-danger-ink" : "text-muted"
              )}
            >
              {textoDaVariacao(varFat)}
            </p>

            <dl className="mt-6 grid grid-cols-3 gap-px bg-border border-y border-border">
              {[
                ["Recebido", formatCurrency(Number(m.receita_recebida))],
                ["Ticket médio", formatCurrency(Number(m.ticket_medio))],
                ["Vendas", String(n(p.vendas.quantidade))],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="bg-surface py-3 pr-3 [&:not(:first-child)]:pl-3 min-w-0">
                  <dt className="font-subtitle text-micro text-muted truncate">{rotulo}</dt>
                  <dd className="numero text-body text-foreground mt-1 truncate">{valor}</dd>
                </div>
              ))}
            </dl>

            {servicos + produtos > 0 && (
              <div className="mt-6">
                <div className="flex justify-between gap-3 text-caption">
                  <span className="text-foreground">
                    <span aria-hidden className="inline-block size-2 bg-chart mr-1.5" />
                    Serviços {formatCurrency(servicos)}
                  </span>
                  <span className="text-foreground">
                    <span aria-hidden className="inline-block size-2 bg-neutral-sand mr-1.5" />
                    Produtos {formatCurrency(produtos)}
                  </span>
                </div>
                <div
                  className="mt-2 flex h-2 overflow-hidden bg-surface-muted"
                  role="img"
                  aria-label={`Serviços ${pctServicos}% e produtos ${100 - (pctServicos ?? 0)}% do faturamento`}
                >
                  <span className="block h-full bg-chart origin-left animate-crescer motion-reduce:animate-none" style={{ width: `${pctServicos}%` }} />
                  <span className="block h-full bg-neutral-sand ml-0.5 flex-1" />
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-border">
              {ritmo ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-subtitle text-caption text-muted">Meta do mês</p>
                    <p className="text-caption text-foreground tabular-nums">
                      {formatCurrency(n(p.mes.faturamento))} de {formatCurrency(meta)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 bg-surface-muted" role="img" aria-label={`${ritmo.pct}% da meta do mês`}>
                    <span
                      className={cn("block h-full origin-left animate-crescer motion-reduce:animate-none", ritmo.pct >= 100 ? "bg-success" : "bg-chart")}
                      style={{ width: `${Math.min(100, ritmo.pct)}%` }}
                    />
                  </div>
                  <p className="text-caption text-muted mt-2">
                    {ritmo.falta > 0
                      ? `Faltam ${formatCurrency(ritmo.falta)}. No ritmo atual, o mês fecha em ${formatCurrency(ritmo.projecao)}.`
                      : `Meta batida. No ritmo atual, o mês fecha em ${formatCurrency(ritmo.projecao)}.`}
                  </p>
                </>
              ) : (
                <p className="text-caption text-muted">
                  Sem meta para o mês.{" "}
                  <Link href="/configuracoes#financeiro" className="text-foreground underline underline-offset-4 decoration-signal">
                    Definir meta
                  </Link>{" "}
                  para acompanhar o ritmo daqui.
                </p>
              )}
            </div>
          </div>
          <div className="lg:col-span-7 p-5 sm:p-7 border-t lg:border-t-0 border-border min-w-0">
            <RevenueChart data={serie} />
          </div>
        </div>
      </article>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* CLIENTES */}
        <article className="painel p-5 sm:p-6 animate-rise-in" style={{ animationDelay: "var(--stagger)" }}>
          <CabecalhoDoBloco titulo="Clientes" href="/clientes" acao="Ver clientes" />
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="numero text-metric text-foreground">
                <NumeroQueChega valor={n(p.clientes.ativos_90d)} />
              </p>
              <p className="text-caption text-muted mt-1">ativos nos últimos 90 dias</p>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 pb-1">
              <Fato rotulo="Novos no período" valor={String(m.clientes_novos)} />
              <Fato rotulo="Voltaram" valor={String(m.clientes_recorrentes)} />
              <Fato rotulo="Gasto médio" valor={formatCurrency(n(p.clientes.gasto_medio))} />
            </dl>
          </div>
          {daCasa !== null && (
            <p className="text-body-sm text-foreground mt-5">
              <span className="numero">{daCasa}%</span> de quem veio no período já era cliente da casa.
            </p>
          )}
          <div className="mt-5 pt-4 border-t border-border">
            {emRisco > 0 ? (
              <Link href="/clientes" className="group flex items-start justify-between gap-4">
                <span className="text-body-sm text-foreground">
                  <span aria-hidden className="inline-block size-2 bg-signal mr-2 align-middle" />
                  {emRisco} {emRisco === 1 ? "cliente está" : "clientes estão"} há mais tempo que o habitual sem voltar.
                </span>
                <span className="text-caption font-medium text-foreground whitespace-nowrap">Chamar →</span>
              </Link>
            ) : (
              <p className="text-body-sm text-muted">Ninguém passou do próprio ritmo de volta.</p>
            )}
          </div>
        </article>

        {/* EQUIPE — gestão, não ranking: ordem alfabética, sem pódio. */}
        <article className="painel p-5 sm:p-6 animate-rise-in" style={{ animationDelay: "calc(var(--stagger) * 2)" }}>
          <CabecalhoDoBloco titulo="Equipe" href="/comissoes" acao="Ver comissões" />
          {equipe.length === 0 ? (
            <p className="text-body-sm text-muted mt-4">Ninguém com jornada ou atendimento no período.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {equipe.map((e, i) => (
                <li key={e.id} className="py-3 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body-sm font-medium text-foreground truncate">{e.name.trim()}</span>
                    <span className="numero text-body-sm text-foreground shrink-0">{formatCurrency(n(e.receita))}</span>
                  </div>
                  <p className="text-caption text-muted mt-0.5 tabular-nums">
                    {n(e.atendimentos)} atend. · ticket {formatCurrency(e.ticket)} · comissão {formatCurrency(n(e.comissao))}
                  </p>
                  {e.ocupacao !== null && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex-1 h-1 bg-surface-muted" role="img" aria-label={`Agenda ${e.ocupacao}% ocupada no período`}>
                        <span
                          className="block h-full bg-signal origin-left animate-crescer motion-reduce:animate-none"
                          style={{ width: `${e.ocupacao}%`, animationDelay: `calc(${i} * var(--stagger) / 2)` }}
                        />
                      </span>
                      <span className="text-micro text-muted tabular-nums w-24 text-right">agenda {e.ocupacao}%</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* AGENDA DO PERÍODO */}
        <article className="painel p-5 sm:p-6 animate-rise-in" style={{ animationDelay: "calc(var(--stagger) * 3)" }}>
          <CabecalhoDoBloco titulo="Agenda do período" href="/agenda" acao="Abrir agenda" />
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="numero text-metric text-foreground">
                {ocupacaoAgenda === null ? "—" : <NumeroQueChega valor={ocupacaoAgenda} formato="porcento" />}
              </p>
              <p className="text-caption text-muted mt-1">
                {ocupacaoAgenda === null
                  ? "sem jornada cadastrada no período"
                  : `da capacidade agendada · ${formatarDuracao(Math.round(agendadoTotal))} de ${formatarDuracao(Math.round(capacidadeTotal))}`}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border-y border-border">
            {[
              ["Agendamentos", agTotal, ""],
              ["Concluídos", n(p.agenda.concluidos), ""],
              ["Cancelados", n(p.agenda.cancelados), n(p.agenda.cancelados) > 0 ? "text-warning-ink" : ""],
              ["Não vieram", faltas, faltas > 0 ? "text-danger-ink" : ""],
            ].map(([rotulo, valor, tom]) => (
              <div key={String(rotulo)} className="bg-surface py-3 px-3 min-w-0">
                <dt className="font-subtitle text-micro text-muted truncate">{rotulo}</dt>
                <dd className={cn("numero text-body text-foreground mt-1", String(tom))}>{String(valor)}</dd>
              </div>
            ))}
          </dl>
          {comparecimento !== null && (
            <p className="text-body-sm text-foreground mt-4">
              <span className="numero">{comparecimento}%</span> dos horários que já aconteceram tiveram o cliente presente.
            </p>
          )}
        </article>

        {/* ESTOQUE */}
        <article className="painel p-5 sm:p-6 animate-rise-in" style={{ animationDelay: "calc(var(--stagger) * 4)" }}>
          <CabecalhoDoBloco titulo="Estoque" href="/estoque" acao="Ver estoque" />
          {n(p.estoque.produtos_ativos) === 0 ? (
            <p className="text-body-sm text-muted mt-4">Nenhum produto ativo. Cadastre em Produtos para acompanhar saldo e saída.</p>
          ) : (
            <>
              <div className="mt-4">
                <p className="numero text-metric text-foreground">
                  <NumeroQueChega valor={n(p.estoque.valor_custo)} formato="moeda" />
                </p>
                <p className="text-caption text-muted mt-1">
                  em estoque pelo custo · {formatCurrency(n(p.estoque.valor_venda))} pelo preço de venda
                </p>
              </div>
              <div className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-5 pt-4 border-t border-border">
                <div>
                  <p className="font-subtitle text-caption text-muted">
                    Repor{n(p.estoque.criticos_total) > 0 ? ` · ${n(p.estoque.criticos_total)}` : ""}
                  </p>
                  {p.estoque.criticos.length === 0 ? (
                    <p className="text-body-sm text-muted mt-2">Tudo acima do mínimo.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {p.estoque.criticos.slice(0, 4).map((c) => {
                        const r = reposicao(n(c.atual), n(c.minimo));
                        return (
                          <li key={c.id} className="flex items-baseline justify-between gap-3 text-body-sm">
                            <span className="truncate text-foreground">{c.nome}</span>
                            <span className="text-caption text-warning-ink shrink-0 tabular-nums">
                              {r.tipo === "zerado" ? "zerado" : `+${r.quantidade}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-subtitle text-caption text-muted">Mais saída no período</p>
                  {p.estoque.maior_saida.length === 0 ? (
                    <p className="text-body-sm text-muted mt-2">Nenhum produto vendido.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {p.estoque.maior_saida.slice(0, 4).map((s) => (
                        <li key={s.nome} className="flex items-baseline justify-between gap-3 text-body-sm">
                          <span className="truncate text-foreground">{s.nome}</span>
                          <span className="text-caption text-muted shrink-0 tabular-nums">{n(s.quantidade)} un.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {n(p.estoque.parados_total) > 0 && (
                <p className="text-caption text-muted mt-4">
                  {n(p.estoque.parados_total)} {n(p.estoque.parados_total) === 1 ? "produto" : "produtos"} com saldo e sem venda nos
                  últimos 60 dias.
                </p>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function CabecalhoDoBloco({ titulo, href, acao }: { titulo: string; href: string; acao: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="text-section-title text-foreground">{titulo}</h3>
      <Link href={href} className="text-caption text-muted hover:text-foreground whitespace-nowrap">
        {acao} →
      </Link>
    </div>
  );
}

function Fato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="font-subtitle text-micro text-muted">{rotulo}</dt>
      <dd className="numero text-body text-foreground mt-0.5">{valor}</dd>
    </div>
  );
}
