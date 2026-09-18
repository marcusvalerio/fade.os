import { SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Kpi, Ranking } from "@/app/(app)/dashboard/blocks";
import { DateWindowNav } from "@/app/(app)/agenda/DateWindowNav";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatMinutes } from "@/lib/format";

/**
 * Painéis da Landing (app/Landing.tsx) — reaproveitados também pelo Live
 * Product Preview do Hero (app/HeroProductPreview.tsx). Vivem num módulo
 * próprio, sem "use client", para que as seções estáticas continuem
 * renderizadas no servidor; o Hero (client, animado) importa o CONTEÚDO de
 * cada tela (as funções `*Conteudo`) e monta o próprio crossfade por cima,
 * sem duplicar nenhuma dessas estruturas.
 *
 * Cada painel reproduz a estrutura real da página correspondente do
 * produto (Surface/SurfaceRow/Badge/Kpi/Ranking/DateWindowNav reais) com
 * dados de exemplo plausíveis e claramente fictícios — nunca dados reais
 * de cliente nenhum.
 */

export function JanelaChrome() {
  return (
    <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-border bg-surface-context">
      <span aria-hidden className="size-2 rounded-full bg-border-strong" />
      <span aria-hidden className="size-2 rounded-full bg-border-strong" />
      <span aria-hidden className="size-2 rounded-full bg-border-strong" />
    </div>
  );
}

