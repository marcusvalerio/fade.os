import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { CortexMark } from "@/components/ui/cortex-mark";

/**
 * P1.5 — landing pública do CORTEX.OS. Nenhum número, cliente ou
 * depoimento inventado: só o que o produto de fato é e faz. CTA único —
 * "Solicite acesso Beta" — leva para /beta (já existe desde a fundação do
 * CORTEX ADMIN: nome, e-mail, barbearia, telefone, vira uma solicitação
 * real na fila de aprovação, não um formulário decorativo).
 */
export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="shell flex items-center justify-between py-4">
          <Wordmark tamanho="sm" />
          <Link href="/login" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
            Entrar
          </Link>
        </div>
      </header>

      <main>
        <section className="shell py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-label uppercase tracking-[0.1em] text-muted mb-4">Sistema operacional para barbearias</p>
            <h1 className="font-heading font-semibold text-[2.75rem] sm:text-[4rem] leading-[0.98] tracking-[-0.02em] text-foreground">
              A operação inteira da sua barbearia, num só lugar.
            </h1>
            <p className="text-body-sm sm:text-body text-muted mt-6 max-w-lg">
              Agenda, atendimento, venda, caixa, comissão e financeiro — sem planilha, sem
              sistema separado para cada coisa. O CORTEX.OS é a infraestrutura; sua barbearia
              continua sendo a protagonista.
            </p>
            <div className="mt-8">
              <Link href="/beta" className={buttonClasses({ size: "md" })}>
                SOLICITE ACESSO BETA
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="shell py-16 sm:py-20">
            <div className="grid sm:grid-cols-3 gap-10">
              <Feature
                titulo="Agenda e atendimento"
                descricao="Do agendamento online ao walk-in, com o status do cliente sempre igual em qualquer tela — sem retrabalho, sem planilha paralela."
              />
              <Feature
                titulo="Venda e caixa"
                descricao="PDV, formas de pagamento, abertura e fechamento de caixa, com o dinheiro batendo com o que realmente aconteceu no dia."
              />
              <Feature
                titulo="Comissão e financeiro"
                descricao="Comissão calculada por atendimento, não por planilha à parte. O financeiro mostra o que entrou e saiu de verdade."
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="shell py-16 sm:py-20 text-center">
            <CortexMark size={32} toneA="var(--brand-yellow)" toneB="var(--accent)" className="mx-auto mb-6" />
            <h2 className="text-page-title font-heading text-foreground">Ainda em Beta fechado.</h2>
            <p className="text-body-sm text-muted mt-3 max-w-md mx-auto">
              Estamos abrindo acesso aos poucos, com cada barbearia acompanhada de perto.
              Solicite acesso e entramos em contato.
            </p>
            <div className="mt-7">
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

function Feature({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div>
      <h3 className="text-section-title text-foreground">{titulo}</h3>
      <p className="text-body-sm text-muted mt-2">{descricao}</p>
    </div>
  );
}
