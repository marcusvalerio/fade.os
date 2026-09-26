import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { SurfaceRow } from "@/components/ui/surface";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Checkbox } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { Kpi, Ranking } from "@/app/(app)/dashboard/blocks";
import { DateWindowNav } from "@/app/(app)/agenda/DateWindowNav";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { SeloConfirmado } from "@/components/ui/selo-confirmado";

/**
 * Telas reais do CORTEX reconstruídas para a landing.
 *
 * Cada uma segue a estrutura e os rótulos da página correspondente do
 * produto — Agenda (app/(app)/agenda/page.tsx: StatGrid, DateWindowNav,
 * linha com trilho/horário/cliente/serviço/estado/ação), Atendimento
 * (atendimento/[id], "Fechar e receber" → modal "Fechar atendimento"),
 * Caixa (caixa/CashRegisterCard.tsx: "Saldo esperado agora",
 * "Movimentações de hoje"), Comissões, Início (dashboard/blocks.tsx) e
 * Clientes (lib/crm.ts: "Costuma voltar a cada N dias"), e a página
 * pública de agendamento ([slug]/agendar/BookingWizard.tsx). Os dados são
 * de exemplo e claramente fictícios — nenhum dado real de barbearia ou
 * cliente.
 *
 * `quando(...)` marca em quais passos da história uma variação aparece —
 * o palco (StoryStage) liga/desliga por CSS, sem trocar DOM.
 */

export const DIA = "2026-09-25";

export function quando(...passos: number[]): Record<string, string> {
  const props: Record<string, string> = { "data-when": "" };
  for (const p of passos) props[`data-s${p}`] = "";
  return props;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

type Tom = "neutral" | "success" | "warning" | "danger" | "info";

type LinhaAgenda = {
  hora: string;
  duracao: number;
  cliente: string;
  servico: string;
  profissional: string;
  preco: number;
  status: string;
  tom: Tom;
  trilho?: "signal" | "warning";
  acao?: string;
};

function Trilho({ tipo }: { tipo?: "signal" | "warning" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "w-0.5 self-stretch shrink-0 rounded-full",
        tipo === "signal" ? "bg-signal" : tipo === "warning" ? "bg-warning" : "bg-transparent"
      )}
    />
  );
}

function QuemQuandoOque({ l }: { l: Pick<LinhaAgenda, "hora" | "duracao" | "cliente" | "servico" | "profissional" | "preco"> }) {
  return (
    <>
      <div className="w-12 shrink-0">
        <div className="text-body-sm tabular-nums text-foreground">{l.hora}</div>
        <div className="text-caption text-muted tabular-nums">{formatMinutes(l.duracao)}</div>
      </div>
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-foreground truncate">{l.cliente}</p>
        <p className="text-caption text-muted mt-0.5 truncate">
          {l.servico} · {l.profissional} · {formatCurrency(l.preco)}
        </p>
      </div>
    </>
  );
}

export function LinhaAgendaView({ l }: { l: LinhaAgenda }) {
  return (
    <SurfaceRow className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Trilho tipo={l.trilho} />
        <QuemQuandoOque l={l} />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Badge tone={l.tom}>{l.status}</Badge>
        {l.acao && <span className={buttonClasses({ variant: "secondary", size: "sm" })}>{l.acao}</span>}
      </div>
    </SurfaceRow>
  );
}

function TopoAgenda({ children }: { children?: React.ReactNode }) {
  return (
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-section-title text-foreground">Agenda</p>
        <span className={buttonClasses({ size: "sm" })}>Novo agendamento</span>
      </div>
      {children}
      <div className="mt-4">
        <DateWindowNav selectedDate={DIA} today={DIA} />
      </div>
    </div>
  );
}

/**
 * Agenda do Hero: o dia em andamento. O horário das 10:30 é o que o
 * cliente acabou de marcar pelo celular — entra na lista, na ordem do
 * dia, e em "Restantes hoje" quando o celular confirma.
 */
