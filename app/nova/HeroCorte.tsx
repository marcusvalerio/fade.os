"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANOS_DISPONIVEIS_A_PARTIR_DE } from "@/lib/beta";

/** Os cinco lugares que um fechamento escreve — dados de exemplo. */
const EFEITOS = [
  { area: "Agenda", valor: "Concluído", detalhe: "10:30 · Thiago Rocha" },
  { area: "Caixa", valor: "+ R$ 85", detalhe: "Pix · entrou agora" },
  { area: "Comissão", valor: "+ R$ 34", detalhe: "Rafael · 40%" },
  { area: "Estoque", valor: "11 → 10", detalhe: "Pomada modeladora" },
  { area: "Cliente", valor: "~21 dias", detalhe: "Próxima visita sugerida" },
];

export function HeroCorte() {
  // Trocar a key reinicia a sequência inteira (CSS puro).
  const [rodada, setRodada] = useState(0);

  return (
    <section className="lp-ink nv-hero" aria-labelledby="nv-hero-titulo">
      <div className="nv-hero-luz" aria-hidden />
      <div className="lp-container relative pt-16 sm:pt-24 pb-20 lg:pb-28">
        <p className="lp-eyebrow nv-entra" style={{ ["--d" as string]: "0ms" }}>
          Sistema operacional para barbearias
        </p>
        <h1 id="nv-hero-titulo" className="nv-h1 mt-6">
          <span className="nv-entra" style={{ ["--d" as string]: "120ms" }}>Um corte.</span>{" "}
          <span className="nv-entra nv-h1-brilho" style={{ ["--d" as string]: "380ms" }}>
            Tudo resolvido.
          </span>
        </h1>
        <p className="lp-lead mt-7 max-w-2xl nv-entra" style={{ ["--d" as string]: "600ms" }}>
          Você fecha o atendimento. No mesmo segundo, a agenda, o caixa, a comissão, o estoque e o cliente já
          sabem. Sem caderno, sem calculadora, sem “depois eu anoto”.
        </p>

        <div key={rodada} className="nv-palco mt-12 lg:mt-16" role="img"
          aria-label="Ao tocar em Fechar atendimento, agenda, caixa, comissão, estoque e ficha do cliente são atualizados ao mesmo tempo.">
          <div className="nv-atendimento">
            <div>
              <p className="nv-mini">Atendimento · 10:30</p>
              <p className="nv-forte">Thiago Rocha</p>
              <p className="nv-mini">Corte + Barba · Pomada</p>
            </div>
            <span className="nv-botao-fechar">
              Fechar atendimento <span className="nv-preco">R$ 85</span>
            </span>
          </div>

          <div className="nv-fio" aria-hidden>
            <span className="nv-fio-luz" />
          </div>

          <ul className="nv-efeitos">
            {EFEITOS.map((e, i) => (
              <li key={e.area} className="nv-efeito" style={{ ["--i" as string]: i }}>
                <span className="nv-mini">{e.area}</span>
                <span className="nv-valor">{e.valor}</span>
                <span className="nv-mini">{e.detalhe}</span>
              </li>
            ))}
          </ul>
          <p className="nv-carimbo">Tudo isso em 1 toque.</p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/beta" className="lp-btn lp-btn-primary nv-cta">
            Quero no meu balcão
          </Link>
          <button type="button" onClick={() => setRodada((r) => r + 1)} className="lp-nav-link min-h-11">
            ↻ Ver de novo
          </button>
        </div>
        <p className="nv-mini mt-5">
          Abrindo uma barbearia de cada vez · Beta sem cobrança · planos a partir de {PLANOS_DISPONIVEIS_A_PARTIR_DE}
        </p>
      </div>
    </section>
  );
}
