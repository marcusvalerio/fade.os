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
        <Link href="/" aria-label="CORTEX.OS — início" className="shrink-0 text-neutral-warm-white">
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
          <Link href="/beta" className="lp-btn lp-btn-primary lp-btn-sm hidden xs:inline-flex">
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
        <div className="grid lg:grid-cols-(--grade-destaque) gap-7 lg:gap-12 lg:items-end">
          <div>
            <Rotulo>Sistema operacional para barbearias</Rotulo>
            <h1 id="hero-titulo" className="lp-h1 mt-5">
              Cada corte move a barbearia inteira.
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="lp-lead">
              O sistema que roda a barbearia: agenda, atendimento, caixa, comissão, estoque e clientes, no balcão e
              no celular de cada barbeiro.
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
          <div className="lp-hero-window lp-hero-crop lg:ml-55">
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
        <div className="grid lg:grid-cols-(--grade-editorial) gap-6 lg:gap-16 lg:items-end" data-reveal>
          <div>
            <Rotulo>O sistema</Rotulo>
            <h2 id="sistema-titulo" className="lp-h2 mt-5">
              Fechou o atendimento. O resto já sabe.
            </h2>
          </div>
          <p className="lp-lead lg:pb-1.5">
            Um fechamento grava venda, caixa, comissão, estoque, agenda e cliente de uma vez. Se alguma parte
            falha, nada fica gravado pela metade.
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
                texto: "A pomada vendida na cadeira entra no atendimento e sai do estoque quando ele fecha.",
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
            O que o caderno não faz.
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
                clientes. E cada permissão é conferida no próprio banco de dados.
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
    r: "Não. O CORTEX abre no navegador: no computador do balcão, no tablet ou no celular.",
  },
  {
    p: "O cliente consegue marcar sozinho?",
    r: "Sim. A barbearia ganha uma página própria com serviços, equipe e horários livres. O horário entra direto na agenda, e a confirmação sai pronta para o WhatsApp. Quem envia é a barbearia.",
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
    r: "Você pede acesso com o nome da barbearia e um contato. A gente conversa sobre a sua operação e libera a conta. Cada barbearia entra acompanhada.",
  },
];

export function Perguntas() {
  return (
    <section id="perguntas" className="lp-paper lp-section" aria-labelledby="perguntas-titulo">
      <div className="lp-container grid lg:grid-cols-(--grade-indice) gap-12 lg:gap-16">
        <div data-reveal>
          <Rotulo>Perguntas</Rotulo>
          <h2 id="perguntas-titulo" className="lp-h2 mt-5">
            Perguntas diretas.
          </h2>
          <p className="lp-body mt-5 max-w-measure">
            Não achou a sua? Mande junto com o pedido de acesso.
          </p>
        </div>
        <div className="lp-faq border-b border-rule-on-paper" data-reveal style={atraso(100)}>
          {PERGUNTAS.map((q) => (
            <details key={q.p} className="lp-rule-top group">
              <summary className="flex items-start justify-between gap-6 py-6">
                <span className="lp-strong text-section-title">{q.p}</span>
                <span className="lp-faq-icon text-neutral-ink" aria-hidden />
              </summary>
              <p className="lp-body pb-7 -mt-1 max-w-measure-long">{q.r}</p>
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
          <p className="lp-lead mt-6 max-w-measure">
            Conte como a sua barbearia funciona hoje. A gente responde, conversa sobre a operação e acompanha a
            entrada da equipe.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-4">
            <Link href="/beta" className="lp-btn lp-btn-primary">
              Pedir acesso ao Beta
            </Link>
            <DemoButton />
          </div>
          <p className="lp-body mt-8 text-body">
            Já tem acesso?{" "}
            <Link href="/login" className="lp-strong underline underline-offset-4 decoration-on-ink/35 hover:decoration-current">
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
      <div className="lp-container py-10 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-6 border-t border-rule-on-ink">
        <div className="flex items-center gap-4 text-neutral-warm-white">
          <Wordmark tamanho="sm" />
          <span className="text-caption text-on-ink-muted">
            Sistema operacional para barbearias
          </span>
        </div>
        <p className="text-caption text-on-ink-muted sm:order-last sm:basis-full">
          As telas desta página são do CORTEX, com dados de exemplo.
        </p>
        <nav aria-label="Rodapé" className="flex items-center gap-6">
          <Link href="/login" className="lp-nav-link">
            Entrar
          </Link>
          <Link href="/beta" className="lp-nav-link">
            Pedir acesso
          </Link>
          <span className="text-caption text-on-ink-muted">
            © {new Date().getFullYear()} CORTEX.OS
          </span>
        </nav>
      </div>
    </footer>
  );
}