export function AgendaDoHero() {
  const antes: LinhaAgenda = { hora: "09:30", duracao: 45, cliente: "Felipe Santos", servico: "Barba Completa", profissional: "Marcus", preco: 55, status: "Em atendimento", tom: "warning", trilho: "signal" };
  const depois: LinhaAgenda = { hora: "11:15", duracao: 90, cliente: "Leandro Costa", servico: "Corte + Barba + Hidratação", profissional: "André", preco: 110, status: "Confirmado", tom: "info", acao: "Cliente chegou" };
  return (
    <>
      <TopoAgenda>
        <StatGrid className="mt-4">
          <StatTile label="Aguardando" value={0} tone="warning" />
          <StatTile label="Em atendimento" value={1} tone="signal" />
          <div className="lp-swap bg-surface">
            <div className="lp-hero-count-a">
              <StatTile label="Restantes hoje" value={1} />
            </div>
            <div className="lp-hero-count-b">
              <StatTile label="Restantes hoje" value={2} />
            </div>
          </div>
          <StatTile label="Concluídos" value={0} tone="success" />
        </StatGrid>
      </TopoAgenda>
      <div className="divide-y divide-border mt-3 border-t border-border">
        <LinhaAgendaView l={antes} />
        <div className="lp-hero-newrow">
          <div>
            <div className="lp-hero-newrow-mark">
              <LinhaAgendaView
                l={{ hora: "10:30", duracao: 60, cliente: "Thiago Rocha", servico: "Corte + Barba", profissional: "Diego", preco: 75, status: "Agendado", tom: "neutral", acao: "Confirmar" }}
              />
            </div>
          </div>
        </div>
        <LinhaAgendaView l={depois} />
      </div>
    </>
  );
}

/**
 * Agenda da história (passos 1–3). A linha de Bruno Alves muda de estado
 * como na Agenda real — Agendado → Confirmado → Em atendimento — e os
 * contadores do topo acompanham.
 */
export function AgendaDaHistoria() {
  const bruno = { hora: "09:30", duracao: 60, cliente: "Bruno Alves", servico: "Corte + Barba", profissional: "Diego", preco: 75 };
  return (
    <>
      <TopoAgenda>
        <StatGrid className="mt-4">
          <StatTile label="Aguardando" value={0} tone="warning" />
          <div className="lp-state bg-signal">
            <div className="lp-fade" {...quando(1, 2)}>
              <StatTile label="Em atendimento" value={0} tone="signal" />
            </div>
            <div className="lp-fade" {...quando(3)}>
              <StatTile label="Em atendimento" value={1} tone="signal" />
            </div>
          </div>
          <div className="lp-state bg-surface">
            <div className="lp-fade" {...quando(1, 2)}>
              <StatTile label="Restantes hoje" value={3} />
            </div>
            <div className="lp-fade" {...quando(3)}>
              <StatTile label="Restantes hoje" value={2} />
            </div>
          </div>
          <StatTile label="Concluídos" value={1} tone="success" />
        </StatGrid>
      </TopoAgenda>

      <div className="divide-y divide-border mt-3 border-t border-border">
        <LinhaAgendaView
          l={{ hora: "09:00", duracao: 30, cliente: "Rafael Mendes", servico: "Corte Social", profissional: "Marcus", preco: 45, status: "Concluído", tom: "success" }}
        />

        <div className="lp-row-focus" {...quando(1, 2, 3)}>
          <SurfaceRow className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="lp-state self-stretch">
                <span className="lp-fade flex" {...quando(1, 2)}>
                  <Trilho />
                </span>
                <span className="lp-fade flex" {...quando(3)}>
                  <Trilho tipo="signal" />
                </span>
              </div>
              <QuemQuandoOque l={bruno} />
            </div>
            <div className="lp-state justify-items-end ml-auto">
              <div className="lp-fade flex items-center gap-2" {...quando(1)}>
                <Badge tone="neutral">Agendado</Badge>
                <span className={buttonClasses({ variant: "secondary", size: "sm" })}>WhatsApp</span>
                <span className={buttonClasses({ variant: "secondary", size: "sm" })}>Confirmar</span>
              </div>
              <div className="lp-fade flex items-center gap-2" {...quando(2)}>
                <Badge tone="info">Confirmado</Badge>
                <span className={buttonClasses({ variant: "secondary", size: "sm" })}>Cliente chegou</span>
              </div>
              <div className="lp-fade flex items-center gap-2" {...quando(3)}>
                <Badge tone="warning">Em atendimento</Badge>
              </div>
            </div>
          </SurfaceRow>
        </div>

        <LinhaAgendaView
          l={{ hora: "10:30", duracao: 45, cliente: "Felipe Santos", servico: "Barba Completa", profissional: "Marcus", preco: 55, status: "Confirmado", tom: "info", acao: "Cliente chegou" }}
        />
        <LinhaAgendaView
          l={{ hora: "11:15", duracao: 90, cliente: "Leandro Costa", servico: "Corte + Barba + Hidratação", profissional: "André", preco: 110, status: "Agendado", tom: "neutral", acao: "Confirmar" }}
        />
      </div>
    </>
  );
}