export function PainelBase({
  titulo,
  acessorio,
  children,
  elevado = false,
}: {
  titulo: string;
  acessorio?: string;
  children: React.ReactNode;
  elevado?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border border-border-strong bg-surface overflow-hidden shadow-md" +
        (elevado ? " scale-[1.02]" : "")
      }
    >
      <JanelaChrome />
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <p className="text-label uppercase text-muted">{titulo}</p>
        {acessorio && <p className="text-caption text-muted">{acessorio}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * ÍNICIO real (app/(app)/dashboard) — reaproveita os componentes de
 * apresentação `Kpi` e `Ranking` de app/(app)/dashboard/blocks.tsx.
 *
 * `valores`: no uso estático (PainelDashboard) fica de fora e os quatro
 * KPIs mostram direto os números finais. O Live Product Preview passa os
 * valores já animando (count-up) — por isso a contagem em si não mora
 * aqui: `DashboardConteudo` só recebe números prontos, sem hook nenhum,
 * para este módulo continuar 100% renderizável no servidor.
 */
const FATURAMENTO = 12480;
const RECEBIDO = 11200;
const TICKET_MEDIO = 78;
const ATENDIMENTOS = 142;

export function DashboardConteudo({
  valores,
}: {
  valores?: { faturamento: number; recebido: number; ticketMedio: number; atendimentos: number };
} = {}) {
  const v = valores ?? {
    faturamento: FATURAMENTO,
    recebido: RECEBIDO,
    ticketMedio: TICKET_MEDIO,
    atendimentos: ATENDIMENTOS,
  };
  return (
    <>
      {/* Sem `dominante`: a tipografia de manchete do Kpi (até 4rem) foi
          desenhada para a largura cheia da página do Início — neste
          cartão, mais estreito em qualquer viewport, ela truncava
          ("R$ 12.48…"). 2 colunas (1 no mobile): 4 não cabia em nenhuma
          largura validada (320–1440px) com `sm:text-metric`. */}
      <div className="px-5 pt-6 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <Kpi index={0} label="Faturamento" value={formatCurrency(v.faturamento)} current={FATURAMENTO} previous={10980} />
          <Kpi index={1} label="Recebido" value={formatCurrency(v.recebido)} current={RECEBIDO} previous={10500} />
          <Kpi index={2} label="Ticket médio" value={formatCurrency(v.ticketMedio)} current={TICKET_MEDIO} previous={74} />
          <Kpi index={3} label="Atendimentos" value={String(v.atendimentos)} current={ATENDIMENTOS} previous={131} />
        </div>
      </div>
      <div className="border-t border-border px-5 py-5">
        <p className="text-label uppercase text-muted mb-3">Serviços mais realizados</p>
        <Ranking
          vazio=""
          itens={[
            { nome: "Corte + Barba", valor: 58, rotulo: "58×", secundario: formatCurrency(4350) },
            { nome: "Corte Degradê", valor: 41, rotulo: "41×", secundario: formatCurrency(1845) },
            { nome: "Barba Completa", valor: 23, rotulo: "23×", secundario: formatCurrency(1265) },
          ]}
        />
      </div>
    </>
  );
}

export function PainelDashboard() {
  return (
    <PainelBase titulo="Início · últimos 7 dias" acessorio="Terça a segunda">
      <DashboardConteudo />
    </PainelBase>
  );
}

/**
 * AGENDA real — `DateWindowNav` é o componente de produção
 * (app/(app)/agenda/DateWindowNav.tsx), a mesma janela de 7 dias da tela
 * autenticada. As linhas abaixo reproduzem a estrutura exata de
 * app/(app)/agenda/page.tsx (trilho · horário/duração · cliente ·
 * serviço/profissional/preço · estado · ação) com `SurfaceRow`/`Badge`
 * reais, sem recriar o visual à parte.
 */
export const AGENDA_LINHAS = [
  { hora: "09:00", duracao: 30, cliente: "Rafael Mendes", servico: "Corte Social", profissional: "Marcus", preco: 45, status: "Confirmado", tone: "info" as const, acao: "Cliente chegou" },
  { hora: "09:30", duracao: 60, cliente: "Bruno Alves", servico: "Corte + Barba", profissional: "Diego", preco: 75, status: "Aguardando", tone: "warning" as const, acao: "Iniciar atendimento", trilho: "warning" as const },
  { hora: "10:30", duracao: 45, cliente: "Felipe Santos", servico: "Barba Completa", profissional: "Marcus", preco: 55, status: "Em atendimento", tone: "warning" as const, trilho: "signal" as const },
  { hora: "11:15", duracao: 90, cliente: "Leandro Costa", servico: "Corte + Barba + Hidratação", profissional: "André", preco: 110, status: "Agendado", tone: "neutral" as const },
];

export function AgendaConteudo({ selectedDate }: { selectedDate: string }) {
  return (
    <>
      <div className="px-4 pt-4">
        <DateWindowNav selectedDate={selectedDate} today={selectedDate} />
      </div>
      <div className="divide-y divide-border mt-1">
        {AGENDA_LINHAS.map((l) => (
          <SurfaceRow key={l.hora} className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                className={
                  "w-0.5 self-stretch shrink-0 rounded-full " +
                  (l.trilho === "signal" ? "bg-signal" : l.trilho === "warning" ? "bg-warning" : "bg-transparent")
                }
              />
              <div className="w-14 shrink-0">
                <div className="text-body-sm tabular-nums text-foreground">{l.hora}</div>
                <div className="text-caption text-muted tabular-nums">{formatMinutes(l.duracao)}</div>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{l.cliente}</p>
                <p className="text-caption text-muted mt-0.5 truncate">
                  {l.servico} · {l.profissional} · {formatCurrency(l.preco)}
                </p>
              </div>
            </div>
            <div className="flex items-center flex-wrap justify-end gap-2 min-w-0 shrink">
              <Badge tone={l.tone}>{l.status}</Badge>
              {l.acao && (
                <span className={buttonClasses({ variant: l.acao === "Cliente chegou" ? "primary" : "secondary", size: "sm" })}>
                  {l.acao}
                </span>
              )}
            </div>
          </SurfaceRow>
        ))}
      </div>
    </>
  );
}

export function PainelAgenda() {
  return (
    <PainelBase titulo="Agenda · hoje" acessorio="Sexta-feira">
      <AgendaConteudo selectedDate="2026-09-18" />
    </PainelBase>
  );
}

/**
 * ATENDIMENTO — duas telas reais: a lista (app/(app)/atendimento/page.tsx)
 * e o recorte de um atendimento aberto com seus itens
 * (app/(app)/atendimento/[id]/page.tsx), até o subtotal.
 */
export function PainelListaAtendimentos() {
  return (
    <PainelBase titulo="Atendimentos">
      <div className="divide-y divide-border">
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Marcos Ferreira</p>
            <p className="text-caption text-muted mt-0.5">Originado de agendamento</p>
          </div>
          <Badge tone="warning">Em andamento</Badge>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Renato Alves</p>
            <p className="text-caption text-muted mt-0.5">Walk-in</p>
          </div>
          <Badge tone="success">Concluído</Badge>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Diego Souza</p>
            <p className="text-caption text-muted mt-0.5">Originado de agendamento</p>
          </div>
          <Badge tone="success">Concluído</Badge>
        </SurfaceRow>
      </div>
    </PainelBase>
  );
}

export function AtendimentoAbertoConteudo() {
  return (
    <>
      <div className="divide-y divide-border">
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Corte masculino</p>
            <p className="text-caption text-muted mt-0.5">Marcus · 30 min</p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground shrink-0">{formatCurrency(45)}</span>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Barba</p>
            <p className="text-caption text-muted mt-0.5">Marcus · 20 min</p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground shrink-0">{formatCurrency(35)}</span>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Pomada modeladora</p>
            <p className="text-caption text-muted mt-0.5">Produto</p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground shrink-0">{formatCurrency(37)}</span>
        </SurfaceRow>
      </div>
      <div className="border-t border-border px-5 py-4 bg-surface-context flex items-center justify-between">
        <p className="text-label uppercase text-muted">Subtotal</p>
        <p className="text-section-title text-foreground tabular-nums">{formatCurrency(117)}</p>
      </div>
    </>
  );
}

export function PainelAtendimentoAberto() {
  return (
    <PainelBase titulo="Atendimento · Marcos Ferreira" acessorio="Em andamento">
      <AtendimentoAbertoConteudo />
    </PainelBase>
  );
}

/**
 * DINHEIRO — o bloco "Resultado do período" é a mesma composição de
 * app/(app)/financeiro/page.tsx (material-elevado, Entradas/Saídas
 * derivadas do resultado); a linha final é a mesma leitura de
 * app/(app)/caixa/page.tsx.
 */
export function DinheiroConteudo() {
  return (
    <>
      <div className="p-5">
        <p className="text-label uppercase text-muted">Resultado do período</p>
        <p className="text-[1.75rem] leading-none font-heading font-semibold tracking-[-0.01em] sm:text-metric tabular-nums mt-1.5 text-foreground">
          {formatCurrency(9840)}
        </p>
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
          <div>
            <p className="text-label uppercase text-muted">Entradas</p>
            <p className="text-section-title text-success-ink mt-0.5 tabular-nums">{formatCurrency(12480)}</p>
          </div>
          <div>
            <p className="text-label uppercase text-muted">Saídas</p>
            <p className="text-section-title text-danger-ink mt-0.5 tabular-nums">{formatCurrency(2640)}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-border px-5 py-3.5 bg-surface-context flex items-center justify-between">
        <p className="text-caption text-muted">Caixa aberto · 14 vendas hoje</p>
        <p className="text-caption text-foreground tabular-nums">{formatCurrency(1860)} em caixa</p>
      </div>
    </>
  );
}

export function PainelDinheiro() {
  return (
    <PainelBase titulo="Financeiro · período">
      <DinheiroConteudo />
    </PainelBase>
  );
}

/**
 * EQUIPE — mesma composição de app/(app)/comissoes/page.tsx: "Devido no
 * momento" (material-elevado) + lista com percentual/base/status.
 */
export function PainelEquipe() {
  return (
    <PainelBase titulo="Comissões">
      <div className="p-5">
        <p className="text-label uppercase text-muted">Devido no momento</p>
        <p className="text-metric text-foreground tabular-nums mt-1.5">{formatCurrency(1180)}</p>
      </div>
      <div className="divide-y divide-border">
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Marcus Almeida</p>
            <p className="text-caption text-muted mt-0.5">40% de {formatCurrency(150)} · 17 set.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(60)}</span>
            <Badge tone="warning">devida</Badge>
          </div>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Diego Ramos</p>
            <p className="text-caption text-muted mt-0.5">35% de {formatCurrency(75)} · 17 set.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(26.25)}</span>
            <Badge tone="success">paga</Badge>
          </div>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">André Souza</p>
            <p className="text-caption text-muted mt-0.5">40% de {formatCurrency(110)} · 16 set.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(44)}</span>
            <Badge tone="warning">devida</Badge>
          </div>
        </SurfaceRow>
      </div>
    </PainelBase>
  );
}

