"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANOS, mensalNoAnual, type Plano } from "@/lib/planos";

/**
 * Planos — BASIC e PRO no escuro, STUDIO no claro e elevado (é o "algo
 * diferenciado" da linha). Abre no Anual, que é o que queremos vender.
 * Sem checkout ainda: o botão leva ao formulário de contato (/beta).
 */
export function Planos() {
  const [anual, setAnual] = useState(true);

  return (
    <section id="planos" className="lp-ink lp-section" aria-labelledby="planos-titulo">
      <div className="lp-container">
        <div className="text-center" data-reveal>
          <p className="lp-eyebrow">Planos</p>
          <h2 id="planos-titulo" className="lp-h2 mt-5">
            Do tamanho da sua cadeira.
          </h2>
          <div
            role="group"
            aria-label="Forma de pagamento"
            className="mt-8 inline-grid grid-cols-2 rounded-md border border-rule-on-ink p-1"
            style={{ background: "#15181E" }}
          >
            <button
              type="button"
              aria-pressed={!anual}
              onClick={() => setAnual(false)}
              className={`min-h-11 whitespace-nowrap rounded-sm px-3 sm:px-5 text-body-sm transition-colors ${!anual ? "bg-neutral-warm-white text-neutral-ink font-semibold" : "text-on-ink-muted"}`}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={anual}
              onClick={() => setAnual(true)}
              className={`min-h-11 whitespace-nowrap rounded-sm px-3 sm:px-5 text-body-sm transition-colors ${anual ? "bg-neutral-warm-white text-neutral-ink font-semibold" : "text-on-ink-muted"}`}
            >
              Anual{" "}
              <span className="ml-1 whitespace-nowrap rounded-full bg-brand-blue px-2 py-0.5 text-micro font-semibold text-white sm:text-caption">2 meses grátis</span>
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:items-stretch">
          {PLANOS.map((p) => (
            <CartaoDoPlano key={p.id} plano={p} anual={anual} />
          ))}
        </div>
        <p className="mt-8 text-center text-caption text-on-ink-muted">
          Plano anual cobrado de uma vez; mensal sem fidelidade. Valores em reais.
        </p>
      </div>
    </section>
  );
}

function CartaoDoPlano({ plano: p, anual }: { plano: Plano; anual: boolean }) {
  const preco = anual ? mensalNoAnual(p) : p.mensal;
  const claro = !!p.claro;
  const cor = claro
    ? { bg: "#F7F8F9", borda: "#F7F8F9", fg: "#0B0D0E", fg2: "#5C636A", linha: "#D3D7DC" }
    : { bg: "#0E111A", borda: p.destaque ? "#1F5BFF" : "rgb(244 244 245 / 12%)", fg: "#F4F4F5", fg2: "#A1A1AA", linha: "rgb(244 244 245 / 10%)" };
  const botao = claro
    ? "bg-neutral-ink text-white"
    : p.destaque
      ? "bg-brand-blue text-white"
      : "border border-white/25 text-on-ink";

  return (
    <article
      data-reveal
      className={`flex flex-col gap-4 rounded-2xl p-7 ${claro ? "md:-translate-y-4" : ""}`}
      style={{
        background: cor.bg,
        border: `1px solid ${cor.borda}`,
        color: cor.fg,
        boxShadow: claro ? "0 40px 100px -30px rgba(244,244,245,.22)" : p.destaque ? "0 40px 100px -30px rgba(31,91,255,.5)" : "none",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-brand text-section-title font-bold tracking-wide">{p.nome}</span>
        <span
          className="rounded-full px-2.5 py-1 text-caption font-semibold"
          style={claro ? { background: "#0B0D0E", color: "#F7F8F9" } : p.destaque ? { background: "#1F5BFF", color: "#fff" } : { background: "rgb(244 244 245 / 8%)", color: "#C9CCD2" }}
        >
          {p.selo}
        </span>
      </div>
      <p className="text-body-sm min-h-11" style={{ color: cor.fg2 }}>{p.para}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-body" style={{ color: cor.fg2 }}>R$</span>
        <span className="font-heading text-[4.5rem] font-bold leading-none tracking-tight">{preco}</span>
        <span className="text-body-sm" style={{ color: cor.fg2 }}>/mês</span>
      </p>
      <p className="text-caption" style={{ color: cor.fg2 }}>
        {anual
          ? `R$ ${p.anual.toLocaleString("pt-BR")} por ano · ou R$ ${p.mensal} no mensal`
          : `ou R$ ${mensalNoAnual(p)}/mês no plano anual`}
      </p>
      <Link href={`/beta?plano=${p.id}`} className={`lp-btn justify-center ${botao}`}>
        Começar com o {p.nome}
      </Link>
      <ul className="mt-1 flex flex-col gap-2.5 pt-4 text-body-sm" style={{ borderTop: `1px solid ${cor.linha}` }}>
        {p.itens.map((i) => (
          <li key={i} className="flex gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden className="mt-0.5 shrink-0">
              <path d="M5 12l5 5 9-10" />
            </svg>
            {i}
          </li>
        ))}
      </ul>
    </article>
  );
}
