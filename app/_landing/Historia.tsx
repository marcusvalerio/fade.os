import { cn } from "@/lib/cn";
import { ProductWindow, PhoneFrame } from "./product-chrome";
import {
  quando,
  AgendaDaHistoria,
  MensagemPronta,
  AtendimentoDaHistoria,
  FecharAtendimentoModal,
  CaixaDaHistoria,
  AgendamentoConfirmado,
} from "./screens";
import { StoryScroller } from "./StoryScroller";

const PASSOS = [
  {
    titulo: "Marcou pelo celular.",
    texto:
      "Pela página da barbearia, sem ligar e sem esperar resposta. O horário entra na agenda na mesma hora — com serviço, profissional e preço.",
  },
  {
    titulo: "Confirmou pelo WhatsApp.",
    texto:
      "Um toque abre a conversa com a mensagem pronta. Com a resposta do cliente, outro toque marca o horário como confirmado.",
  },
  {
    titulo: "Chegou, sentou, começou.",
    texto:
      "Cliente chegou, iniciar atendimento. O serviço e o profissional já vêm do agendamento — ninguém cadastra nada de novo.",
  },
  {
    titulo: "Fechou e recebeu.",
    texto:
      "Serviço e produto no mesmo atendimento. A forma de pagamento é escolhida no fechamento, e o sistema confere se o valor fecha.",
  },
  {
    titulo: "Caixa e comissão, no mesmo instante.",
    texto:
      "O dinheiro entra no saldo esperado da gaveta. A comissão de quem atendeu já aparece como devida — sem planilha no fim do mês.",
  },
] as const;

type Camada = "agenda" | "atendimento" | "caixa";

function camadaDoPasso(passo: number): Camada {
  return passo <= 3 ? "agenda" : passo === 4 ? "atendimento" : "caixa";
}

/**
 * O palco: três telas reais empilhadas no mesmo lugar (Agenda,
 * Atendimento, Caixa). `data-step` decide qual aparece e em que estado.
 * `isolado` renderiza só a tela do passo — usado nos quadros estáticos do
 * celular, onde não existe palco fixo.
 */
function Palco({ passo, id, isolado = false }: { passo: number; id?: string; isolado?: boolean }) {
  const mostra = (c: Camada) => !isolado || camadaDoPasso(passo) === c;
  const popSobre = isolado ? "relative mt-4" : "absolute";

  return (
    <div id={id} className="lp-stage" data-step={passo}>
      {mostra("agenda") && (
        <div className="lp-layer" {...quando(1, 2, 3)}>
          <div className="relative">
            <ProductWindow
              area="agenda"
              descricao="Agenda do CORTEX: o horário de Bruno Alves, 09:30, Corte + Barba com Diego, passando de Agendado para Confirmado e depois Em atendimento, com os contadores do dia acompanhando."
            >
              <AgendaDaHistoria />
            </ProductWindow>
            <div className={cn("lp-pop", popSobre, !isolado && "lg:-left-16 xl:-left-32 -top-24 z-10")} {...quando(1)}>
              <PhoneFrame
                tamanho="sm"
                descricao="No celular do cliente, a página da barbearia confirma o agendamento de Corte + Barba às 09:30."
                className={isolado ? "-mt-24 ml-auto mr-2 w-fit" : undefined}
              >
                <AgendamentoConfirmado hora="09:30" />
              </PhoneFrame>
            </div>
            <div className={cn("lp-pop", popSobre, !isolado && "-left-36 top-[24.5rem] z-10")} {...quando(2)}>
              <MensagemPronta />
            </div>
          </div>
        </div>
      )}

      {mostra("atendimento") && (
        <div className="lp-layer" {...quando(4)}>
          <div className="relative">
            <ProductWindow
              area="agenda"
              descricao="Atendimento de Bruno Alves em andamento: Corte + Barba por R$ 75 e uma pomada por R$ 37, total R$ 112, fechado em dinheiro no modal Fechar atendimento."
            >
              <AtendimentoDaHistoria />
            </ProductWindow>
            <div className={cn("lp-pop lp-late", popSobre, !isolado && "right-6 -bottom-20 z-10")} {...quando(4)}>
              <FecharAtendimentoModal />
            </div>
          </div>
        </div>
      )}

      {mostra("caixa") && (
        <div className="lp-layer" {...quando(5)}>
          <ProductWindow
            area="negocio"
            descricao="Caixa do balcão: o saldo esperado sobe de R$ 445 para R$ 557 com a venda de R$ 112 em dinheiro, e a comissão de R$ 30 de Diego aparece como devida."
          >
            <CaixaDaHistoria />
          </ProductWindow>
        </div>
      )}
    </div>
  );
}

function TextoDoPasso({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <div className="lp-story-step-text">
      <p className="lp-eyebrow">
        <span className="lp-eyebrow-num">{String(n).padStart(2, "0")}</span>
      </p>
      <h3 className="lp-h3 mt-3">{titulo}</h3>
      <p className="lp-body mt-3 max-w-[34ch]">{texto}</p>
    </div>
  );
}

export function Historia() {
  return (
    <section id="operacao" className="lp-ink lp-section" aria-labelledby="operacao-titulo">
      <div className="lp-container">
        <div className="max-w-3xl" data-reveal>
          <p className="lp-eyebrow">
            <span className="lp-eyebrow-num">02</span>A operação
          </p>
          <h2 id="operacao-titulo" className="lp-h2 mt-5">
            Um cliente, do celular ao caixa.
          </h2>
          <p className="lp-lead mt-6">
            Acompanhe um Corte + Barba marcado para as 09:30. Cada passo abaixo é uma tela real do CORTEX mudando
            de estado.
          </p>
        </div>

        {/* Desktop: texto rola, o palco fica. */}
        <div className="hidden lg:grid grid-cols-[minmax(0,4fr)_minmax(0,7fr)] gap-16 mt-10">
          <ol id="lp-story-steps" className="list-none p-0 m-0">
            {PASSOS.map((p, i) => (
              <li
                key={p.titulo}
                className="lp-story-step"
                data-story-step={i + 1}
                data-current={i === 0 ? "" : undefined}
              >
                <TextoDoPasso n={i + 1} titulo={p.titulo} texto={p.texto} />
              </li>
            ))}
          </ol>
          <div>
            <div className="lp-story-sticky">
              <Palco passo={1} id="lp-story-stage" />
            </div>
          </div>
        </div>

        {/* Celular e tablet: cada passo com a própria tela, parada. */}
        <ol className="lg:hidden list-none p-0 m-0 mt-14 space-y-20">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} data-reveal>
              <TextoDoPasso n={i + 1} titulo={p.titulo} texto={p.texto} />
              <div className="mt-8">
                <Palco passo={i + 1} isolado />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <StoryScroller stageId="lp-story-stage" stepsId="lp-story-steps" />
    </section>
  );
}
