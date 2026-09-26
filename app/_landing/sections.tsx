import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { ProductWindow, PhoneFrame } from "./product-chrome";
import {
  AgendaDoHero,
  AgendarServicos,
  AgendamentoConfirmado,
  AgendaDoProfissional,
  InicioResumo,
  ClientesRitmo,
} from "./screens";
import { DemoButton } from "./DemoDialog";

function Eyebrow({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <p className="lp-eyebrow">
      {n && <span className="lp-eyebrow-num">{n}</span>}
      {children}
    </p>
  );
}

function atraso(ms: number): React.CSSProperties {
  return { ["--lp-delay" as string]: `${ms}ms` };
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

const SECOES = [
  { href: "#operacao", rotulo: "Como funciona" },
  { href: "#celular", rotulo: "No celular" },
  { href: "#gestao", rotulo: "Gestão" },
  { href: "#perguntas", rotulo: "Perguntas" },
];

export function Nav() {
  return (
    <header className="lp-ink lp-nav">
      <div className="lp-container flex items-center gap-6 h-16">
        <Link href="/" aria-label="CORTEX.OS — início" className="shrink-0">
          <Wordmark tamanho="sm" className="text-[var(--neutral-warm-white)]" />
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
// Hero — o conceito em palavras, o produto como prova
// ---------------------------------------------------------------------------

export function Hero() {
  return (
    <section className="lp-ink relative overflow-hidden" aria-labelledby="hero-titulo">
      <div aria-hidden className="lp-hero-light" />
      <div className="lp-container relative pt-14 sm:pt-20 lg:pt-20 pb-20 lg:pb-32">
        <div className="grid lg:grid-cols-[minmax(0,8fr)_minmax(0,5fr)] gap-7 lg:gap-14 lg:items-end">
          <div>
            <Eyebrow>Sistema operacional para barbearias</Eyebrow>
            <h1 id="hero-titulo" className="lp-h1 mt-5">
              Do horário marcado ao caixa fechado.
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="lp-lead">
              O CORTEX.OS é o sistema operacional da barbearia. O horário que o cliente marca vira atendimento, o
              atendimento vira venda, e a venda fecha o caixa — sem ninguém digitar nada duas vezes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
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
// 01 — A ideia
// ---------------------------------------------------------------------------

export function Manifesto() {
  return (
    <section id="ideia" className="lp-paper lp-section" aria-labelledby="ideia-titulo">
      <div className="lp-container grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-14 lg:gap-16 lg:items-end">
        <div data-reveal>
          <Eyebrow n="01">A ideia</Eyebrow>
          <ul className="list-none p-0 m-0 mt-8 space-y-1.5" aria-label="Como a barbearia costuma se organizar">
            <li className="lp-fragment">
              A agenda <b>no caderno.</b>
            </li>
            <li className="lp-fragment">
              O pagamento <b>na maquininha.</b>
            </li>
            <li className="lp-fragment">
              A comissão <b>na planilha.</b>
            </li>
            <li className="lp-fragment">
              O cliente <b>no WhatsApp.</b>
            </li>
          </ul>
        </div>
        <div data-reveal style={atraso(120)}>
          <h2 id="ideia-titulo" className="lp-h2">
            Um corte.
            <br />
            Um registro.
          </h2>
          <p className="lp-lead mt-6">
            Quatro lugares para anotar o mesmo corte — e no fim do dia, nenhum confere com o outro. No CORTEX, o
            atendimento nasce quando o cliente marca o horário e é o mesmo registro do começo ao fim, até o caixa
            e a comissão.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 03 — No celular
// ---------------------------------------------------------------------------

function Legenda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 max-w-[20rem]">
      <p className="lp-strong text-[1.0625rem] font-semibold tracking-[-0.015em]">{titulo}</p>
      <p className="lp-body mt-2 text-[0.9375rem]">{children}</p>
    </div>
  );
}

export function Celular() {
  return (
    <section id="celular" className="lp-white lp-section" aria-labelledby="celular-titulo">
      <div className="lp-container grid xl:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] gap-16 xl:items-center">
        <div data-reveal className="max-w-2xl">
          <Eyebrow n="03">No celular</Eyebrow>
          <h2 id="celular-titulo" className="lp-h2 mt-5">
            O cliente marca no celular dele. O barbeiro acompanha no dele.
          </h2>
          <p className="lp-lead mt-6">
            Nada para instalar. A barbearia ganha uma página própria com agendamento online, e cada profissional
            entra no CORTEX pelo navegador do celular.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-16 md:gap-8 justify-items-center">
          <div data-reveal>
            <PhoneFrame
              tamanho="lg"
              descricao="Página pública de agendamento da barbearia no celular: passo 1 de 5, escolha de serviços com preço e duração."
            >
              <AgendarServicos />
            </PhoneFrame>
            <Legenda titulo="A página da sua barbearia">
              Serviços com preço e duração, horários livres de verdade e confirmação na hora. Endereço, equipe,
              avaliações e formas de pagamento na mesma página.
            </Legenda>
          </div>
          <div data-reveal style={atraso(150)} className="md:mt-24">
            <PhoneFrame
              tamanho="lg"
              statusEscura
              descricao="O CORTEX no celular do profissional: a agenda do dia com o atendimento em andamento e os próximos horários."
            >
              <AgendaDoProfissional />
            </PhoneFrame>
            <Legenda titulo="O acesso do profissional">
              Cada barbeiro entra com o identificador da barbearia e uma senha própria — não precisa de e-mail.
              Agenda e atendimentos no bolso.
            </Legenda>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 04 — A gestão
// ---------------------------------------------------------------------------

const PONTOS_GESTAO = [
  {
    titulo: "Comparado com o período anterior.",
    texto: "Cada número diz se subiu ou caiu. Sem conta de cabeça, sem exportar nada.",
  },
  {
    titulo: "Quem está demorando a voltar.",
    texto:
      "O CORTEX calcula de quanto em quanto tempo cada cliente costuma voltar e avisa quando alguém passou do prazo.",
  },
  {
    titulo: "Um caixa que fecha.",
    texto:
      "Abertura, sangria, suprimento e fechamento pelo valor contado. Se sobrar ou faltar, a diferença fica registrada.",
  },
];

export function Gestao() {
  return (
    <section id="gestao" className="lp-paper lp-section" aria-labelledby="gestao-titulo">
      <div className="lp-container">
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 lg:gap-16 lg:items-end" data-reveal>
          <div>
            <Eyebrow n="04">A gestão</Eyebrow>
            <h2 id="gestao-titulo" className="lp-h2 mt-5">
              Os números saem da operação. Não de uma planilha.
            </h2>
          </div>
          <p className="lp-lead lg:pb-1.5">
            Tudo o que passou pelo balcão chega ao Início sozinho: faturamento, recebido, ticket médio e
            atendimentos da semana.
          </p>
        </div>

        <div className="mt-14 lg:mt-20 grid lg:grid-cols-12 gap-6 lg:gap-0">
          <div className="lg:col-start-1 lg:col-end-9 lg:row-start-1" data-reveal>
            <ProductWindow
              area="inicio"
              descricao="Início do CORTEX nos últimos 7 dias: faturamento, recebido, ticket médio e atendimentos, cada um comparado com o período anterior, e o ranking dos serviços mais realizados."
            >
              <InicioResumo />
            </ProductWindow>
          </div>
          <div className="lg:col-start-7 lg:col-end-13 lg:row-start-1 lg:mt-56 lg:z-10" data-reveal style={atraso(140)}>
            <ProductWindow
              area="clientes"
              descricao="Clientes no CORTEX: um cliente que costuma voltar a cada 30 dias e já está há 34 aparece em atenção; outro, há 61 dias, em recuperação."
            >
              <ClientesRitmo />
            </ProductWindow>
          </div>
        </div>

        <ul className="list-none p-0 m-0 mt-16 lg:mt-24 grid md:grid-cols-3 gap-10 md:gap-8">
          {PONTOS_GESTAO.map((p, i) => (
            <li key={p.titulo} className="lp-rule-top pt-6" data-reveal style={atraso(i * 90)}>
              <p className="lp-strong text-[1.0625rem] font-semibold tracking-[-0.015em]">{p.titulo}</p>
              <p className="lp-body mt-2 text-[0.9375rem] max-w-[34ch]">{p.texto}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 05 — Por que CORTEX
// ---------------------------------------------------------------------------

const RAZOES = [
  {
    titulo: "Um registro só.",
    texto:
      "O serviço agendado é o serviço cobrado, que vira a comissão de quem atendeu. Nenhuma tela pede para digitar de novo o que outra já sabe.",
  },
  {
    titulo: "Números que batem.",
    texto:
      "Venda em dinheiro entra no saldo esperado da gaveta. No fechamento, você informa o valor contado — e a diferença, se houver, fica registrada.",
  },
  {
    titulo: "Do jeito da barbearia.",
    texto:
      "Comissão por profissional, cliente que chega sem hora marcada, serviço com duração, página própria de agendamento. Nada adaptado de outro tipo de negócio.",
  },
];

export function PorQue() {
  return (
    <section id="porque" className="lp-ink lp-section" aria-labelledby="porque-titulo">
      <div className="lp-container">
        <div className="max-w-3xl" data-reveal>
          <Eyebrow n="05">Por que o CORTEX</Eyebrow>
          <h2 id="porque-titulo" className="lp-h2 mt-5">
            Feito para o balcão de uma barbearia.
          </h2>
        </div>
        <ul className="list-none p-0 m-0 mt-16 grid md:grid-cols-3 gap-12 md:gap-10">
          {RAZOES.map((r, i) => (
            <li key={r.titulo} className="lp-rule-top pt-7" data-reveal style={atraso(i * 90)}>
              <h3 className="lp-h3">{r.titulo}</h3>
              <p className="lp-body mt-3 max-w-[36ch]">{r.texto}</p>
            </li>
          ))}
        </ul>
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
// 06 — Perguntas
// ---------------------------------------------------------------------------

const PERGUNTAS = [
  {
    p: "Preciso instalar alguma coisa?",
    r: "Não. O CORTEX funciona no navegador — no computador do balcão, no tablet ou no celular.",
  },
  {
    p: "O cliente consegue marcar sozinho?",
    r: "Sim. A barbearia ganha uma página própria com os serviços, a equipe e os horários livres. O agendamento entra direto na agenda, e a mensagem de confirmação sai pronta para o WhatsApp — quem envia é a barbearia.",
  },
  {
    p: "Meus barbeiros precisam de e-mail para entrar?",
    r: "Não. Cada profissional recebe um identificador da barbearia e define a própria senha no primeiro acesso.",
  },
  {
    p: "O CORTEX controla caixa e comissão?",
    r: "Sim. O caixa tem abertura, sangria, suprimento e fechamento pelo valor contado. A comissão é calculada a cada atendimento fechado, por profissional.",
  },
  {
    p: "Dá para vender produto também?",
    r: "Sim. O produto entra no próprio atendimento ou numa venda avulsa, e o estoque é baixado na hora.",
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
          <Eyebrow n="06">Perguntas</Eyebrow>
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
// Chamada final + rodapé
// ---------------------------------------------------------------------------

export function ChamadaFinal() {
  return (
    <section id="beta" className="lp-ink lp-section relative overflow-hidden" aria-labelledby="beta-titulo">
      <div aria-hidden className="lp-final-light" />
      <div className="lp-container relative">
        <div className="max-w-4xl" data-reveal>
          <Eyebrow>CORTEX.OS · Beta</Eyebrow>
          <h2 id="beta-titulo" className="lp-h2 mt-5">
            Estamos abrindo o CORTEX uma barbearia de cada vez.
          </h2>
          <p className="lp-lead mt-6 max-w-[46ch]">
            Peça acesso e conte como a sua barbearia funciona hoje. A gente responde, conversa sobre a sua
            operação e acompanha a entrada da sua equipe.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
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
        <div className="flex items-center gap-4">
          <Wordmark tamanho="sm" className="text-[var(--neutral-warm-white)]" />
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
