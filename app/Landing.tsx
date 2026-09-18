import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Kpi, Ranking } from "@/app/(app)/dashboard/blocks";
import { DateWindowNav } from "@/app/(app)/agenda/DateWindowNav";
import { formatCurrency, formatMinutes } from "@/lib/format";

/**
 * Landing pública do CORTEX.OS — apresentação editorial do produto.
 *
 * Reescrita (pós-Figma Make): a versão anterior ainda explicava o sistema —
 * headline forte, mas a prova visual era um card de Agenda repetido e uma
 * lista de seis áreas em texto. Isso deixava a página "falando sobre"
 * operação, não "mostrando" operação.
 *
 * Esta versão substitui toda explicação por telas: cada seção reaproveita os
 * componentes REAIS do produto (Kpi/Ranking do Início, DateWindowNav da
 * Agenda, SurfaceRow/Badge usados em toda a operação) com dados de exemplo
 * plausíveis e claramente fictícios — nunca dados reais de cliente nenhum,
 * nunca um mockup desenhado à parte para "parecer" o produto. Onde um
 * componente real existe e é seguro reaproveisar (sem autenticação, sem
 * busca ao banco), ele é importado e usado tal como é — não redesenhado.
 */
export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="shell flex items-center justify-between py-4">
          <Wordmark tamanho="sm" />
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main>
        {/* HERO — mensagem forte à esquerda, o ÍNICIO real do produto à
            direita, em escala de protagonista. Não é mais um recorte de
            Agenda: é a tela que responde "o que é o CORTEX" antes de
            qualquer palavra — indicadores, tendência, o que a operação
            produziu. */}
        <section className="relative overflow-hidden bg-[var(--neutral-ink)] text-[var(--neutral-bone)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 lg:-right-10 lg:-top-32 size-[38rem] rounded-full blur-3xl motion-reduce:blur-2xl"
            style={{ background: "radial-gradient(circle, rgb(0 147 214 / 45%), transparent 70%)" }}
          />

          <div className="shell relative py-20 sm:py-28">
            <Reveal>
              <p className="text-label uppercase tracking-[0.14em]" style={{ color: "rgb(232 230 221 / 62%)" }}>
                CORTEX.OS · Sistema operacional para barbearias
              </p>
            </Reveal>
            <Reveal delayMs={80}>
              <h1 className="font-heading font-semibold text-[2.75rem] sm:text-[4.5rem] lg:text-[4rem] leading-[0.96] tracking-[-0.02em] mt-4 max-w-2xl">
                A operação inteira da sua barbearia.
                <br />
                Finalmente, em um só lugar.
              </h1>
            </Reveal>
            <Reveal delayMs={160}>
              <p className="text-body-sm sm:text-body mt-7 max-w-lg" style={{ color: "rgb(232 230 221 / 78%)" }}>
                Agenda, atendimento, venda, caixa, comissão, clientes e catálogo — um sistema só,
                do cliente que chega até o dinheiro que fecha o dia.
              </p>
            </Reveal>
            <Reveal delayMs={240}>
              <div className="mt-9">
                <Link href="/beta" className={buttonClasses({ size: "md" })}>
                  SOLICITAR ACESSO AO BETA
                </Link>
              </div>
            </Reveal>

            <Reveal delayMs={320} className="mt-14">
              <div className="lg:max-w-4xl lg:ml-auto">
                <PainelDashboard />
              </div>
            </Reveal>
          </div>
        </section>

        {/* AGENDA — texto acima, tela grande abaixo, ocupando quase toda a
            largura: a Agenda é uma parte do sistema, mostrada por inteiro,
            não um recorte pequeno espremido ao lado de um parágrafo. Usa o
            DateWindowNav real (a evolução visual já implementada), não uma
            versão anterior. */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-24">
            <Reveal className="max-w-lg mb-10">
              <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Agenda</p>
              <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] text-foreground">
                Uma agenda que acompanha a operação.
              </h2>
              <p className="text-body-sm text-muted mt-3">
                Navegação por dia, duração e preço de cada serviço, estado de cada atendimento —
                sem virar a tela inteira do sistema.
              </p>
            </Reveal>
            <Reveal delayMs={120}>
              <PainelAgenda />
            </Reveal>
          </div>
        </section>

        {/* FILA/ATENDIMENTO — duas telas relacionadas lado a lado: a lista de
            atendimentos (o que está em andamento) e o recorte de um
            atendimento aberto (os itens que compõem o valor). Mostra a
            transformação agendamento → operação sem inventar uma tela de
            fila com timer/reordenação (ainda não existe no CORTEX real). */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-24">
            <Reveal className="max-w-lg mb-10">
              <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Atendimento</p>
              <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] text-foreground">
                O agendamento vira atendimento, sem perder o fio.
              </h2>
              <p className="text-body-sm text-muted mt-3">
                Cada atendimento em andamento, com os serviços e produtos que compõem o valor
                final — a mesma tela que a barbearia usa no balcão.
              </p>
            </Reveal>
            <div className="grid lg:grid-cols-[2fr_3fr] gap-6 items-start">
              <Reveal delayMs={120}>
                <PainelListaAtendimentos />
              </Reveal>
              <Reveal delayMs={180}>
                <PainelAtendimentoAberto />
              </Reveal>
            </div>
          </div>
        </section>

        {/* DINHEIRO — tela à esquerda, texto à direita (ritmo invertido do
            resto): o resultado financeiro é a resposta, então entra primeiro
            no olhar. Financeiro (resultado do período) + Caixa (a gaveta),
            as duas telas reais que fecham o ciclo. */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-24">
            <div className="grid lg:grid-cols-[3fr_2fr] gap-10 items-center">
              <Reveal>
                <PainelDinheiro />
              </Reveal>
              <Reveal delayMs={120}>
                <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Financeiro · Caixa</p>
                <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] text-foreground">
                  O que acontece na operação também aparece nos números.
                </h2>
                <p className="text-body-sm text-muted mt-3">
                  Agenda, atendimento e venda terminam no mesmo lugar: o resultado do período e o
                  saldo da gaveta, sempre batendo com o que realmente aconteceu.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* EQUIPE — a tela real de Comissões (não mais um mockup à parte):
            o que está devido agora, por profissional. */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-24">
            <div className="grid lg:grid-cols-[2fr_3fr] gap-10 items-center">
              <Reveal>
                <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Equipe</p>
                <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] text-foreground">
                  Sua equipe também faz parte da operação.
                </h2>
                <p className="text-body-sm text-muted mt-3">
                  Cada atendimento fechado gera a comissão automaticamente — o profissional sabe
                  o que já está devido, sem planilha à parte.
                </p>
              </Reveal>
              <Reveal delayMs={120}>
                <PainelEquipe />
              </Reveal>
            </div>
          </div>
        </section>

        {/* CLIENTES + CATÁLOGO — composição compacta, duas telas menores
            lado a lado: relacionamento com o cliente e o que a barbearia
            vende, sem precisar de uma seção inteira para cada uma. */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-24">
            <Reveal className="max-w-lg mb-10">
              <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Clientes · Catálogo</p>
              <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] text-foreground">
                Clientes e catálogo, sempre à mão.
              </h2>
              <p className="text-body-sm text-muted mt-3">
                Quem precisa voltar a ligar, e o que a barbearia vende — preço e duração de cada
                serviço, prontos para agendar.
              </p>
            </Reveal>
            <div className="grid lg:grid-cols-2 gap-6">
              <Reveal delayMs={120}>
                <PainelClientes />
              </Reveal>
              <Reveal delayMs={180}>
                <PainelCatalogo />
              </Reveal>
            </div>
          </div>
        </section>

        {/* BETA — acesso limitado, desejo de entrada. */}
        <section className="bg-[var(--neutral-ink)] text-[var(--neutral-bone)]">
          <div className="shell py-20 sm:py-24 text-center">
            <Reveal>
              <p className="text-label uppercase tracking-[0.14em]" style={{ color: "rgb(232 230 221 / 62%)" }}>
                CORTEX.OS BETA
              </p>
            </Reveal>
            <Reveal delayMs={80}>
              <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] mt-3">
                Acesso limitado, com cada barbearia acompanhada de perto.
              </h2>
            </Reveal>
            <Reveal delayMs={160}>
              <p className="text-body-sm mt-3 max-w-md mx-auto" style={{ color: "rgb(232 230 221 / 72%)" }}>
                Você pode entrar antes do lançamento. Solicite acesso e conversamos sobre a sua
                barbearia.
              </p>
            </Reveal>
            <Reveal delayMs={240}>
              <div className="mt-8">
                <Link href="/beta" className={buttonClasses({ size: "md" })}>
                  SOLICITAR ACESSO AO BETA
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="shell py-6 flex items-center justify-between">
          <Wordmark tamanho="sm" />
          <p className="text-caption text-muted">Sistema operacional para barbearias</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * A barra de janela — "isto é uma tela do sistema", não um cartão de
 * marketing. Repetida em todos os painéis abaixo, então vive numa função
 * só em vez de seis cópias do mesmo JSX.
 */
