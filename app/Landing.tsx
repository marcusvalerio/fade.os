import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { HeroProductPreview } from "./HeroProductPreview";
import {
  PainelAgenda,
  PainelListaAtendimentos,
  PainelAtendimentoAberto,
  PainelDinheiro,
  PainelEquipe,
  PainelClientes,
  PainelCatalogo,
} from "./landing-panels";

/**
 * Landing pública do CORTEX.OS — apresentação editorial do produto.
 *
 * Reescrita (pós-Figma Make): a versão anterior ainda explicava o sistema —
 * headline forte, mas a prova visual era um card de Agenda repetido e uma
 * lista de seis áreas em texto. Isso deixava a página "falando sobre"
 * operação, não "mostrando" operação.
 *
 * Esta versão substitui toda explicação por telas: cada seção reaproveita os
 * componentes REAIS do produto (painéis de app/landing-panels.tsx, que por
 * sua vez usam Kpi/Ranking do Início, DateWindowNav da Agenda,
 * SurfaceRow/Badge usados em toda a operação) com dados de exemplo
 * plausíveis e claramente fictícios — nunca dados reais de cliente nenhum.
 *
 * O Hero usa `HeroProductPreview` — um "Live Product Preview" que percorre
 * quatro dessas telas reais dentro do mesmo painel (ver HeroProductPreview.tsx
 * para a lógica de motion); as seções abaixo mostram as mesmas telas
 * paradas, para quem chegou com prefers-reduced-motion ou só quer ler.
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
        {/* HERO — mensagem forte à esquerda, o Live Product Preview à
            direita, em escala de protagonista. */}
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
                <HeroProductPreview />
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
