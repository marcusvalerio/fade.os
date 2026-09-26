import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { ProductWindow, PhoneFrame } from "./product-chrome";
import {
  AgendaDoHero,
  AgendarServicos,
  AgendamentoConfirmado,
  AgendaDoProfissional,
  AtendimentoNoCelular,
  ClienteNoCelular,
  AtendimentoDoPulso,
  MODULOS_DO_PULSO,
  InicioResumo,
  ClientesRitmo,
  FecharCaixaModal,
  MENU_POR_PAPEL,
} from "./screens";
import { DemoButton } from "./DemoDialog";
import { Pulso } from "./Pulso";
import { CelularTour } from "./CelularTour";
import { Papeis } from "./Papeis";
import { EmCena } from "./EmCena";

/** Rótulo de seção: o quadrado da marca + o assunto. Sem numeração, sem caixa alta. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>;
}

function atraso(ms: number): React.CSSProperties {
  return { ["--lp-delay" as string]: `${ms}ms` };
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

const SECOES = [
  { href: "#sistema", rotulo: "O sistema" },
  { href: "#operacao", rotulo: "Um dia no balcão" },
  { href: "#celular", rotulo: "No celular" },
  { href: "#perguntas", rotulo: "Perguntas" },
];

export function Nav() {
  return (
    <header className="lp-ink lp-nav">
      <div className="lp-container flex items-center gap-6 h-16">
        <Link href="/" aria-label="CORTEX.OS — início" className="shrink-0 text-[var(--neutral-warm-white)]">
          <Wordmark tamanho="sm" />
        </Link>
        <nav aria-label="Seções da página" className="hidden lg:flex items-center gap-7 ml-8">
          {SECOES.map((s) => (
            <a key={s.href} href={s.href} className="lp-nav-link">
              {s.rotulo}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/login" className="lp-nav-link min-h-11 inline-flex items-center">
            Entrar
          </Link>
          <Link href="/beta" className="lp-btn lp-btn-primary lp-btn-sm hidden min-[380px]:inline-flex">
            Pedir acesso
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero — a ideia em seis palavras, o produto como prova
// ---------------------------------------------------------------------------

export function Hero() {
  return (
    <section className="lp-ink relative overflow-hidden" aria-labelledby="hero-titulo">
      <div className="lp-container relative pt-14 sm:pt-20 lg:pt-20 pb-20 lg:pb-32">
        <div className="grid lg:grid-cols-[minmax(0,9fr)_minmax(0,4fr)] gap-7 lg:gap-12 lg:items-end">
          <div>
            <Rotulo>Sistema operacional para barbearias</Rotulo>
            <h1 id="hero-titulo" className="lp-h1 mt-5">
              Cada corte move a barbearia inteira.
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="lp-lead">
              Fechou o atendimento: a agenda, o caixa, a comissão, o estoque e o cliente já sabem. Um sistema só,
              do horário marcado ao caixa fechado.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
              <Link href="/beta" className="lp-btn lp-btn-primary">
                Pedir acesso ao Beta
              </Link>
              <DemoButton />
            </div>
          </div>
        </div>

        <div className="lp-hero-stage mt-14 lg:mt-16">
          <div className="lp-hero-window lp-hero-crop lg:ml-[13.75rem]">
            <ProductWindow
              area="agenda"
              descricao="Agenda da barbearia no CORTEX, com os atendimentos do dia; o horário das 10:30 de Thiago Rocha entra na lista assim que ele confirma pelo celular."
            >
              <AgendaDoHero />
            </ProductWindow>
          </div>
          <div className="lp-hero-phone">
            <PhoneFrame
              tamanho="md"
              descricao="No celular do cliente, a página da barbearia: ele escolhe Corte + Barba e o agendamento é confirmado para as 10:30."
            >
              <div className="lp-swap">
                <div className="lp-hero-phone-a">
                  <AgendarServicos tapClassName="lp-hero-tap" />
                </div>
                <div className="lp-hero-phone-b">
                  <AgendamentoConfirmado hora="10:30" />
                </div>
              </div>
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// O sistema — um fechamento, seis lugares
// ---------------------------------------------------------------------------

export function Sistema() {
  return (
    <section id="sistema" className="lp-paper lp-section" aria-labelledby="sistema-titulo">
      <div className="lp-container">
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 lg:gap-16 lg:items-end" data-reveal>
          <div>
            <Rotulo>O sistema</Rotulo>
            <h2 id="sistema-titulo" className="lp-h2 mt-5">
              Fechou o atendimento. O resto já sabe.
            </h2>
          </div>
          <p className="lp-lead lg:pb-1.5">
            Não são seis telas conversando. É um registro só: venda, caixa, comissão, estoque, agenda e cliente
            são escritos juntos — ou nada é escrito.
          </p>
        </div>

        <div className="mt-14 lg:mt-20" data-reveal>
          <Pulso atendimento={<AtendimentoDoPulso />} modulos={MODULOS_DO_PULSO} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// No celular — o balcão no bolso de quem atende
// ---------------------------------------------------------------------------

export function Celular() {
  return (
    <section id="celular" className="lp-white lp-section" aria-labelledby="celular-titulo">
      <div className="lp-container">
        <div data-reveal>
          <CelularTour
            cabecalho={
              <>
                <Rotulo>No celular</Rotulo>
                <h2 id="celular-titulo" className="lp-h2 mt-5">
                  O balcão cabe no bolso.
                </h2>
                <p className="lp-lead mt-6">
                  Cada barbeiro entra pelo navegador do celular, com o identificador da barbearia e uma senha
                  própria. Nada para instalar.
                </p>
              </>
            }
            telas={[
              {
                chave: "agenda",
                rotulo: "Agenda",
                titulo: "O dia dele, na ordem.",
                texto: "Quem já está na cadeira, quem confirmou, quem ainda vem. Só os horários de quem está com o celular.",
                tela: <AgendaDoProfissional />,
              },
              {
                chave: "atendimento",
                rotulo: "Atendimento",
                titulo: "Serviço e produto no mesmo lugar.",
                texto: "A pomada vendida na cadeira entra no atendimento — e sai do estoque quando ele fecha.",
                tela: <AtendimentoNoCelular />,
              },
              {
                chave: "cliente",
                rotulo: "Cliente",
                titulo: "Quem está sentado ali.",
                texto: "Quantas vezes veio, de quanto em quanto tempo volta e o que costuma fazer. Antes de pegar a máquina.",
                tela: <ClienteNoCelular />,
              },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// O que só um sistema faz — cada diferencial é a tela funcionando
// ---------------------------------------------------------------------------

export function Diferenciais() {
  return (
    <section id="diferenciais" className="lp-ink lp-section" aria-labelledby="diferenciais-titulo">
      <div className="lp-container">
        <div className="max-w-3xl" data-reveal>
          <Rotulo>O que muda</Rotulo>
          <h2 id="diferenciais-titulo" className="lp-h2 mt-5">
            Não é um caderno digital. É um sistema.
          </h2>
        </div>

        <div className="lp-provas mt-14 lg:mt-20">
          <article className="lp-prova" data-reveal>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">O caixa confere.</h3>
              <p className="lp-body mt-2">
                O saldo esperado sai das vendas em dinheiro. Você informa o que contou; se não bater, o CORTEX
                pede o motivo e guarda junto do fechamento.
              </p>
            </div>
            <EmCena className="lp-prova-tela">
              <FecharCaixaModal />
            </EmCena>
          </article>

          <article className="lp-prova" data-reveal style={atraso(80)}>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">Sabe quem sumiu.</h3>
              <p className="lp-body mt-2">
                O CORTEX aprende de quanto em quanto tempo cada cliente volta e avisa quando alguém passou do
                prazo. Sem você procurar.
              </p>
            </div>
            <div className="lp-prova-tela">
              <ProductWindow
                area="clientes"
                descricao="Clientes no CORTEX: um cliente que costuma voltar a cada 30 dias e já está há 34 aparece em atenção; outro, há 61 dias, em recuperação."
              >
                <ClientesRitmo />
              </ProductWindow>
            </div>
          </article>

          <article className="lp-prova" data-reveal>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">Cada um vê o seu.</h3>
              <p className="lp-body mt-2">
                O dono vê a barbearia. A recepção vê agenda, venda e caixa. O barbeiro vê a própria agenda e os
                clientes. Quem pode o quê é regra do banco, não da tela.
              </p>
            </div>
            <div className="lp-prova-tela lp-prova-tela-livre">
              <Papeis menu={MENU_POR_PAPEL} />
            </div>
          </article>

          <article className="lp-prova" data-reveal style={atraso(80)}>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">Os números saem do balcão.</h3>
              <p className="lp-body mt-2">
                Faturamento, recebido, ticket e atendimentos da semana, cada um contra o período anterior. Ninguém
                exporta planilha.
              </p>
            </div>
            <div className="lp-prova-tela">
              <ProductWindow
                area="inicio"
                descricao="Início do CORTEX nos últimos 7 dias: faturamento, recebido, ticket médio e atendimentos, cada um comparado com o período anterior, e o ranking dos serviços mais realizados."
              >
                <InicioResumo />
              </ProductWindow>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Prova social — estrutura pronta, vazia de propósito
// ---------------------------------------------------------------------------

type Depoimento = { citacao: string; nome: string; barbearia: string; cidade?: string };

/**
 * Nenhum depoimento é inventado. Quando houver barbearias do Beta
 * autorizando o uso do que disseram, é aqui que entram — a seção só aparece
 * com pelo menos um depoimento real.
 */
