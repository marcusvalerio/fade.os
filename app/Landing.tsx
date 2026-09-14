import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { CortexMark } from "@/components/ui/cortex-mark";

/**
 * P1.2 — landing pública do CORTEX.OS. Direção: composição editorial
 * (CAMPO → BLOCO → RELAÇÃO → AÇÃO → MOMENTO), não a grade de três cards
 * iguais da versão anterior nem o "AI SaaS aesthetic" (gradiente + glass +
 * sombra em tudo). Nenhum número, cliente, logo ou depoimento inventado:
 * só o que o produto de fato é e faz. CTA único — "Solicite acesso Beta" —
 * usa o mecanismo já existente (/beta, agora com Nome/E-mail/Região/
 * WhatsApp), nunca um formulário paralelo.
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
        {/* CAMPO — o bloco de abertura ocupa a largura toda, assimétrico:
            texto ancorado à esquerda, "O Corte" cortando a borda direita. */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-16 opacity-[0.9] hidden sm:block"
          >
            <CortexMark size={480} angle={24} toneA="var(--border)" toneB="var(--brand-yellow)" />
          </div>
          <div className="shell relative py-20 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-label uppercase tracking-[0.14em] text-muted mb-5">
                Sistema operacional para barbearias
              </p>
              <h1 className="font-heading font-semibold text-[2.75rem] sm:text-[4.25rem] leading-[0.96] tracking-[-0.02em] text-foreground">
                A operação inteira da sua barbearia, num só lugar.
              </h1>
              <p className="text-body-sm sm:text-body text-muted mt-7 max-w-lg">
                Agenda, atendimento, venda, caixa, comissão e financeiro — sem planilha, sem
                sistema separado para cada coisa. O CORTEX.OS é a infraestrutura; sua barbearia
                continua sendo a protagonista.
              </p>
              <div className="mt-9">
                <Link href="/beta" className={buttonClasses({ size: "md" })}>
                  SOLICITE ACESSO BETA
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* BLOCO → RELAÇÃO — lista editorial numerada, não cards iguais.
            Cada bloco relaciona um domínio do negócio ao seguinte: agenda
            vira atendimento, atendimento vira venda, venda vira comissão. */}
        <section>
          <div className="shell py-4">
            <Pilar
              numero="01"
              titulo="Agenda e atendimento"
              descricao="Do agendamento online ao walk-in, com o status do cliente sempre igual em qualquer tela — sem retrabalho, sem planilha paralela."
            />
            <Pilar
              numero="02"
              titulo="Venda e caixa"
              descricao="PDV, formas de pagamento, abertura e fechamento de caixa, com o dinheiro batendo com o que realmente aconteceu no dia."
            />
            <Pilar
              numero="03"
              titulo="Comissão e financeiro"
              descricao="Comissão calculada por atendimento, não por planilha à parte. O financeiro mostra o que entrou e saiu de verdade."
              ultimo
            />
          </div>
        </section>

        {/* MOMENTO — o único ponto de contraste total da página: fundo
            Creeping Depth, "O Corte" como assinatura, sem métrica inventada. */}
        <section className="bg-[var(--neutral-ink)] text-[var(--neutral-bone)]">
          <div className="shell py-20 sm:py-24 text-center">
            <CortexMark size={36} toneA="rgb(246 242 241 / 40%)" toneB="var(--brand-yellow)" className="mx-auto mb-7" />
            <h2 className="font-heading text-[1.75rem] sm:text-[2.25rem] tracking-[-0.01em]">
              Ainda em Beta fechado.
            </h2>
            <p className="text-body-sm mt-3 max-w-md mx-auto" style={{ color: "rgb(232 230 221 / 68%)" }}>
              Estamos abrindo acesso aos poucos, com cada barbearia acompanhada de perto.
              Solicite acesso e entramos em contato.
            </p>
            <div className="mt-8">
              <Link href="/beta" className={buttonClasses({ size: "md" })}>
                SOLICITE ACESSO BETA
              </Link>
            </div>
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

function Pilar({
  numero,
  titulo,
  descricao,
  ultimo,
}: {
  numero: string;
  titulo: string;
  descricao: string;
  ultimo?: boolean;
}) {
  return (
    <div className={`grid sm:grid-cols-[5rem_1fr] gap-3 sm:gap-8 py-9 ${ultimo ? "" : "border-b border-border"}`}>
      <span className="font-heading text-[1.5rem] text-muted tabular-nums">{numero}</span>
      <div className="max-w-xl">
        <h3 className="text-section-title text-foreground">{titulo}</h3>
        <p className="text-body-sm text-muted mt-2">{descricao}</p>
      </div>
    </div>
  );
}
