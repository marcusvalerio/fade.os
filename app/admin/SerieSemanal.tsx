"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type PontoSemanal = {
  semana: string;
  receita: number;
  agendamentos: number;
  atendimentos: number;
  empresas_novas: number;
};

const METRICAS = [
  { chave: "receita", rotulo: "Receita processada" },
  { chave: "agendamentos", rotulo: "Agendamentos" },
  { chave: "atendimentos", rotulo: "Atendimentos" },
  { chave: "empresas_novas", rotulo: "Empresas novas" },
] as const;

type Chave = (typeof METRICAS)[number]["chave"];

function formatar(chave: Chave, v: number) {
  return chave === "receita"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : v.toLocaleString("pt-BR");
}

function rotuloSemana(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Doze semanas, uma métrica por vez (escalas diferentes nunca dividem um
 * eixo). Barras finas, a semana atual em azul claro cheio, as anteriores
 * em azul translúcido; valor exato no foco/hover e numa tabela para leitor
 * de tela.
 */
export function SerieSemanal({ pontos }: { pontos: PontoSemanal[] }) {
  const [chave, setChave] = useState<Chave>("receita");
  const [ativo, setAtivo] = useState<number | null>(null);
  const valores = pontos.map((p) => Number(p[chave] ?? 0));
  const max = Math.max(...valores, 0);
  const total = valores.reduce((a, b) => a + b, 0);
  const ativoIdx = ativo ?? valores.length - 1;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-subtitle text-caption text-muted">{METRICAS.find((m) => m.chave === chave)?.rotulo} · 12 semanas</p>
          <p className="numero text-metric text-foreground mt-1">{formatar(chave, total)}</p>
          <p className="text-caption text-muted mt-1">
            Semana de {rotuloSemana(pontos[ativoIdx]?.semana ?? "")}:{" "}
            <span className="text-foreground mono">{formatar(chave, valores[ativoIdx] ?? 0)}</span>
          </p>
        </div>
        <div role="radiogroup" aria-label="Métrica" className="inline-flex flex-wrap rounded-sm border border-border p-0.5 text-caption">
          {METRICAS.map((m) => (
            <button
              key={m.chave}
              type="button"
              role="radio"
              aria-checked={chave === m.chave}
              onClick={() => setChave(m.chave)}
              className={cn(
                "px-2.5 py-1 rounded-xs transition-colors duration-micro",
                chave === m.chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      {max === 0 ? (
        <p className="text-body-sm text-muted mt-8 mb-4">Nenhum registro nas últimas 12 semanas para esta métrica.</p>
      ) : (
        <div className="mt-6 flex items-end gap-1.5 h-40" aria-hidden="true" onMouseLeave={() => setAtivo(null)}>
          {valores.map((v, i) => (
            <button
              key={pontos[i].semana}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              className="group relative flex-1 h-full flex flex-col justify-end"
            >
              <span
                className={cn(
                  "block w-full origin-bottom animate-[crescer-y_var(--duration-momento)_var(--ease-emphasized)_both] motion-reduce:animate-none transition-colors duration-micro",
                  i === ativoIdx ? "bg-primary" : "bg-primary/25 group-hover:bg-primary/50"
                )}
                style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%`, animationDelay: `calc(${i} * 30ms)` }}
              />
            </button>
          ))}
        </div>
      )}
      {max > 0 && (
        <div className="mt-2 flex justify-between text-micro text-muted mono">
          <span>{rotuloSemana(pontos[0]?.semana ?? "")}</span>
          <span>{rotuloSemana(pontos[pontos.length - 1]?.semana ?? "")}</span>
        </div>
      )}

      <table className="sr-only">
        <caption>{METRICAS.find((m) => m.chave === chave)?.rotulo} por semana</caption>
        <tbody>
          {pontos.map((p, i) => (
            <tr key={p.semana}>
              <th scope="row">Semana de {rotuloSemana(p.semana)}</th>
              <td>{formatar(chave, valores[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
