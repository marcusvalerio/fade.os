"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * O momento "isso é diferente" da landing: um atendimento fechado e o sinal
 * (o quadrado azul) saindo dele para cada módulo que recebe o registro —
 * agenda, caixa, comissão, estoque, cliente, Início. É a transação real do
 * CORTEX (close_attendance) mostrada como ela é: uma coisa só, escrita em
 * todo lugar ao mesmo tempo.
 *
 * Toca sozinho uma vez, quando a seção entra na tela. Depois, o botão refaz.
 * Todo o movimento é CSS (landing.css, .lp-pulso-*): este componente só
 * troca `data-estado` e remonta o palco para repetir do zero. Com
 * prefers-reduced-motion não há reprodução automática nem viagem do sinal —
 * o botão alterna os dois estados na hora.
 */
export function Pulso({
  atendimento,
  modulos,
}: {
  atendimento: React.ReactNode;
  modulos: { chave: string; conteudo: React.ReactNode }[];
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"antes" | "depois">("antes");
  const [rodada, setRodada] = useState(0);

  const fechar = useCallback(() => setEstado("depois"), []);

  const repetir = useCallback(() => {
    setEstado("antes");
    setRodada((r) => r + 1);
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduzido) window.setTimeout(() => setEstado("depois"), 420);
  }, []);

  useEffect(() => {
    const el = raiz.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        id = window.setTimeout(fechar, 700);
        io.disconnect();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(id);
    };
  }, [fechar]);

  const esquerda = modulos.slice(0, 3);
  const direita = modulos.slice(3);

  return (
    <div ref={raiz} className="lp-pulso" data-estado={estado}>
      <div key={rodada} className="lp-pulso-palco">
        <ul className="lp-pulso-coluna lp-pulso-esquerda" aria-label="Onde o fechamento aparece">
          {esquerda.map((m, i) => (
            <Modulo key={m.chave} i={i} lado="esquerda">
              {m.conteudo}
            </Modulo>
          ))}
        </ul>

        <div className="lp-pulso-centro">
          <div className="lp-pulso-card light">
            {atendimento}
            <button
              type="button"
              className="lp-pulso-botao"
              onClick={estado === "antes" ? fechar : repetir}
              aria-label={estado === "antes" ? "Fechar e receber" : "Ver o fechamento de novo"}
              aria-describedby="lp-pulso-status"
            >
              <span className="lp-pulso-botao-antes">Fechar e receber</span>
              <span className="lp-pulso-botao-depois" aria-hidden>
                Ver de novo
              </span>
            </button>
          </div>
        </div>

        <ul className="lp-pulso-coluna lp-pulso-direita" aria-label="Onde o fechamento aparece">
          {direita.map((m, i) => (
            <Modulo key={m.chave} i={i + 3} lado="direita">
              {m.conteudo}
            </Modulo>
          ))}
        </ul>
      </div>

      <p id="lp-pulso-status" className="sr-only" aria-live="polite">
        {estado === "depois"
          ? "Atendimento fechado. Agenda, caixa, comissão, estoque, cliente e Início atualizados no mesmo instante."
          : ""}
      </p>
    </div>
  );
}

function Modulo({ i, lado, children }: { i: number; lado: "esquerda" | "direita"; children: React.ReactNode }) {
  return (
    <li className="lp-pulso-modulo light" data-lado={lado} style={{ ["--i" as string]: i }}>
      <span aria-hidden className="lp-pulso-fio">
        <span className="lp-pulso-sinal" />
      </span>
      <span aria-hidden className="lp-pulso-marca" />
      {children}
    </li>
  );
}
