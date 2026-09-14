import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { CortexMark } from "@/components/ui/cortex-mark";
import { Reveal } from "@/components/ui/reveal";
import { formatCurrency } from "@/lib/format";

/**
 * Landing pública do CORTEX.OS — fechamento pré-piloto.
 *
 * Paleta de 3 cores (Bright White / Kahu Blue / Creeping Depth) — Kahu
 * Blue já é a identidade recorrente do produto inteiro (--primary/
 * --signal em app/globals.css), sem escopo próprio nesta tela. Geometria
 * virou atmosfera (blur pesado, baixa opacidade), nunca protagonista. A
 * composição conta uma história —
 * cliente chega, agenda, atendimento, pagamento, comissão, caixa,
 * histórico — em vez de listar funcionalidades. Nenhum número, cliente,
 * logo ou depoimento inventado: só o que o produto de fato é e faz.
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
        {/* HERO — Creeping Depth, mensagem forte à esquerda, PRODUTO REAL à
            direita (não vazio, não decoração abstrata): o mesmo painel que
            reaparece mais abaixo, aqui em tamanho de protagonista, surgindo
            do canto superior direito. A geometria é atmosfera (blur pesado,
            opacidade baixa) atrás dos dois, nunca o motivo central. */}
        <section className="relative overflow-hidden bg-[var(--neutral-ink)] text-[var(--neutral-bone)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 lg:-right-24 lg:-top-24 opacity-30 blur-3xl motion-reduce:blur-2xl"
          >
            <CortexMark size={620} angle={22} toneA="rgb(0 147 214 / 60%)" toneB="rgb(246 242 241 / 25%)" />
          </div>

          <div className="shell relative py-20 sm:py-28 lg:grid lg:grid-cols-[6fr_5fr] lg:gap-12 lg:items-center">
            <div>
              <Reveal>
                <p className="text-label uppercase tracking-[0.14em]" style={{ color: "rgb(232 230 221 / 62%)" }}>
                  CORTEX.OS
                </p>
              </Reveal>
              <Reveal delayMs={80}>
                <h1 className="font-heading font-semibold text-[2.75rem] sm:text-[4.5rem] lg:text-[3.75rem] leading-[0.96] tracking-[-0.02em] mt-4 max-w-xl">
                  A operação inteira da sua barbearia.
                  <br />
                  Finalmente, em um só lugar.
                </h1>
              </Reveal>
              <Reveal delayMs={160}>
                <p className="text-body-sm sm:text-body mt-7 max-w-lg" style={{ color: "rgb(232 230 221 / 78%)" }}>
                  Agenda, atendimento, venda, caixa, comissão e financeiro — um sistema só, do
                  cliente que chega até o dinheiro que fecha o dia.
                </p>
              </Reveal>
              <Reveal delayMs={240}>
                <div className="mt-9">
                  <Link href="/beta" className={buttonClasses({ size: "md" })}>
                    SOLICITAR ACESSO AO BETA
                  </Link>
                </div>
              </Reveal>
            </div>

            <div className="mt-14 lg:mt-0 animate-entra-origem" style={{ animationDelay: "320ms" }}>
              <PainelProduto elevado />
            </div>
          </div>
        </section>

        {/* NARRATIVA — a operação acontece uma vez; o CORTEX registra tudo.
            Fluxo editorial, não lista de funcionalidades. */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-20">
            <Reveal>
              <p className="text-label uppercase tracking-[0.1em] text-muted mb-8">Como acontece na prática</p>
            </Reveal>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline gap-x-2 gap-y-4">
              {NARRATIVA.map((etapa, i) => (
                <Reveal key={etapa} delayMs={i * 60} className="flex items-baseline gap-2">
                  <span className="font-heading text-[1.35rem] sm:text-[1.6rem] tracking-[-0.01em] text-foreground">
                    {etapa}
                  </span>
                  {i < NARRATIVA.length - 1 && (
                    <span aria-hidden className="text-muted text-[1.35rem] sm:text-[1.6rem]">
                      →
                    </span>
                  )}
                </Reveal>
              ))}
            </div>
            <Reveal delayMs={NARRATIVA.length * 60 + 80}>
              <p className="text-body-sm text-muted mt-8 max-w-lg">
                A operação acontece uma vez. O CORTEX registra tudo — sem planilha paralela, sem
                reconciliar no fim do mês o que já devia estar certo.
              </p>
            </Reveal>
          </div>
        </section>

        {/* PRODUTO EM OPERAÇÃO — a interface real, não ilustração. Um
            painel só, editorial, com a mesma linguagem visual do produto
            (Surface, tipografia, tokens) — nunca um card por feature. */}
        <section className="border-b border-border">
          <div className="shell py-16 sm:py-24">
            <Reveal className="max-w-lg mb-10">
              <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em] text-foreground">
                O produto de verdade, não uma promessa.
              </h2>
              <p className="text-body-sm text-muted mt-3">
                A mesma tela que sua equipe usa no dia a dia: agenda do dia, atendimento em
                andamento, caixa fechando com o que realmente aconteceu.
              </p>
            </Reveal>

            <Reveal delayMs={120}>
              <PainelProduto />
            </Reveal>

            <Reveal delayMs={200}>
              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <TiraResumo rotulo="Comissão do mês" valor={formatCurrency(3180)} />
                <TiraResumo rotulo="Financeiro — entradas hoje" valor={formatCurrency(1420)} />
                <TiraResumo rotulo="Clientes atendidos hoje" valor="18" />
              </div>
            </Reveal>

            <Reveal delayMs={260}>
              <p className="text-caption text-muted mt-6">
                Agenda · Atendimento · Venda · Caixa · Comissão · Clientes · Financeiro — tudo no
                mesmo lugar, sem sistema separado para cada coisa.
              </p>
            </Reveal>
          </div>
        </section>

        {/* BETA — acesso limitado, desejo de entrada. Nunca "ainda estamos
            fazendo": a sensação é "você pode entrar antes do lançamento". */}
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
          <p className="text-caption text-muted">CORTEX.OS</p>
        </div>
      </footer>
    </div>
  );
}

