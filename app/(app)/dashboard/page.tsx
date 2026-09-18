import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { requireAuthenticatedUser } from "@/lib/tenancy";
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
import { businessToday, formatBusinessDayLabel, formatBusinessDate } from "@/lib/time";
import { PeriodPicker } from "./PeriodPicker";
import { RevenueChart } from "./RevenueChart";
import { Kpi, LinhaMetrica, Ranking, Proporcao, Ocupacao, Bloco, Campo, Par } from "./blocks";
import { ProximosAtendimentos } from "./ProximosAtendimentos";

/**
 * P1.3 — contexto mínimo, não mais um momento editorial. A saudação
 * respondia "o que está acontecendo hoje" antes de qualquer número, mas
 * ocupava a mesma presença visual do resultado que a tela existe para
 * mostrar — um card escuro de tela cheia com formas em Sunny Yellow, a
 * cor reservada para ação/estado ativo, nunca para decoração de abertura.
 * Vira uma linha de texto: contexto, não protagonista.
 */
function ContextoDoDia({ nome, rotuloDia }: { nome: string; rotuloDia: string }) {
  const hora = Number(formatBusinessDate(new Date(), { hour: "numeric", hour12: false }));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <p className="text-body-sm text-muted">
      <span className="text-foreground font-medium">
        {saudacao}, {nome}.
      </span>{" "}
      {rotuloDia}
    </p>
  );
}

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

  const user = await requireAuthenticatedUser();
  const nomeCompleto = user.name || "";
  const primeiroNome = nomeCompleto.split(/\s+/)[0] || "";
  const rotuloDia = formatBusinessDayLabel(businessToday(), {
    weekday: "long",
    day: "2-digit",
    month: "long",
  })
    .replace("-feira", "")
    .toUpperCase();

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
    metrics.no_show_count > 0 && { label: "Não compareceu", value: String(metrics.no_show_count) },
    metrics.estoque_critico_count > 0 && {
      label: "Estoque crítico",
      value: String(metrics.estoque_critico_count),
      detalhe: "itens no ou abaixo do mínimo",
    },
    metrics.estornos > 0 && { label: "Estornos", value: formatCurrency(metrics.estornos) },
  ].filter(Boolean) as { label: string; value: string; detalhe?: string }[];

  return (
    <div className="space-y-10">
      {/* 1. CONTEXTO MÍNIMO — P1.3: era um hero de tela cheia; agora é uma
          linha. O período do relatório mora ao lado, na mesma linha, em
          vez de dividir uma segunda faixa própria. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <ContextoDoDia nome={primeiroNome || "Responsável"} rotuloDia={rotuloDia} />
        <PeriodPicker current={preset} />
      </div>

      {/*
        2. RESULTADO — indicadores financeiros primeiro (P1.3: RESULTADO
        antes de OPERAÇÃO). Faturamento não é "um quarto de uma grade": é
        a resposta que a tela existe para dar, com presença editorial de
        verdade (Supreme, tamanho de manchete); os outros três ficam ao
        lado, pequenos de propósito.
      */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        <Kpi
          dominante
          index={0}
          label="Faturamento"
          value={formatCurrency(metrics.faturamento)}
          current={metrics.faturamento}
          previous={previous?.faturamento}
        />
        <div className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end lg:pb-1">
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

      {/* 3. OPERAÇÃO — a agenda, logo depois do resultado e acima de
          Atenção (P1.3). */}
      <ProximosAtendimentos companyId={companyId} />

      {/* LEITURA — como o resultado se comportou, e o que sustenta ele
          operacionalmente. O gráfico é a voz principal; ocupação e
          clientes são a leitura secundária da mesma pergunta. */}
      <RevenueChart data={serie} />

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

      {/* Quem e o quê sustentou o resultado. */}
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

      {/* ATENÇÃO — o único momento que ainda ganha uma superfície fechada
          de verdade, porque precisa PARECER um momento que pede atenção. */}
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

      {/* AÇÃO / fechamento — o resultado financeiro que fecha o período. */}
      <Campo titulo="Financeiro do período">
        <div className="divide-y divide-border">
          <LinhaMetrica label="Comissões" value={formatCurrency(metrics.comissoes_total)} />
          <LinhaMetrica label="Caixa aberto agora" value={formatCurrency(metrics.caixa_saldo_atual)} />
          <LinhaMetrica
            label="Clientes novos"
            value={String(metrics.clientes_novos)}
            detalhe="primeiro atendimento concluído no período"
          />
        </div>
      </Campo>
    </div>
  );
}
