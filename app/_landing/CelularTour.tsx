"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "./product-chrome";
import { cn } from "@/lib/cn";

export type TelaDoTour = {
  chave: string;
  rotulo: string;
  titulo: string;
  texto: string;
  tela: React.ReactNode;
};

/**
 * O CORTEX no celular do barbeiro — um aparelho só, e a tela dele muda:
 * a agenda do dia → o atendimento aberto → o cliente que está na cadeira.
 * É a mesma pessoa, no mesmo turno, passando de um contexto para outro.
 *
 * Avança sozinho a cada ~5,5s enquanto a seção está na tela (a barra de cada
 * aba mostra o tempo), com botão de pausa sempre visível (WCAG 2.2.2) e
 * pausa automática quando o ponteiro ou o foco estão sobre o tour. Tocar numa
 * aba troca na hora. Com prefers-reduced-motion não há avanço automático nem
 * deslizamento — as telas só se substituem.
 *
 * A troca de tela e a entrada em sequência dos elementos (`.lp-cel-item`,
 * com `--n` = ordem) são CSS; aqui só se decide qual tela está ativa.
 */
export function CelularTour({ telas, cabecalho }: { telas: TelaDoTour[]; cabecalho?: React.ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    setReduzido(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = raiz.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rodando = visivel && !pausado && !sobre && !reduzido;

  return (
    <div
      ref={raiz}
      className="lp-tour"
      data-rodando={rodando ? "" : undefined}
      onPointerEnter={() => setSobre(true)}
      onPointerLeave={() => setSobre(false)}
      onFocus={() => setSobre(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(false);
      }}
    >
      {cabecalho && <div className="lp-tour-cabecalho">{cabecalho}</div>}

      <div className="lp-tour-aparelho">
        <PhoneFrame tamanho="lg" descricao={`CORTEX no celular do profissional: ${telas[ativa].titulo}`}>
          <div className="lp-cel-palco">
            {telas.map((t, i) => (
              <div
                key={t.chave}
                className="lp-cel-tela"
                data-estado={i === ativa ? "ativa" : i < ativa ? "passou" : "espera"}
              >
                {t.tela}
              </div>
            ))}
          </div>
        </PhoneFrame>
      </div>

      <div role="tablist" aria-label="Telas do CORTEX no celular" className="lp-tour-abas">
        {telas.map((t, i) => (
          <button
            key={t.chave}
            type="button"
            role="tab"
            id={`lp-tour-aba-${t.chave}`}
            aria-selected={i === ativa}
            aria-controls="lp-tour-painel"
            tabIndex={i === ativa ? 0 : -1}
            className="lp-tour-aba"
            onClick={() => setAtiva(i)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const proxima = (i + (e.key === "ArrowRight" ? 1 : telas.length - 1)) % telas.length;
              setAtiva(proxima);
              document.getElementById(`lp-tour-aba-${telas[proxima].chave}`)?.focus();
            }}
          >
            <span className="lp-tour-aba-rotulo">{t.rotulo}</span>
            <span aria-hidden className="lp-tour-progresso">
              <span
                key={`${t.chave}-${ativa}`}
                className={cn("lp-tour-progresso-barra", i < ativa && "is-cheia")}
                data-ativa={i === ativa ? "" : undefined}
                onAnimationEnd={() => {
                  if (i === ativa) setAtiva((a) => (a + 1) % telas.length);
                }}
              />
            </span>
          </button>
        ))}
      </div>

      <div className="lp-tour-texto">
        <div
          id="lp-tour-painel"
          role="tabpanel"
          aria-labelledby={`lp-tour-aba-${telas[ativa].chave}`}
          className="lp-tour-painel"
        >
          <h3 key={telas[ativa].chave} className="lp-h3 lp-tour-titulo">
            {telas[ativa].titulo}
          </h3>
          <p key={`${telas[ativa].chave}-t`} className="lp-body mt-3 max-w-[38ch] lp-tour-titulo">
            {telas[ativa].texto}
          </p>
        </div>

        {!reduzido && (
          <button type="button" className="lp-tour-pausa" onClick={() => setPausado((p) => !p)} aria-pressed={pausado}>
            <span aria-hidden className="lp-tour-pausa-icone" data-pausado={pausado ? "" : undefined} />
            {pausado ? "Continuar" : "Pausar"}
          </button>
        )}
      </div>
    </div>
  );
}
