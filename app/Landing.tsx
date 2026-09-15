import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { formatCurrency } from "@/lib/format";

const OPERACAO = [
  ["01", "Agenda", "O dia começa organizado."],
  ["02", "Atendimento", "Cada visita vira operação registrada."],
  ["03", "Venda", "Serviços e produtos no mesmo fluxo."],
  ["04", "Caixa", "O fechamento acompanha o que aconteceu."],
  ["05", "Equipe", "Comissões calculadas sobre a operação real."],
  ["06", "Clientes", "Histórico que continua depois da visita."],
  ["07", "Catálogo + Estoque", "O que é vendido também é controlado."],
  ["08", "Financeiro", "A operação termina com contexto."],
] as const;

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="shell flex items-center justify-between py-4">
          <Wordmark tamanho="sm" />
          <nav className="flex items-center gap-5" aria-label="Navegação principal">
            <a href="#operacao" className="hidden sm:inline-flex min-h-11 items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Operação
            </a>
            <a href="#beta" className="hidden sm:inline-flex min-h-11 items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Beta
            </a>
            <Link href="/login" className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[var(--neutral-ink)] text-[var(--neutral-bone)]">
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[38rem] rounded-full blur-3xl motion-reduce:blur-2xl" style={{ background: "radial-gradient(circle, rgb(0 147 214 / 45%), transparent 70%)" }} />
          <div className="shell relative py-20 sm:py-28 lg:grid lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:items-center">
            <div>
              <Reveal><p className="text-label uppercase tracking-[0.14em]" style={{ color: "rgb(232 230 221 / 62%)" }}>CORTEX.OS · SISTEMA OPERACIONAL</p></Reveal>
              <Reveal delayMs={80}>
                <h1 className="font-heading font-semibold text-[2.9rem] sm:text-[4.6rem] lg:text-[4rem] leading-[0.94] tracking-[-0.03em] mt-4 max-w-2xl">
                  A barbearia inteira, em operação.
                </h1>
              </Reveal>
              <Reveal delayMs={160}>
                <p className="text-body sm:text-[1.15rem] mt-7 max-w-xl" style={{ color: "rgb(232 230 221 / 78%)" }}>
                  Agenda, atendimento, venda, caixa, equipe, clientes, estoque e financeiro conectados em um único sistema.
                </p>
              </Reveal>
              <Reveal delayMs={240}>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <Link href="/beta" className={buttonClasses({ size: "md" })}>SOLICITAR ACESSO AO BETA</Link>
                  <a href="#operacao" className="min-h-11 inline-flex items-center text-body-sm" style={{ color: "rgb(232 230 221 / 78%)" }}>Ver como funciona ↓</a>
                </div>
              </Reveal>
            </div>
            <Reveal delayMs={320} className="mt-14 lg:mt-0">
              <PainelProduto />
            </Reveal>
          </div>
        </section>

        <section id="operacao" className="border-b border-border scroll-mt-10">
          <div className="shell py-20 sm:py-28">
            <div className="grid lg:grid-cols-[0.7fr_1.3fr] gap-12 lg:gap-20">
              <Reveal>
                <p className="text-label uppercase tracking-[0.12em] text-muted">A operação inteira</p>
                <h2 className="font-heading text-[2rem] sm:text-[3rem] leading-[1] tracking-[-0.02em] text-foreground mt-4 max-w-md">
                  Um movimento alimenta o próximo.
                </h2>
                <p className="text-body-sm text-muted mt-5 max-w-sm">
                  O CORTEX acompanha o caminho completo da visita — do primeiro horário marcado ao histórico que fica para a próxima vez.
                </p>
              </Reveal>
              <div className="border-t border-border">
                {OPERACAO.map(([numero, titulo, texto], index) => (
                  <Reveal key={titulo} delayMs={index * 45}>
                    <div className="grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[4rem_1fr_auto] gap-4 items-baseline py-5 border-b border-border group">
                      <span className="text-caption text-muted tabular-nums">{numero}</span>
                      <span className="font-heading text-[1.25rem] sm:text-[1.5rem] text-foreground group-hover:text-[var(--accent)] transition-colors duration-fast ease-standard">{titulo}</span>
                      <span className="hidden sm:block text-caption text-muted text-right">{texto}</span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border overflow-hidden">
          <div className="shell py-20 sm:py-28">
            <Reveal>
              <p className="text-label uppercase tracking-[0.12em] text-muted">Produto em operação</p>
              <h2 className="font-heading text-[2rem] sm:text-[3rem] leading-[1] tracking-[-0.02em] text-foreground mt-4 max-w-2xl">
                Não é uma promessa. É a ferramenta que organiza o dia.
              </h2>
            </Reveal>
            <Reveal delayMs={120} className="mt-12 sm:mt-16">
              <PainelProduto elevado />
            </Reveal>
            <Reveal delayMs={180}>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-caption uppercase tracking-[0.08em] text-muted">
                <span>Agenda</span><span>Atendimento</span><span>Venda</span><span>Caixa</span><span>Comissão</span><span>Clientes</span><span>Estoque</span><span>Financeiro</span>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="beta" className="bg-[var(--neutral-ink)] text-[var(--neutral-bone)] scroll-mt-10">
          <div className="shell py-20 sm:py-28">
            <div className="max-w-3xl">
              <Reveal><p className="text-label uppercase tracking-[0.14em]" style={{ color: "rgb(232 230 221 / 62%)" }}>CORTEX.OS BETA</p></Reveal>
              <Reveal delayMs={80}>
                <h2 className="font-heading text-[2.4rem] sm:text-[4rem] leading-[0.96] tracking-[-0.03em] mt-4">
                  Entre antes do lançamento.
                </h2>
              </Reveal>
              <Reveal delayMs={160}>
                <p className="text-body sm:text-[1.1rem] mt-6 max-w-xl" style={{ color: "rgb(232 230 221 / 74%)" }}>
                  O Beta é para as primeiras barbearias que querem participar de perto da evolução do CORTEX.OS.
                </p>
              </Reveal>
              <Reveal delayMs={240}>
                <div className="mt-9 flex flex-wrap items-center gap-5">
                  <Link href="/beta" className={buttonClasses({ size: "md" })}>SOLICITAR ACESSO AO BETA</Link>
                  <span className="text-caption uppercase tracking-[0.1em]" style={{ color: "rgb(232 230 221 / 58%)" }}>Acesso limitado · acompanhamento próximo</span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="shell py-7 flex flex-wrap items-center justify-between gap-4">
          <Wordmark tamanho="sm" />
          <p className="text-caption text-muted">Feito para a operação. Feito com CORTEX.OS.</p>
        </div>
      </footer>
    </div>
  );
}

function PainelProduto({ elevado = false }: { elevado?: boolean }) {
  return (
    <div className={elevado ? "rounded-lg border border-border-strong bg-surface overflow-hidden shadow-md scale-[1.02]" : "rounded-lg border border-border-strong bg-surface overflow-hidden shadow-md"}>
      <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-border bg-surface-context">
        <span aria-hidden className="size-2 rounded-full bg-border-strong" />
        <span aria-hidden className="size-2 rounded-full bg-border-strong" />
        <span aria-hidden className="size-2 rounded-full bg-border-strong" />
      </div>
      <div className="border-b border-border px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-label uppercase text-muted">Agenda · hoje</p>
          <p className="text-caption text-muted mt-1">Visão da operação</p>
        </div>
        <span className="text-caption text-muted">terça-feira</span>
      </div>
      <div className="divide-y divide-border">
        <LinhaAgenda hora="14:00" cliente="Marcos Ferreira" servico="Corte + barba" status="Em atendimento" statusTone="ativo" />
        <LinhaAgenda hora="14:40" cliente="Renato Alves" servico="Corte masculino" status="Confirmado" statusTone="neutro" />
        <LinhaAgenda hora="15:20" cliente="Diego Souza" servico="Barba" status="Confirmado" statusTone="neutro" />
      </div>
      <div className="border-t border-border px-5 py-5 bg-surface-context grid sm:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <p className="text-label uppercase text-muted">Atendimento em andamento</p>
          <p className="text-body-sm text-foreground mt-1">Corte masculino + Barba</p>
        </div>
        <div className="sm:text-right">
          <p className="text-label uppercase text-muted">Total</p>
          <p className="text-section-title text-foreground tabular-nums">{formatCurrency(117)}</p>
        </div>
      </div>
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-caption text-muted">Caixa · operação do dia</p>
        <p className="text-caption text-foreground">Venda → pagamento → comissão → histórico</p>
      </div>
    </div>
  );
}

function LinhaAgenda({ hora, cliente, servico, status, statusTone }: { hora: string; cliente: string; servico: string; status: string; statusTone: "ativo" | "neutro" }) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <span className="text-body-sm tabular-nums text-muted w-12 shrink-0">{hora}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium text-foreground truncate">{cliente}</p>
        <p className="text-caption text-muted truncate">{servico}</p>
      </div>
      <span className={statusTone === "ativo" ? "text-caption font-medium shrink-0" : "text-caption text-muted shrink-0"} style={statusTone === "ativo" ? { color: "var(--accent)" } : undefined}>{status}</span>
    </div>
  );
}
