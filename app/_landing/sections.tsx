import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { PRECO_REFERENCIA_MENSAL, PLANOS_DISPONIVEIS_A_PARTIR_DE } from "@/lib/beta";
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
              Menos tempo no WhatsApp marcando horário, caixa que bate no fim do dia, comissão sem conta de cabeça e
              cliente que volta no ritmo dele. No balcão e no celular de cada barbeiro.
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
            Um fechamento grava venda, pagamento, caixa, comissão, estoque e agenda de uma vez, e o histórico do
            cliente já conta a visita. Se alguma parte falha, nada fica gravado pela metade.
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
            O que muda no fim do dia.
          </h2>
        </div>

        <div className="lp-provas mt-14 lg:mt-20">
          <article className="lp-prova" data-reveal>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">O caixa bate — ou você sabe por quê.</h3>
              <p className="lp-body mt-2">
                O CORTEX já sabe quanto deveria ter na gaveta: abertura, o que entrou e o que saiu. Você conta, ele
                mostra a diferença e guarda o motivo junto do fechamento.
              </p>
            </div>
            <EmCena className="lp-prova-tela">
              <FecharCaixaModal />
            </EmCena>
          </article>

          <article className="lp-prova" data-reveal style={atraso(80)}>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">O cliente volta.</h3>
              <p className="lp-body mt-2">
                Cada cliente tem o próprio ritmo. Quem passou do prazo aparece em “Clientes para chamar hoje”, com a
                mensagem pronta para o WhatsApp — e o fechamento do atendimento já sugere a próxima visita.
              </p>
            </div>
            <div className="lp-prova-tela">
              <ProductWindow
                area="clientes"
                descricao="Clientes no CORTEX: um cliente que costuma voltar a cada 30 dias e já está há 52 aparece em atenção; outro, que volta a cada 25 dias e está há 80, em recuperação."
              >
                <ClientesRitmo />
              </ProductWindow>
            </div>
          </article>

          <article className="lp-prova" data-reveal>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">Comissão sem discussão.</h3>
              <p className="lp-body mt-2">
                Cada barbeiro vê a própria agenda e o que tem a receber; o dono vê a barbearia inteira e paga com um
                toque. Cada permissão é conferida no próprio banco de dados.
              </p>
            </div>
            <div className="lp-prova-tela lp-prova-tela-livre">
              <Papeis menu={MENU_POR_PAPEL} />
            </div>
          </article>

          <article className="lp-prova" data-reveal style={atraso(80)}>
            <div className="lp-prova-texto">
              <h3 className="lp-h3">Você sabe como foi o mês.</h3>
              <p className="lp-body mt-2">
                Faturamento, ticket e atendimentos contra o período anterior, e quanto falta para a meta. Tudo sai
                do que aconteceu no balcão — ninguém monta planilha.
              </p>
            </div>
            <div className="lp-prova-tela">
              <ProductWindow
                area="inicio"
                descricao="Início do CORTEX nos últimos 7 dias: faturamento, recebido, ticket médio e atendimentos, cada um comparado com o período anterior, a divisão entre serviços e produtos e o avanço da meta do mês."
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
    r: "Sim. A barbearia ganha uma página própria com serviços, equipe e horários livres — os mesmos que a recepção vê. O horário entra direto na agenda, e a confirmação sai pronta para o WhatsApp. Quem envia é a barbearia.",
  },
  {
    p: "Meus barbeiros precisam de e-mail?",
    r: "Não. Cada profissional recebe um identificador da barbearia e define a própria senha no primeiro acesso.",
  },
  {
    p: "Já tenho minha lista de clientes. Perco tudo?",
    r: "Não. Você importa a planilha que já tem (Excel ou CSV), confere antes de entrar e o CORTEX não duplica quem já está cadastrado.",
  },
  {
    p: "E o meu cliente, o que ele consegue fazer?",
    r: "Marcar pela página da barbearia e, se quiser, criar uma conta (com e-mail ou Google) para ver os próprios horários, mudar ou cancelar quando ainda dá tempo e avaliar o atendimento.",
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
    p: "Quanto custa?",
    r: `O CORTEX é um produto pago: o plano completo tem valor de referência de ${formatCurrency(PRECO_REFERENCIA_MENSAL).replace(",00", "")} por mês. Durante o beta não há cobrança nem contratação. Os planos abrem em ${PLANOS_DISPONIVEIS_A_PARTIR_DE}, e continuar é decisão sua.`,
  },
  {
    p: "Como funciona o Beta?",
    r: "Você pede acesso com o nome da barbearia e um contato. A gente conversa sobre a sua operação e libera a conta. Cada barbearia entra acompanhada, e dezembro, o mês mais cheio do ano, faz parte do teste de verdade.",
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
          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-rule-on-ink pt-6 text-body">
            <div>
              <dt className="lp-body text-caption">Plano completo</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <s className="lp-body" aria-label={`Valor de referência: ${formatCurrency(PRECO_REFERENCIA_MENSAL)} por mês`}>
                  {formatCurrency(PRECO_REFERENCIA_MENSAL).replace(",00", "")}/mês
                </s>
                <span className="lp-strong">sem cobrança no beta</span>
              </dd>
            </div>
            <div>
              <dt className="lp-body text-caption">Planos</dt>
              <dd className="lp-strong mt-1">a partir de {PLANOS_DISPONIVEIS_A_PARTIR_DE}</dd>
            </div>
          </dl>
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
