import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import {
  fetchDashboardComparison,
  fetchDashboardSeries,
  fetchDashboardBreakdown,
  type PeriodPreset,
} from "@/actions/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { PeriodPicker } from "./PeriodPicker";
import { RevenueChart } from "./RevenueChart";
import { Kpi, LinhaMetrica, Ranking, Proporcao, Ocupacao, Bloco, Par } from "./blocks";
import { ProximosAtendimentos } from "./ProximosAtendimentos";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const preset = (periodo as PeriodPreset) ?? "7dias";
  const current = await getCurrentCompany();
  const companyId = current!.company.id;

  // Números do negócio: só o responsável/gerente vê. Esconder o link do menu
  // para recepção/profissional não impede acesso direto pela URL — a
  // barreira real precisa estar aqui, igual já é feito em Central/Comissões.
  if (!(await isCompanyManager(companyId))) {
    return (
      <div>
        <PageHeader title="Início" />
        <Vazio
          titulo="Acesso restrito"
          descricao="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const { current: metrics, previous, period } = await fetchDashboardComparison(companyId, null, preset);

  if (!metrics) {
    return (
      <div>
        <PageHeader title="Início" />
        <p className="text-body-sm text-muted">Não foi possível carregar os indicadores agora.</p>
      </div>
    );
  }

  const [serie, breakdown] = await Promise.all([
    fetchDashboardSeries(companyId, null, period.start, period.end),
    fetchDashboardBreakdown(companyId, null, period.start, period.end),
  ]);

  const ocupacaoPct =
    metrics.ocupacao_planejada_minutos > 0
      ? Math.round((metrics.ocupacao_real_minutos / metrics.ocupacao_planejada_minutos) * 100)
      : null;

  // "Sem dados" aqui é ausência de operação no período, não erro. A página
  // inteira zerada — R$ 0,00, 0, 0%, 0 — parece sistema quebrado, então esse
  // caso ganha uma tela própria em vez de treze zeros.
  const semMovimento = metrics.atendimentos_count === 0 && metrics.faturamento === 0;

  const cabecalho = (
    <PageHeader
      title="Início"
      description={`${period.start} a ${period.end}`}
      action={<PeriodPicker current={preset} />}
    />
  );

  if (semMovimento) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <section className="material-moment p-8 sm:p-12 text-center animate-rise-in">
          <h2 className="text-page-title font-heading text-foreground">Sua operação começa aqui.</h2>
          <p className="text-body-sm text-muted mt-3 max-w-md mx-auto">
            Assim que os primeiros atendimentos acontecerem, esta tela passa a mostrar
            faturamento, tendência, ocupação da agenda e o desempenho de cada
            profissional — com os números reais da sua barbearia.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <Link href="/agenda/novo" className={buttonClasses()}>
              Criar um agendamento
            </Link>
            <Link
              href="/atendimento/novo"
              className={buttonClasses({ variant: "secondary" })}
            >
              Atender agora
            </Link>
          </div>
        </section>

        {/*
          Sem movimento no período não quer dizer sem agenda hoje: pode haver
          horário marcado para daqui a uma hora. Se houver, ele aparece — a
          tela de "comece por aqui" não pode esconder o trabalho que já existe.
        */}
        <ProximosAtendimentos companyId={companyId} />

        {/* O que já existe de fato continua visível, para a tela não mentir
            dizendo que não há nada no sistema. */}
        {(metrics.estoque_critico_count > 0 || metrics.caixa_saldo_atual > 0) && (
          <Bloco titulo="Enquanto isso">
            <div className="divide-y divide-border">
              {metrics.caixa_saldo_atual > 0 && (
                <LinhaMetrica label="Caixa aberto" value={formatCurrency(metrics.caixa_saldo_atual)} />
              )}
              {metrics.estoque_critico_count > 0 && (
                <LinhaMetrica
                  label="Estoque crítico"
                  value={String(metrics.estoque_critico_count)}
                  tom="atencao"
                  detalhe="itens no ou abaixo do mínimo"
                />
              )}
            </div>
          </Bloco>
        )}
      </div>
    );
  }

  const atencao = [
    metrics.cancelamentos_count > 0 && {
      label: "Cancelamentos",
      value: String(metrics.cancelamentos_count),
    },
    metrics.no_show_count > 0 && { label: "No-show", value: String(metrics.no_show_count) },
    metrics.estoque_critico_count > 0 && {
      label: "Estoque crítico",
      value: String(metrics.estoque_critico_count),
      detalhe: "itens no ou abaixo do mínimo",
    },
    metrics.estornos > 0 && { label: "Estornos", value: formatCurrency(metrics.estornos) },
  ].filter(Boolean) as { label: string; value: string; detalhe?: string }[];

  return (
    <div className="space-y-6">
      {cabecalho}

      {/*
        A ordem responde à pergunta de quem abre o sistema de manhã, e ela
        mudou: antes a tela começava pelo faturamento do período — a resposta
        do fim do mês. Agora começa pelo que está acontecendo e pelo que vem
        a seguir, e só depois conta como o período foi.

        1. o que está acontecendo agora   ← ProximosAtendimentos
        2. o que vem depois
        3. como está o dia                ← os quatro números
        4. como está evoluindo
        5. onde existe atenção
      */}
      <ProximosAtendimentos companyId={companyId} />

      {/* 3. Como está o dia — Faturamento responde primeiro, os outros três
          são a conta que sustenta a resposta, não uma segunda opinião do
          mesmo peso (R23.1: quatro colunas iguais liam como "grade de
          KPIs de dashboard", nunca como uma resposta com uma pergunta. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] py-6 border-y border-border">
        <Kpi
          dominante
          index={0}
          label="Faturamento"
          value={formatCurrency(metrics.faturamento)}
          current={metrics.faturamento}
          previous={previous?.faturamento}
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 content-center">
          <Kpi
            index={1}
            label="Recebido"
            value={formatCurrency(metrics.receita_recebida)}
            current={metrics.receita_recebida}
            previous={previous?.receita_recebida}
          />
          <Kpi
            index={2}
            label="Ticket médio"
            value={formatCurrency(metrics.ticket_medio)}
            current={metrics.ticket_medio}
            previous={previous?.ticket_medio}
          />
          <Kpi
            index={3}
            label="Atendimentos"
            value={String(metrics.atendimentos_count)}
            current={metrics.atendimentos_count}
            previous={previous?.atendimentos_count}
          />
        </div>
      </div>

      {/* 2. Como está evoluindo — o protagonista. */}
      <RevenueChart data={serie} />

      {/* 3. Como está a operação — uma superfície, duas leituras (R23.1). */}
      <Par
        esquerda={
          <Ocupacao
            pct={ocupacaoPct}
            detalhe={
              ocupacaoPct !== null
                ? `${formatMinutes(Math.round(metrics.ocupacao_real_minutos))} atendidos de ${formatMinutes(
                    Math.round(metrics.ocupacao_planejada_minutos)
                  )} disponíveis`
                : ""
            }
          />
        }
        direita={
          <Proporcao
            titulo="Clientes no período"
            foco={metrics.clientes_novos}
            focoLabel="novos"
            resto={metrics.clientes_recorrentes}
            restoLabel="recorrentes"
          />
        }
      />

      {/* 4. Quem e o quê está performando. */}
      <Par
        esquerda={
          <>
            <p className="text-label uppercase text-muted mb-3">Serviços mais realizados</p>
            <Ranking
              vazio="Nenhum serviço concluído no período."
              itens={breakdown.servicos.map((s) => ({
                nome: s.name,
                valor: s.quantidade,
                rotulo: `${s.quantidade}×`,
                secundario: formatCurrency(Number(s.receita)),
              }))}
            />
          </>
        }
        direita={
          <>
            <p className="text-label uppercase text-muted mb-3">Desempenho da equipe</p>
            <Ranking
              vazio="Nenhum atendimento atribuído no período."
              itens={breakdown.equipe.map((p) => ({
                nome: p.name,
                valor: Number(p.receita),
                rotulo: formatCurrency(Number(p.receita)),
                secundario: `${p.atendimentos}×`,
              }))}
            />
          </>
        }
      />

      {/* 5. Onde existe atenção — ganha peso próprio quando tem algo a
          dizer, em vez de dividir uma caixa igual com o Financeiro. */}
      {atencao.length > 0 && (
        <Bloco titulo="Atenção" className="border-l-2 border-l-warning-ink">
          <div className="divide-y divide-border">
            {atencao.map((item) => (
              <LinhaMetrica
                key={item.label}
                label={item.label}
                value={item.value}
                detalhe={item.detalhe}
                tom="atencao"
              />
            ))}
          </div>
        </Bloco>
      )}
      <Bloco titulo="Financeiro do período">
        <div className="divide-y divide-border">
          <LinhaMetrica label="Comissões" value={formatCurrency(metrics.comissoes_total)} />
          <LinhaMetrica label="Caixa aberto agora" value={formatCurrency(metrics.caixa_saldo_atual)} />
          <LinhaMetrica
            label="Clientes novos"
            value={String(metrics.clientes_novos)}
            detalhe="primeiro atendimento concluído no período"
          />
        </div>
      </Bloco>
    </div>
  );
}