const DEPOIMENTOS: Depoimento[] = [];

export function ProvaSocial() {
  if (DEPOIMENTOS.length === 0) return null;
  return (
    <section className="lp-white lp-section" aria-label="O que dizem as barbearias">
      <div className="lp-container grid md:grid-cols-2 gap-12">
        {DEPOIMENTOS.map((d) => (
          <figure key={d.nome} className="m-0 lp-rule-top pt-7" data-reveal>
            <blockquote className="lp-h3 m-0">“{d.citacao}”</blockquote>
            <figcaption className="lp-body mt-4">
              <span className="lp-strong font-medium">{d.nome}</span> · {d.barbearia}
              {d.cidade ? `, ${d.cidade}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

const PERGUNTAS = [
  {
    p: "Preciso instalar alguma coisa?",
    r: "Não. O CORTEX funciona no navegador — no computador do balcão, no tablet ou no celular.",
  },
  {
    p: "O cliente consegue marcar sozinho?",
    r: "Sim. A barbearia ganha uma página própria com serviços, equipe e horários livres. O horário entra direto na agenda, e a confirmação sai pronta para o WhatsApp — quem envia é a barbearia.",
  },
  {
    p: "Meus barbeiros precisam de e-mail?",
    r: "Não. Cada profissional recebe um identificador da barbearia e define a própria senha no primeiro acesso.",
  },
  {
    p: "Dá para vender produto?",
    r: "Sim. O produto entra no próprio atendimento ou numa venda avulsa, e o estoque baixa na hora.",
  },
  {
    p: "Meus dados ficam separados dos de outras barbearias?",
    r: "Sim. O isolamento entre barbearias é garantido no banco de dados, não só na tela.",
  },
  {
    p: "Como funciona o Beta?",
    r: "Você pede acesso com o nome da barbearia e um contato. A gente conversa sobre a sua operação e libera a conta — cada barbearia entra acompanhada.",
  },
];

export function Perguntas() {
  return (
    <section id="perguntas" className="lp-paper lp-section" aria-labelledby="perguntas-titulo">
      <div className="lp-container grid lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] gap-12 lg:gap-16">
        <div data-reveal>
          <Rotulo>Perguntas</Rotulo>
          <h2 id="perguntas-titulo" className="lp-h2 mt-5">
            Perguntas diretas.
          </h2>
          <p className="lp-body mt-5 max-w-[32ch]">
            Não achou a sua? Faça ao pedir acesso — a conversa com cada barbearia existe para isso.
          </p>
        </div>
        <div className="lp-faq border-b border-[var(--lp-rule-paper)]" data-reveal style={atraso(100)}>
          {PERGUNTAS.map((q) => (
            <details key={q.p} className="lp-rule-top group">
              <summary className="flex items-start justify-between gap-6 py-6">
                <span className="lp-strong text-[1.125rem] font-semibold tracking-[-0.02em] leading-snug">{q.p}</span>
                <span className="lp-faq-icon text-[var(--neutral-ink)]" aria-hidden />
              </summary>
              <p className="lp-body pb-7 -mt-1 max-w-[60ch]">{q.r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chamada final — a marca se monta como na entrada do produto
// ---------------------------------------------------------------------------

export function ChamadaFinal() {
  return (
    <section id="beta" className="lp-ink lp-section relative overflow-hidden" aria-labelledby="beta-titulo">
      <div className="lp-container relative">
        <EmCena className="lp-marca-final" limite={0.6}>
          <p aria-hidden className="lp-marca-final-lockup font-brand">
            <span className="lp-marca-final-nome">CORTEX</span>
            <span className="lp-marca-final-quadrado" />
            <span className="lp-marca-final-sufixo">OS</span>
          </p>
        </EmCena>

        <div className="max-w-3xl mt-16 lg:mt-24" data-reveal>
          <h2 id="beta-titulo" className="lp-h2">
            Estamos abrindo o CORTEX uma barbearia de cada vez.
          </h2>
          <p className="lp-lead mt-6 max-w-[44ch]">
            Conte como a sua barbearia funciona hoje. A gente responde, conversa sobre a operação e acompanha a
            entrada da equipe.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-4">
            <Link href="/beta" className="lp-btn lp-btn-primary">
              Pedir acesso ao Beta
            </Link>
            <DemoButton />
          </div>
          <p className="lp-body mt-8 text-[0.9375rem]">
            Já tem acesso?{" "}
            <Link href="/login" className="lp-strong underline underline-offset-4 decoration-[rgb(232_230_221/35%)] hover:decoration-current">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export function Rodape() {
  return (
    <footer className="lp-ink">
      <div className="lp-container py-10 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-6 border-t border-[var(--lp-rule-ink)]">
        <div className="flex items-center gap-4 text-[var(--neutral-warm-white)]">
          <Wordmark tamanho="sm" />
          <span className="text-caption" style={{ color: "var(--lp-on-ink-faint)" }}>
            Sistema operacional para barbearias
          </span>
        </div>
        <p className="text-caption sm:order-last sm:basis-full" style={{ color: "var(--lp-on-ink-faint)" }}>
          As telas desta página são do CORTEX, com dados de exemplo.
        </p>
        <nav aria-label="Rodapé" className="flex items-center gap-6">
          <Link href="/login" className="lp-nav-link">
            Entrar
          </Link>
          <Link href="/beta" className="lp-nav-link">
            Pedir acesso
          </Link>
          <span className="text-caption" style={{ color: "var(--lp-on-ink-faint)" }}>
            © {new Date().getFullYear()} CORTEX.OS
          </span>
        </nav>
      </div>
    </footer>
  );
}