/**
 * A mensagem que o botão WhatsApp da Agenda abre, montada pelo mesmo
 * texto de app/(app)/agenda/confirmation-message.ts. Sem imitar a
 * interface do aplicativo de mensagens: é a mensagem, não o app.
 */
export function MensagemPronta() {
  return (
    <div className="light rounded-lg border border-border-strong bg-surface p-4 shadow-md w-[17rem]">
      <p className="text-label uppercase text-muted">Mensagem pronta · WhatsApp</p>
      <p className="text-body-sm text-foreground mt-2.5 leading-relaxed">
        Olá, Bruno! Tudo bem?
        <br />
        Passando para confirmar seu horário na Sua Barbearia hoje às 09:30 para Corte + Barba.
        <br />
        Podemos confirmar seu atendimento?
      </p>
      <p className="text-caption text-muted mt-3">Abre a conversa com o cliente. Quem envia é você.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atendimento → fechamento
// ---------------------------------------------------------------------------

export function AtendimentoDaHistoria() {
  return (
    <div className="px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-section-title text-foreground">Bruno Alves</p>
          <p className="text-caption text-muted mt-0.5">Originado de agendamento · Diego · 09:30</p>
        </div>
        <Badge tone="warning">Em andamento</Badge>
      </div>

      <div className="mt-5 rounded-md border border-border overflow-hidden divide-y divide-border bg-surface">
        <SurfaceRow className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground">Corte + Barba</p>
            <p className="text-caption text-muted mt-0.5">Diego · 60 min</p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(75)}</span>
        </SurfaceRow>
        <SurfaceRow className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground">Pomada modeladora</p>
            <p className="text-caption text-muted mt-0.5">Produto · 1 un.</p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(37)}</span>
        </SurfaceRow>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-label uppercase text-muted">Total</p>
          <p className="text-metric text-foreground tabular-nums mt-1">{formatCurrency(112)}</p>
        </div>
        <span className={buttonClasses()}>Fechar e receber</span>
      </div>
    </div>
  );
}

