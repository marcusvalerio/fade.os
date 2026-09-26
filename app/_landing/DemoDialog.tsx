"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

export const DEMO_VIDEO = "/demo/cortex-em-acao.mp4";
export const DEMO_POSTER = "/demo/cortex-em-acao.jpg";

/** Duração do filme (videos/cortex-em-acao, 38,8 s), arredondada para o rótulo. */
const DEMO_DURACAO = "39 s";

/**
 * O que o filme mostra, em texto. O vídeo é silencioso e toda a informação
 * dele é visual — sem esta lista, quem não enxerga a tela perde tudo
 * (WCAG 1.2.1, mídia só de vídeo). Segue a ordem dos frames do STORYBOARD.md.
 */
const ROTEIRO = [
  "O cliente escolhe Corte + Barba na página da barbearia, pelo celular, e o agendamento das 09:30 fica confirmado.",
  "O horário aparece na Agenda como Agendado. O botão WhatsApp abre a mensagem de confirmação já escrita; depois, Confirmar muda a linha para Confirmado.",
  "O cliente chega e o atendimento começa: a linha passa a Em atendimento e os contadores do dia se ajustam.",
  "No atendimento (Corte + Barba e uma pomada, R$ 112,00), Fechar e receber abre o fechamento: pagamento em dinheiro, completo, e Confirmar e fechar.",
  "No Caixa, o saldo esperado passa de R$ 445,00 para R$ 557,00, a venda entra nas movimentações e a comissão do barbeiro aparece como devida.",
  "O Início mostra os números da semana e a lista de Clientes aponta quem está demorando a voltar.",
  "Fecha com a marca CORTEX.OS e o convite para pedir acesso ao Beta. As telas são do CORTEX, com dados de exemplo.",
];

/**
 * "Ver o CORTEX em ação" — o filme do produto (composto e renderizado com
 * HyperFrames, ver videos/cortex-em-acao/) num <dialog> nativo: foco
 * preso, Esc fecha, backdrop do navegador. O vídeo só é pedido ao servidor
 * quando a pessoa abre o diálogo — zero bytes para quem não clica.
 */
export function DemoButton({
  className,
  rotulo = "Ver o CORTEX em ação",
  variante = "link",
}: {
  className?: string;
  rotulo?: string;
  variante?: "link" | "quiet";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aberto, setAberto] = useState(false);

  function abrir() {
    setAberto(true);
    dialogRef.current?.showModal();
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  }

  function fechar() {
    videoRef.current?.pause();
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={cn("lp-btn", variante === "link" ? "lp-btn-link" : "lp-btn-quiet", className)}
        aria-haspopup="dialog"
      >
        <span className="lp-btn-play" aria-hidden>
          <span>▶</span>
        </span>
        {rotulo}
        <span className="lp-btn-meta">{DEMO_DURACAO}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="lp-dialog"
        aria-label="Demonstração do CORTEX.OS"
        onClose={() => videoRef.current?.pause()}
        onClick={(e) => {
          if (e.target === dialogRef.current) fechar();
        }}
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5" style={{ background: "var(--neutral-ink)" }}>
          <p className="text-body-sm font-medium" style={{ color: "var(--neutral-warm-white)" }}>
            CORTEX.OS em ação
          </p>
          <button
            type="button"
            onClick={fechar}
            className="text-body-sm min-h-10 px-2 -mr-2"
            style={{ color: "rgb(232 230 221 / 72%)" }}
          >
            Fechar
          </button>
        </div>
        {aberto && (
          <video
            ref={videoRef}
            className="block w-full h-auto aspect-video bg-black"
            src={DEMO_VIDEO}
            poster={DEMO_POSTER}
            controls
            autoPlay
            playsInline
            preload="auto"
          >
            Seu navegador não reproduz vídeo. O roteiro abaixo descreve o que ele mostra.
          </video>
        )}
        <details className="lp-dialog-roteiro">
          <summary>O que o vídeo mostra</summary>
          <ol>
            {ROTEIRO.map((passo) => (
              <li key={passo}>{passo}</li>
            ))}
          </ol>
        </details>
      </dialog>
    </>
  );
}