function JanelaChrome() {
  return (
    <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-border bg-surface-context">
      <span aria-hidden className="size-2 rounded-full bg-border-strong" />
      <span aria-hidden className="size-2 rounded-full bg-border-strong" />
      <span aria-hidden className="size-2 rounded-full bg-border-strong" />
    </div>
  );
}

function PainelBase({
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
 * apresentação `Kpi` e `Ranking` de app/(app)/dashboard/blocks.tsx, os
 * mesmos que renderizam o Início de verdade (sem a busca ao banco, que
 * pertence à página autenticada). Números de exemplo plausíveis, nunca da
 * NORTE 21 ou de qualquer empresa real.
 */
function PainelDashboard() {
  return (
    <PainelBase titulo="Início · últimos 7 dias" acessorio="Terça a segunda">
      <div className="px-5 pt-6 pb-5">
        {/* Sem `dominante`: a tipografia de manchete do Kpi (até 4rem) foi
            desenhada para a largura cheia da página do Início — neste
            cartão, mais estreito em qualquer viewport, ela truncava
            ("R$ 12.48…") tanto em telas largas (disputando espaço com os
            outros três) quanto estreitas (abaixo de 640px, onde o próprio
            tamanho base de 2,75rem já não cabe). Grade uniforme, sem
            truncar em nenhum dos tamanhos validados (320–1440px). */}
        {/* 2 colunas, não 4: o painel tem `lg:max-w-4xl` (bem mais estreito
            que a página cheia do Início) e o Kpi usa `sm:text-metric`
            (2rem) a partir de 640px — em 4 colunas isso não cabia
            ("R$ 12.480,…") em nenhuma largura testada, larga ou estreita. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
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
const AGENDA_LINHAS = [
  { hora: "09:00", duracao: 30, cliente: "Rafael Mendes", servico: "Corte Social", profissional: "Marcus", preco: 45, status: "Confirmado", tone: "info" as const, acao: "Cliente chegou" },
  { hora: "09:30", duracao: 60, cliente: "Bruno Alves", servico: "Corte + Barba", profissional: "Diego", preco: 75, status: "Aguardando", tone: "warning" as const, acao: "Iniciar atendimento", trilho: "warning" as const },
  { hora: "10:30", duracao: 45, cliente: "Felipe Santos", servico: "Barba Completa", profissional: "Marcus", preco: 55, status: "Em atendimento", tone: "warning" as const, trilho: "signal" as const },
  { hora: "11:15", duracao: 90, cliente: "Leandro Costa", servico: "Corte + Barba + Hidratação", profissional: "André", preco: 110, status: "Agendado", tone: "neutral" as const },
];

function PainelAgenda() {
  const selectedDate = "2026-09-18";
  return (
    <PainelBase titulo="Agenda · hoje" acessorio="Sexta-feira">
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
    </PainelBase>
  );
}

/**
 * ATENDIMENTO — duas telas reais: a lista (app/(app)/atendimento/page.tsx)
 * e o recorte de um atendimento aberto com seus itens
 * (app/(app)/atendimento/[id]/page.tsx), até o subtotal.
 */
function PainelListaAtendimentos() {
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

function PainelAtendimentoAberto() {
  return (
    <PainelBase titulo="Atendimento · Marcos Ferreira" acessorio="Em andamento">
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
    </PainelBase>
  );
}

/**
 * DINHEIRO — o bloco "Resultado do período" é a mesma composição de
 * app/(app)/financeiro/page.tsx (material-elevado, Entradas/Saídas
 * derivadas do resultado); a linha final é a mesma leitura de
 * app/(app)/caixa/page.tsx.
 */
function PainelDinheiro() {
  return (
    <PainelBase titulo="Financeiro · período">
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
    </PainelBase>
  );
}

/**
 * EQUIPE — mesma composição de app/(app)/comissoes/page.tsx: "Devido no
 * momento" (material-elevado) + lista com percentual/base/status.
 */
function PainelEquipe() {
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
function PainelClientes() {
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
function PainelCatalogo() {
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