/** O modal "Fechar atendimento" real, com o pagamento em dinheiro — a forma que entra na gaveta. */
export function FecharAtendimentoModal() {
  return (
    <div className="light material-elevated rounded-md w-[19rem] max-w-full p-5">
      <p className="text-section-title font-heading text-foreground mb-3">Fechar atendimento</p>
      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-body-sm text-muted">Total a receber</span>
        <span className="text-section-title text-foreground tabular-nums">{formatCurrency(112)}</span>
      </div>
      <p className="text-label uppercase text-muted mt-4">Pagamento</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 h-10 rounded-sm border border-border-strong bg-surface px-3 flex items-center justify-between text-body-sm text-foreground">
          Dinheiro
          <span aria-hidden className="text-muted text-caption">▾</span>
        </span>
        <span className="w-24 h-10 rounded-sm border border-border-strong bg-surface px-3 flex items-center justify-end text-body-sm tabular-nums text-foreground">
          112,00
        </span>
      </div>
      <p className="text-body-sm text-success-ink font-medium mt-3">Pagamento completo</p>
      <div className="mt-4 flex justify-end gap-2">
        <span className={buttonClasses({ variant: "ghost", size: "sm" })}>Voltar</span>
        <span className={buttonClasses({ size: "sm" })}>Confirmar e fechar</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Caixa + comissão
// ---------------------------------------------------------------------------

function Movimento({ tipo, hora, motivo, valor }: { tipo: string; hora: string; motivo?: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <div className="min-w-0">
        <p className="text-body-sm text-foreground">{tipo}</p>
        <p className="text-caption text-muted truncate">
          {hora}
          {motivo ? ` · ${motivo}` : ""}
        </p>
      </div>
      <span className="text-body-sm tabular-nums shrink-0 text-success-ink">+{formatCurrency(valor)}</span>
    </div>
  );
}

export function CaixaDaHistoria() {
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-md border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <p className="text-section-title text-foreground">Caixa do balcão</p>
          <Badge tone="success">aberto</Badge>
        </div>
        <div className="flex items-baseline justify-between px-5 pb-4">
          <span className="text-body-sm text-muted">Saldo esperado agora</span>
          <span className="lp-state">
            <span className="lp-fade lp-late text-metric font-heading text-foreground tabular-nums text-right" {...quando(1, 2, 3, 4)}>
              {formatCurrency(445)}
            </span>
            <span className="lp-fade lp-late text-metric font-heading text-foreground tabular-nums text-right" {...quando(5)}>
              {formatCurrency(557)}
            </span>
          </span>
        </div>
        <div className="border-t border-border">
          <p className="text-label uppercase text-muted px-5 pt-3 pb-1.5">Movimentações de hoje</p>
          <div className="divide-y divide-border">
            <div className="lp-collapse lp-late" {...quando(5)}>
              <div className="lp-row-focus lp-late" {...quando(5)}>
                <Movimento tipo="Venda" hora="10:34" valor={112} />
              </div>
            </div>
            <Movimento tipo="Venda" hora="09:41" valor={45} />
            <Movimento tipo="Suprimento" hora="08:02" motivo="troco" valor={200} />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <p className="text-label uppercase text-muted">Comissões · devido no momento</p>
        </div>
        <div className="lp-collapse lp-late" {...quando(5)}>
          <div>
            <SurfaceRow className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-foreground">Diego Ramos</p>
                <p className="text-caption text-muted mt-0.5">40% de {formatCurrency(75)} · Corte + Barba</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(30)}</span>
                <Badge tone="warning">devida</Badge>
              </div>
            </SurfaceRow>
          </div>
        </div>
        <SurfaceRow className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground">Marcus Almeida</p>
            <p className="text-caption text-muted mt-0.5">40% de {formatCurrency(45)} · Corte Social</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(18)}</span>
            <Badge tone="warning">devida</Badge>
          </div>
        </SurfaceRow>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gestão — Início e Clientes
// ---------------------------------------------------------------------------

export function InicioResumo() {
  return (
    <>
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
        <p className="text-section-title text-foreground">Início</p>
        <p className="text-caption text-muted">Últimos 7 dias</p>
      </div>
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <Kpi index={0} label="Faturamento" value={formatCurrency(12480)} current={12480} previous={10980} />
          <Kpi index={1} label="Recebido" value={formatCurrency(11200)} current={11200} previous={10500} />
          <Kpi index={2} label="Ticket médio" value={formatCurrency(78)} current={78} previous={74} />
          <Kpi index={3} label="Atendimentos" value="142" current={142} previous={131} />
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

export function ClientesRitmo() {
  const clientes: { nome: string; linha: string; status: string; tom: Tom }[] = [
    { nome: "Carlos Ribeiro", linha: "Costuma voltar a cada 30 dias — já se passaram 34.", status: "atenção", tom: "warning" },
    { nome: "Gustavo Lima", linha: "Costuma voltar a cada 25 dias — já se passaram 61.", status: "recuperação", tom: "danger" },
    { nome: "Rafael Mendes", linha: "Última visita há 12 dias.", status: "ativo", tom: "success" },
  ];
  return (
    <>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <p className="text-section-title text-foreground">Clientes</p>
        <p className="text-caption text-muted">318 cadastrados</p>
      </div>
      <div className="divide-y divide-border border-t border-border">
        {clientes.map((c) => (
          <SurfaceRow key={c.nome} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-body-sm font-medium text-foreground truncate">{c.nome}</p>
              <p className="text-caption text-muted mt-0.5">{c.linha}</p>
            </div>
            <Badge tone={c.tom}>{c.status}</Badge>
          </SurfaceRow>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Celular — página pública de agendamento e agenda do profissional
// ---------------------------------------------------------------------------

function CabecalhoAgendamento({ passo, total }: { passo: number; total: number }) {
  return (
    <>
      <p className="text-body-sm text-muted mb-1">Sua Barbearia</p>
      <p className="text-page-title text-foreground mb-5">Agendar horário</p>
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-body-sm text-muted">{passo > 1 ? "← Voltar" : ""}</span>
          <p className="text-caption text-muted tabular-nums">
            Passo {passo} de {total}
          </p>
        </div>
        <div aria-hidden className="h-1 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${(passo / total) * 100}%` }} />
        </div>
      </div>
    </>
  );
}

const SERVICOS_PUBLICOS = [
  { nome: "Corte Social", preco: 45, duracao: 30 },
  { nome: "Corte + Barba", preco: 75, duracao: 60 },
  { nome: "Barba Completa", preco: 55, duracao: 45 },
  { nome: "Pezinho", preco: 20, duracao: 15 },
];

export function AgendarServicos({ selecionado = "Corte + Barba", tapClassName }: { selecionado?: string; tapClassName?: string }) {
  const s = SERVICOS_PUBLICOS.find((x) => x.nome === selecionado);
  return (
    <div className="px-5 pt-3 pb-5">
      <CabecalhoAgendamento passo={1} total={5} />
      <p className="text-label uppercase text-muted mb-4">O que você quer fazer?</p>
      <div className="space-y-2">
        {SERVICOS_PUBLICOS.map((sv) => {
          const marcado = sv.nome === selecionado;
          return (
            <div
              key={sv.nome}
              className={cn("material-solid rounded-md p-4 flex items-start gap-3", marcado && "border-primary")}
            >
              <Checkbox checked={marcado} readOnly tabIndex={-1} className="mt-1 pointer-events-none" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body font-medium text-foreground">{sv.nome}</p>
                  <p className="text-body-sm text-foreground whitespace-nowrap">{formatCurrency(sv.preco)}</p>
                </div>
                <p className="text-caption text-muted mt-1">{formatMinutes(sv.duracao)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {s && (
        <p className="text-body-sm text-muted mt-4">
          {s.nome} · {formatMinutes(s.duracao)} · {formatCurrency(s.preco)}
        </p>
      )}
      <span className={buttonClasses({ className: cn("w-full mt-4", tapClassName) })}>Continuar</span>
    </div>
  );
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-body-sm text-muted">{rotulo}</span>
      <span className="text-body-sm text-foreground text-right">{valor}</span>
    </div>
  );
}

export function AgendamentoConfirmado({ hora = "14:30" }: { hora?: string }) {
  return (
    <div className="px-5 pt-8 pb-5 space-y-6 text-center">
      <div>
        <SeloConfirmado className="mx-auto mb-4" />
        <p className="text-page-title text-foreground">Agendamento confirmado</p>
        <p className="text-body-sm text-muted mt-1">Te esperamos em Sua Barbearia.</p>
      </div>
      <div className="material-solid rounded-md p-5 space-y-2.5 text-left">
        <LinhaResumo rotulo="Serviço" valor="Corte + Barba" />
        <LinhaResumo rotulo="Profissional" valor="Diego" />
        <LinhaResumo rotulo="Data" valor="sexta-feira, 25 de setembro" />
        <LinhaResumo rotulo="Horário" valor={hora} />
        <LinhaResumo rotulo="Duração total" valor="1h" />
      </div>
      <span className={buttonClasses({ className: "w-full" })}>Ver meu agendamento</span>
    </div>
  );
}

/** O app no celular do profissional: header escuro da barbearia + a Agenda. */
export function AgendaDoProfissional() {
  const linhas: LinhaAgenda[] = [
    { hora: "09:30", duracao: 60, cliente: "Bruno Alves", servico: "Corte + Barba", profissional: "Diego", preco: 75, status: "Em atendimento", tom: "warning", trilho: "signal" },
    { hora: "11:00", duracao: 30, cliente: "Thiago Rocha", servico: "Corte Degradê", profissional: "Diego", preco: 45, status: "Confirmado", tom: "info" },
    { hora: "14:30", duracao: 60, cliente: "Pedro Nunes", servico: "Corte + Barba", profissional: "Diego", preco: 75, status: "Agendado", tom: "neutral" },
    { hora: "16:00", duracao: 45, cliente: "Lucas Prado", servico: "Barba Completa", profissional: "Diego", preco: 55, status: "Agendado", tom: "neutral" },
  ];
  return (
    <div className="min-h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: "var(--shell-bg)", borderColor: "var(--shell-border)" }}>
        <span aria-hidden className="flex flex-col gap-[3px] text-shell-foreground">
          <span className="block h-px w-4 bg-current" />
          <span className="block h-px w-4 bg-current" />
          <span className="block h-px w-4 bg-current" />
        </span>
        <span className="text-body-sm font-medium text-shell-foreground">Sua Barbearia</span>
        <span className="ml-auto text-caption text-shell-muted">Diego</span>
      </div>
      <div className="px-5 pt-5">
        <p className="text-page-title text-foreground">Agenda</p>
        <div className="mt-4">
          <DateWindowNav selectedDate={DIA} today={DIA} />
        </div>
      </div>
      <div className="divide-y divide-border mt-4 border-t border-border">
        {linhas.map((l) => (
          <SurfaceRow key={l.hora} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Trilho tipo={l.trilho} />
              <QuemQuandoOque l={l} />
            </div>
            <Badge tone={l.tom}>{l.status}</Badge>
          </SurfaceRow>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// O sistema — um fechamento, seis lugares atualizados
// ---------------------------------------------------------------------------
//
// O que close_attendance (supabase/migrations/…_close_attendance_syncs_
// appointment_status.sql) escreve numa transação só: venda + itens,
// comissão devida, baixa do produto no estoque + movimentação, pagamento +
// movimento de caixa (dinheiro), lançamento financeiro, atendimento e
// agendamento de origem concluídos. Cada módulo abaixo é a tela onde esse
// registro aparece, antes e depois — `Troca` empilha os dois estados no
// mesmo lugar e o CSS decide qual se vê.

/** Os dois estados de um valor no mesmo lugar: `antes` sai, `depois` entra. */
export function Troca({ antes, depois, className }: { antes: React.ReactNode; depois: React.ReactNode; className?: string }) {
  return (
    <span className={cn("lp-troca", className)}>
      <span className="lp-troca-antes">{antes}</span>
      <span className="lp-troca-depois" aria-hidden>
        {depois}
      </span>
    </span>
  );
}

function CabecaModulo({ nome, onde }: { nome: string; onde: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-label uppercase text-foreground">{nome}</p>
      <p className="text-caption text-muted truncate">{onde}</p>
    </div>
  );
}

export function AtendimentoDoPulso() {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-section-title text-foreground">Bruno Alves</p>
          <p className="text-caption text-muted mt-0.5">Diego · 09:30</p>
        </div>
        <Troca antes={<Badge tone="warning">Em andamento</Badge>} depois={<Badge tone="success">Concluído</Badge>} />
      </div>
      <div className="mt-4 divide-y divide-border border-y border-border">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-body-sm text-foreground">Corte + Barba</span>
          <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(75)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-body-sm text-foreground">Pomada modeladora</span>
          <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(37)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-label uppercase text-muted">Total · dinheiro</span>
        <span className="text-metric text-foreground tabular-nums">{formatCurrency(112)}</span>
      </div>
    </>
  );
}

export const MODULOS_DO_PULSO: { chave: string; conteudo: React.ReactNode }[] = [
  {
    chave: "agenda",
    conteudo: (
      <>
        <CabecaModulo nome="Agenda" onde="sex, 25" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">09:30 · Bruno Alves</p>
            <p className="lp-pulso-detalhe text-caption text-muted truncate">Corte + Barba · Diego</p>
          </div>
          <Troca antes={<Badge tone="warning">Em atendimento</Badge>} depois={<Badge tone="success">Concluído</Badge>} />
        </div>
      </>
    ),
  },
  {
    chave: "caixa",
    conteudo: (
      <>
        <CabecaModulo nome="Caixa do balcão" onde="aberto" />
        <p className="text-caption text-muted mt-3">Saldo esperado agora</p>
        <p className="text-metric font-heading text-foreground tabular-nums mt-1">
          <Troca antes={formatCurrency(445)} depois={formatCurrency(557)} />
        </p>
        <p className="lp-pulso-detalhe text-caption mt-1.5">
          <Troca antes={<span className="text-muted">Venda 09:41 · +{formatCurrency(45)}</span>} depois={<span className="text-success-ink">Venda 10:34 · +{formatCurrency(112)}</span>} />
        </p>
      </>
    ),
  },
  {
    chave: "comissao",
    conteudo: (
      <>
        <CabecaModulo nome="Comissões" onde="devido no momento" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground">Diego Ramos</p>
            <p className="lp-pulso-detalhe text-caption text-muted">40% de {formatCurrency(75)}</p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground text-right">
            <Troca className="lp-troca-fim" antes={formatCurrency(0)} depois={formatCurrency(30)} />
          </span>
        </div>
      </>
    ),
  },
  {
    chave: "estoque",
    conteudo: (
      <>
        <CabecaModulo nome="Estoque" onde="produto" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-foreground truncate">Pomada modeladora</p>
            <p className="lp-pulso-detalhe text-caption text-muted">
              <Troca antes="Última: entrada · 12 un." depois="Venda · 1 un." />
            </p>
          </div>
          <span className="text-body-sm tabular-nums text-foreground">
            <Troca className="lp-troca-fim" antes="8 un." depois="7 un." />
          </span>
        </div>
      </>
    ),
  },
  {
    chave: "cliente",
    conteudo: (
      <>
        <CabecaModulo nome="Cliente" onde="Bruno Alves" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-caption text-muted">Última visita</p>
            <p className="text-body-sm font-medium text-foreground tabular-nums">
              <Troca antes="28 ago" depois="hoje" />
            </p>
          </div>
          <div>
            <p className="text-caption text-muted">Visitas</p>
            <p className="text-body-sm font-medium text-foreground tabular-nums">
              <Troca antes="6" depois="7" />
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    chave: "inicio",
    conteudo: (
      <>
        <CabecaModulo nome="Início" onde="últimos 7 dias" />
        <p className="text-caption text-muted mt-3">Faturamento</p>
        <p className="text-metric font-heading text-foreground tabular-nums mt-1">
          <Troca antes={formatCurrency(12368)} depois={formatCurrency(12480)} />
        </p>
      </>
    ),
  },
];

// ---------------------------------------------------------------------------
// No celular — atendimento e cliente, como o profissional vê
// ---------------------------------------------------------------------------

function HeaderCelular({ quem = "Diego" }: { quem?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: "var(--shell-bg)", borderColor: "var(--shell-border)" }}>
      <span aria-hidden className="flex flex-col gap-[3px] text-shell-foreground">
        <span className="block h-px w-4 bg-current" />
        <span className="block h-px w-4 bg-current" />
        <span className="block h-px w-4 bg-current" />
      </span>
      <span className="text-body-sm font-medium text-shell-foreground">Sua Barbearia</span>
      <span className="ml-auto text-caption text-shell-muted">{quem}</span>
    </div>
  );
}

/** Atendimento/[id] no celular: o que foi feito, o total e a ação. */
export function AtendimentoNoCelular() {
  return (
    <div className="min-h-full">
      <HeaderCelular />
      <div className="px-5 pt-5">
        <div className="lp-cel-item flex items-start justify-between gap-3" style={{ ["--n" as string]: 0 }}>
          <div className="min-w-0">
            <p className="text-page-title text-foreground">Bruno Alves</p>
            <p className="text-caption text-muted mt-1">Originado de agendamento · 09:30</p>
          </div>
          <Badge tone="warning">Em andamento</Badge>
        </div>
        <div className="mt-5 rounded-md border border-border bg-surface divide-y divide-border overflow-hidden">
          <div className="lp-cel-item flex items-center justify-between gap-3 px-4 py-3" style={{ ["--n" as string]: 1 }}>
            <div>
              <p className="text-body-sm font-medium text-foreground">Corte + Barba</p>
              <p className="text-caption text-muted mt-0.5">Diego · 60 min</p>
            </div>
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(75)}</span>
          </div>
          <div className="lp-cel-item flex items-center justify-between gap-3 px-4 py-3" style={{ ["--n" as string]: 2 }}>
            <div>
              <p className="text-body-sm font-medium text-foreground">Pomada modeladora</p>
              <p className="text-caption text-muted mt-0.5">Produto · 1 un.</p>
            </div>
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(37)}</span>
          </div>
        </div>
        <div className="lp-cel-item mt-5" style={{ ["--n" as string]: 3 }}>
          <p className="text-label uppercase text-muted">Total</p>
          <p className="text-metric text-foreground tabular-nums mt-1">{formatCurrency(112)}</p>
        </div>
        <span className={cn("lp-cel-item", buttonClasses({ className: "w-full mt-5" }))} style={{ ["--n" as string]: 4 }}>
          Fechar e receber
        </span>
      </div>
    </div>
  );
}

/** clientes/[id] no celular: os contadores, a leitura do ritmo e o histórico. */
export function ClienteNoCelular() {
  const historico = [
    { data: "25 set 26", oque: "Corte + Barba", quem: "Diego", valor: 112 },
    { data: "28 ago 26", oque: "Corte + Barba", quem: "Diego", valor: 75 },
    { data: "30 jul 26", oque: "Corte Degradê", quem: "Marcus", valor: 45 },
  ];
  return (
    <div className="min-h-full">
      <HeaderCelular />
      <div className="px-5 pt-5">
        <p className="lp-cel-item text-page-title text-foreground" style={{ ["--n" as string]: 0 }}>
          Bruno Alves
        </p>
        <div className="lp-cel-item mt-4" style={{ ["--n" as string]: 1 }}>
          <StatGrid columns={3}>
            <StatTile label="Última visita" value="hoje" />
            <StatTile label="Visitas" value={7} />
            <StatTile label="Ticket" value="R$ 71" />
          </StatGrid>
        </div>
        <div className="lp-cel-item mt-4 border-l-2 border-signal pl-3 py-0.5" style={{ ["--n" as string]: 2 }}>
          <p className="text-label uppercase text-muted">Sobre este cliente</p>
          <p className="text-body-sm text-foreground mt-0.5">
            Costuma retornar em 24–36 dias. Serviço mais frequente: corte + barba.
          </p>
        </div>
        <p className="lp-cel-item text-section-title text-foreground mt-6 mb-2" style={{ ["--n" as string]: 3 }}>
          Histórico de atendimentos
        </p>
      </div>
      <div className="divide-y divide-border border-y border-border">
        {historico.map((h, i) => (
          <div key={h.data} className="lp-cel-item flex items-baseline gap-3 px-5 py-2.5 bg-surface" style={{ ["--n" as string]: 4 + i }}>
            <span className="text-caption tabular-nums text-muted w-16 shrink-0">{h.data}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm text-foreground truncate">{h.oque}</span>
              <span className="block text-caption text-muted">{h.quem}</span>
            </span>
            <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(h.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diferenciais — o caixa que confere, quem vê o quê
// ---------------------------------------------------------------------------

/** O modal "Fechar caixa" real (caixa/CashRegisterCard.tsx), com o valor contado sendo digitado. */
export function FecharCaixaModal() {
  return (
    <div className="light material-elevated rounded-md p-5 lp-caixa-confere">
      <p className="text-section-title font-heading text-foreground">Fechar caixa</p>
      <p className="text-body-sm text-muted mt-3">
        Saldo esperado: <strong className="text-foreground">{formatCurrency(557)}</strong>
      </p>
      <p className="text-label uppercase text-muted mt-4">Valor contado</p>
      <div className="mt-1.5 h-10 rounded-sm border border-primary bg-surface px-3 flex items-center text-input tabular-nums text-foreground">
        <span className="text-muted">R$&nbsp;</span>
        <span className="lp-digita" aria-hidden />
        <span className="sr-only">550,00</span>
        <span aria-hidden className="lp-cursor-texto" />
      </div>
      <p className="text-helper text-muted mt-1.5">O que você contou na gaveta agora.</p>
      <p className="text-body-sm text-muted mt-4">
        Diferença:{" "}
        <Troca antes={<strong className="text-foreground">nenhuma</strong>} depois={<strong className="text-danger-ink">-R$&nbsp;7,00</strong>} />
      </p>
      <p className="text-label uppercase text-muted mt-4">
        <Troca antes="Observação (opcional)" depois="O que explica a diferença?" />
      </p>
    </div>
  );
}

/** A navegação real (components/app-nav.tsx) em cada papel — quem entra vê o próprio trabalho. */
export const MENU_POR_PAPEL: Record<"dono" | "recepcao" | "barbeiro", string[]> = {
  dono: ["Início", "Agenda", "Clientes", "Negócio", "Catálogo", "Equipe", "Financeiro", "Configurações"],
  recepcao: ["Agenda", "Clientes", "Negócio"],
  barbeiro: ["Agenda", "Clientes"],
};