const NARRATIVA = [
  "Cliente chega",
  "Agenda",
  "Atendimento",
  "Serviço",
  "Pagamento",
  "Comissão",
  "Caixa",
  "Histórico",
];

/**
 * Recorte real da interface — os mesmos componentes e tokens do produto
 * (Surface, tipografia, `formatCurrency`), com dados de exemplo plausíveis
 * e claramente fictícios (não é a NORTE 21, não é dado real). Não é
 * ilustração abstrata: é a mesma composição visual que a barbearia usa
 * todo dia, só compactada num painel — com uma barra de janela no topo
 * para deixar explícito "isto é uma tela", não um cartão de marketing.
 */
function PainelProduto({ elevado = false }: { elevado?: boolean }) {
  return (
    <div
      className={
        elevado
          ? "rounded-lg border border-border-strong bg-surface overflow-hidden shadow-md scale-[1.04]"
          : "rounded-lg border border-border-strong bg-surface overflow-hidden shadow-md"
      }
    >
      <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-border bg-surface-context">
        <span aria-hidden className="size-2 rounded-full bg-border-strong" />
        <span aria-hidden className="size-2 rounded-full bg-border-strong" />
        <span aria-hidden className="size-2 rounded-full bg-border-strong" />
      </div>
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <p className="text-label uppercase text-muted">Agenda · hoje</p>
        <p className="text-caption text-muted">Terça-feira</p>
      </div>
      <div className="divide-y divide-border">
        <LinhaAgenda hora="14:00" cliente="Marcos Ferreira" servico="Corte + barba" status="Em atendimento" statusTone="ativo" />
        <LinhaAgenda hora="14:40" cliente="Renato Alves" servico="Corte masculino" status="Confirmado" statusTone="neutro" />
        <LinhaAgenda hora="15:20" cliente="Diego Souza" servico="Barba" status="Confirmado" statusTone="neutro" />
      </div>
      <div className="border-t border-border px-5 py-4 bg-surface-context flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-label uppercase text-muted">Atendimento — Marcos Ferreira</p>
          <p className="text-body-sm text-foreground mt-1">Corte masculino + Barba</p>
        </div>
        <div className="text-right">
          <p className="text-label uppercase text-muted">Subtotal</p>
          <p className="text-section-title text-foreground tabular-nums">{formatCurrency(117)}</p>
        </div>
      </div>
      <div className="px-5 py-3 flex items-center justify-between">
        <p className="text-caption text-muted">Caixa aberto · 6 vendas hoje</p>
        <p className="text-caption text-foreground tabular-nums">{formatCurrency(842)} em caixa</p>
      </div>
    </div>
  );
}

function TiraResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3.5">
      <p className="text-caption text-muted">{rotulo}</p>
      <p className="text-section-title text-foreground tabular-nums mt-1">{valor}</p>
    </div>
  );
}

function LinhaAgenda({
  hora,
  cliente,
  servico,
  status,
  statusTone,
}: {
  hora: string;
  cliente: string;
  servico: string;
  status: string;
  statusTone: "ativo" | "neutro";
}) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <span className="text-body-sm tabular-nums text-muted w-12 shrink-0">{hora}</span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium text-foreground truncate">{cliente}</p>
        <p className="text-caption text-muted truncate">{servico}</p>
      </div>
      <span
        className={
          statusTone === "ativo"
            ? "text-caption font-medium shrink-0"
            : "text-caption text-muted shrink-0"
        }
        style={statusTone === "ativo" ? { color: "var(--accent)" } : undefined}
      >
        {status}
      </span>
    </div>
  );
}
