"use client";

import { useState } from "react";

const ANTES = [
  "47 mensagens no WhatsApp pra marcar 6 horários",
  "Caderno rabiscado: “Lucas 15h?? ou 16h”",
  "Caixa não bate: faltam R$ 40 e ninguém sabe por quê",
  "“Quanto eu te devo de comissão mesmo?”",
  "Cliente sumiu há 2 meses e ninguém percebeu",
];
const DEPOIS = [
  "O cliente marca sozinho pela página da barbearia",
  "Agenda única: balcão e celular de cada barbeiro",
  "Caixa bate — ou você sabe exatamente por quê",
  "Comissão calculada no fechamento, cada um vê a sua",
  "Lista de quem chamar hoje, com mensagem pronta",
];

/** Antes/depois: a pessoa arrasta a linha e transforma o caos em ordem. */
export function AntesDepois() {
  const [pos, setPos] = useState(50);

  return (
    <section className="lp-paper lp-section" aria-labelledby="nv-ad-titulo">
      <div className="lp-container">
        <p className="lp-eyebrow">Antes e depois</p>
        <h2 id="nv-ad-titulo" className="lp-h2 mt-5 max-w-3xl">
          Do caos ao caixa batendo.
        </h2>

        <div className="nv-ad mt-10" style={{ ["--pos" as string]: `${pos}%` }}>
          <div className="nv-ad-lado nv-ad-antes" aria-hidden={pos < 10}>
            <p className="nv-ad-rotulo">Hoje</p>
            <ul>
              {ANTES.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="nv-ad-lado nv-ad-depois">
            <p className="nv-ad-rotulo">Com o CORTEX</p>
            <ul>
              {DEPOIS.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="nv-ad-linha" aria-hidden><span>⇆</span></div>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="nv-ad-range"
            aria-label="Arraste para comparar hoje com o CORTEX"
          />
        </div>
      </div>
    </section>
  );
}