/**
 * CLIENTES — mesma leitura de app/(app)/clientes/page.tsx: nome, última
 * visita/telefone e o estado de relacionamento (ativo/atenção/recuperação).
 */
export function PainelClientes() {
  return (
    <PainelBase titulo="Clientes">
      <div className="divide-y divide-border">
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Rafael Mendes</p>
            <p className="text-caption text-muted mt-0.5">última visita 12 set.</p>
          </div>
          <Badge tone="success">ativo</Badge>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Carlos Ribeiro</p>
            <p className="text-caption text-muted mt-0.5">Costuma voltar a cada 30 dias — já se passaram 34.</p>
          </div>
          <Badge tone="warning">atenção</Badge>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Gustavo Lima</p>
            <p className="text-caption text-muted mt-0.5">Costuma voltar a cada 25 dias — já se passaram 61.</p>
          </div>
          <Badge tone="danger">recuperação</Badge>
        </SurfaceRow>
      </div>
    </PainelBase>
  );
}

/**
 * CATÁLOGO — mesma leitura de app/(app)/servicos/page.tsx: nome, preço e
 * duração planejada. Produtos/estoque seguem o mesmo catálogo (nota abaixo
 * do painel), sem inventar uma segunda tela para caber tudo.
 */
export function PainelCatalogo() {
  return (
    <>
      <PainelBase titulo="Serviços">
        <div className="divide-y divide-border">
          <SurfaceRow className="flex items-center justify-between gap-3">
            <p className="text-body-sm font-medium text-foreground truncate">Corte Social</p>
            <p className="text-caption text-muted shrink-0">
              {formatCurrency(45)} · {formatMinutes(30)}
            </p>
          </SurfaceRow>
          <SurfaceRow className="flex items-center justify-between gap-3">
            <p className="text-body-sm font-medium text-foreground truncate">Corte + Barba</p>
            <p className="text-caption text-muted shrink-0">
              {formatCurrency(75)} · {formatMinutes(60)}
            </p>
          </SurfaceRow>
          <SurfaceRow className="flex items-center justify-between gap-3">
            <p className="text-body-sm font-medium text-foreground truncate">Barba Completa</p>
            <p className="text-caption text-muted shrink-0">
              {formatCurrency(55)} · {formatMinutes(45)}
            </p>
          </SurfaceRow>
        </div>
      </PainelBase>
      <p className="text-caption text-muted mt-3">
        Produtos e estoque seguem o mesmo catálogo — preço, custo e saldo mínimo por item.
      </p>
    </>
  );
}
