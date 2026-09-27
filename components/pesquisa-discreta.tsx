"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { buscarPesquisaPendente, marcarPesquisaExibida, dispensarPesquisa, responderPesquisa } from "@/actions/pesquisas";
import { normalizarResposta, LIMITE_DO_TEXTO, type PesquisaPendente, type Resposta } from "@/lib/pesquisas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * Pesquisa in-app, discreta: um cartão no canto, nunca um modal. Aparece
 * alguns segundos depois de a tela abrir, não rouba o foco, e some nas
 * telas em que a pessoa está no meio de uma operação (fechar atendimento,
 * vender, caixa). Fechar = dispensar: a mesma pesquisa não volta (o banco
 * guarda isso por pessoa).
 */

const ESPERA_ANTES_DE_BUSCAR_MS = 8000;
// Fluxos em que interromper custa caro — o cartão espera a pessoa sair.
const ROTAS_DE_FOCO = [/^\/atendimentos\/[^/]+/, /^\/vendas\/nova/, /^\/caixa/, /^\/onboarding/, /\/agendar/];

type Estado = "oculta" | "aberta" | "enviando" | "obrigado";

export function PesquisaDiscreta({ area, empresaId }: { area: "equipe" | "cliente"; empresaId: string }) {
  const pathname = usePathname();
  const [pesquisa, setPesquisa] = useState<PesquisaPendente | null>(null);
  const [estado, setEstado] = useState<Estado>("oculta");
  const [valor, setValor] = useState<Resposta | null>(null);
  const [comentario, setComentario] = useState("");
  const [comentarAberto, setComentarAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const exibidaRef = useRef(false);
  const tituloId = useId();

  const emFoco = ROTAS_DE_FOCO.some((r) => r.test(pathname ?? ""));

  useEffect(() => {
    let cancelado = false;
    const t = window.setTimeout(() => {
      buscarPesquisaPendente(area, empresaId)
        .then((p) => {
          if (!cancelado && p) {
            setPesquisa(p);
            setEstado("aberta");
          }
        })
        .catch(() => {});
    }, ESPERA_ANTES_DE_BUSCAR_MS);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [area, empresaId]);

  const visivel = pesquisa && estado !== "oculta" && (!emFoco || estado === "obrigado");

  // Conta como exibida só quando aparece de fato na tela.
  useEffect(() => {
    if (visivel && pesquisa && !exibidaRef.current) {
      exibidaRef.current = true;
      void marcarPesquisaExibida(pesquisa.id, area, empresaId).catch(() => {});
    }
  }, [visivel, pesquisa, area, empresaId]);

  if (!visivel || !pesquisa) return null;

  const normalizada = valor === null ? null : normalizarResposta(pesquisa.tipo, pesquisa.opcoes, valor);

  function fechar() {
    if (!pesquisa) return;
    const id = pesquisa.id;
    setEstado("oculta");
    iniciar(async () => {
      await dispensarPesquisa(id, area, empresaId).catch(() => {});
    });
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pesquisa || normalizada === null) {
      setErro("Escolha uma resposta.");
      return;
    }
    setErro(null);
    setEstado("enviando");
    iniciar(async () => {
      const r = await responderPesquisa(pesquisa.id, area, empresaId, normalizada, comentario.trim() || undefined);
      if (!r.ok) {
        setErro(r.error);
        setEstado("aberta");
        return;
      }
      setEstado("obrigado");
      window.setTimeout(() => setEstado("oculta"), 2600);
    });
  }

  return (
    <section
      aria-labelledby={tituloId}
      className={cn(
        "fixed z-[var(--z-dropdown)] inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]",
        "max-h-[min(34rem,calc(100dvh-1.5rem))] overflow-y-auto",
        "rounded-md border border-border bg-surface text-foreground shadow-[var(--shadow-md)]",
        "animate-rise-in motion-reduce:animate-none"
      )}
    >
      {estado === "obrigado" ? (
        <div className="flex items-start gap-3 p-4" role="status">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-brand-blue" />
          <div>
            <p id={tituloId} className="text-body-sm font-medium text-foreground">Obrigado.</p>
            <p className="text-caption text-muted mt-0.5">Sua resposta vai direto para quem decide o que o CORTEX melhora.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-subtitle text-micro uppercase tracking-label text-muted flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 bg-brand-blue" />
                Pesquisa rápida
              </p>
              <h2 id={tituloId} className="text-body font-medium text-foreground mt-1.5">
                {pesquisa.pergunta}
              </h2>
            </div>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar pesquisa (não será mostrada de novo)"
              className="alvo-toque -mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-sm text-muted hover:text-foreground hover:bg-surface-muted transition-colors duration-fast ease-standard"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          <div className="mt-4">
            <CampoDaResposta pesquisa={pesquisa} valor={valor} onChange={setValor} rotulo={pesquisa.pergunta} />
          </div>

          {pesquisa.permite_comentario && pesquisa.tipo !== "texto" && (
            <div className="mt-3">
              {comentarAberto ? (
                <label className="block">
                  <span className="text-caption text-muted">Comentário (opcional)</span>
                  <Textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    maxLength={LIMITE_DO_TEXTO}
                    rows={3}
                    className="mt-1 block"
                  />
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setComentarAberto(true)}
                  className="alvo-toque text-caption text-muted underline underline-offset-4 hover:text-foreground"
                >
                  Adicionar um comentário
                </button>
              )}
            </div>
          )}

          {erro && (
            <p role="alert" className="mt-3 text-caption text-danger-ink">
              {erro}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={fechar}>
              Agora não
            </Button>
            <Button type="submit" size="sm" disabled={estado === "enviando" || normalizada === null}>
              {estado === "enviando" ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function CampoDaResposta({
  pesquisa,
  valor,
  onChange,
  rotulo,
}: {
  pesquisa: PesquisaPendente;
  valor: Resposta | null;
  onChange: (v: Resposta | null) => void;
  rotulo: string;
}) {
  const opcaoBase =
    "alvo-toque rounded-sm border text-body-sm transition-colors duration-fast ease-standard";
  const marcada = "border-foreground bg-foreground text-background";
  const livre = "border-border text-foreground hover:bg-surface-muted";

  if (pesquisa.tipo === "nota") {
    return (
      <div>
        <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={valor === n}
              onClick={() => onChange(n)}
              className={cn(opcaoBase, "h-10 numero", valor === n ? marcada : livre)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1.5 flex justify-between text-micro text-muted" aria-hidden>
          <span>Pouco</span>
          <span>Muito</span>
        </p>
      </div>
    );
  }

  if (pesquisa.tipo === "sim_nao") {
    return (
      <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-2 gap-1.5">
        {[
          [true, "Sim"],
          [false, "Não"],
        ].map(([v, r]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={valor === v}
            onClick={() => onChange(v as boolean)}
            className={cn(opcaoBase, "h-10", valor === v ? marcada : livre)}
          >
            {r as string}
          </button>
        ))}
      </div>
    );
  }

  if (pesquisa.tipo === "escolha" || pesquisa.tipo === "multipla") {
    const multipla = pesquisa.tipo === "multipla";
    const lista = Array.isArray(valor) ? valor : [];
    return (
      <fieldset>
        <legend className="sr-only">{rotulo}</legend>
        {multipla && <p className="text-caption text-muted mb-1.5">Marque quantas quiser.</p>}
        <div className="space-y-1.5">
          {pesquisa.opcoes.map((o) => {
            const ativa = multipla ? lista.includes(o) : valor === o;
            return (
              <label
                key={o}
                className={cn(opcaoBase, "flex min-h-10 cursor-pointer items-center gap-2.5 px-3 py-2", ativa ? "border-foreground bg-surface-muted" : livre)}
              >
                <input
                  type={multipla ? "checkbox" : "radio"}
                  name="resposta"
                  checked={ativa}
                  onChange={() => {
                    if (!multipla) return onChange(o);
                    const nova = ativa ? lista.filter((x) => x !== o) : [...lista, o];
                    onChange(nova.length ? nova : null);
                  }}
                  className="accent-[var(--brand-blue)] size-4"
                />
                <span className="text-foreground">{o}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="block">
      <span className="sr-only">{rotulo}</span>
      <Textarea
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value || null)}
        maxLength={LIMITE_DO_TEXTO}
        rows={4}
        placeholder="Escreva com suas palavras"
        className="block"
      />
    </label>
  );
}
