"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { marcarApresentacaoVista } from "@/actions/apresentacao";
import { cn } from "@/lib/cn";
import type { NavScope } from "@/components/app-nav";

/** Evento que abre a apresentação de novo (menu da conta e Ajuda). */
export const EVENTO_APRESENTACAO = "cortex:apresentacao";

type Passo = {
  /** Destino na sidebar a destacar; sem alvo visível, o cartão fica no centro. */
  alvo?: string;
  eyebrow: string;
  titulo: string;
  texto: string;
  /** Quem vê este passo (o que a pessoa não tem no menu não é apresentado). */
  para?: NavScope[];
};

const PASSOS: Passo[] = [
  {
    eyebrow: "Bem-vindo ao CORTEX",
    titulo: "O sistema operacional da sua barbearia.",
    texto:
      "O que acontece no balcão vira agenda, atendimento, caixa, comissão, estoque e histórico do cliente — num registro só. Em um minuto, onde fica cada coisa.",
  },
  {
    alvo: "/agenda",
    eyebrow: "Agenda",
    titulo: "O dia, horário por horário.",
    texto:
      "Só aparecem horários que dá para reservar de verdade — os mesmos da página pública. Veja por dia ou semana, a equipe inteira ou só a sua agenda.",
  },
  {
    alvo: "/atendimento",
    eyebrow: "Atendimento",
    titulo: "O centro da operação.",
    texto:
      "Começa pela agenda ou sem hora marcada. Ao fechar, o CORTEX grava venda, pagamento, caixa, comissão e estoque de uma vez — e sugere a próxima visita.",
  },
  {
    alvo: "/clientes",
    eyebrow: "Clientes",
    titulo: "Quem volta, quem sumiu.",
    texto:
      "Cada cliente tem o próprio ritmo de volta. Quem passou do prazo aparece para você chamar — o CORTEX prepara a mensagem, você decide enviar.",
  },
  {
    alvo: "/caixa",
    eyebrow: "Caixa",
    titulo: "O caixa que confere.",
    texto:
      "Abra o turno com o troco. Vendas em dinheiro entram sozinhas; ao fechar, você conta e o CORTEX mostra a diferença.",
    para: ["manager", "reception"],
  },
  {
    alvo: "/pdv",
    eyebrow: "Nova venda",
    titulo: "Balcão rápido.",
    texto: "Produto vendido fora de um atendimento: busque, some, receba. O estoque baixa na hora.",
    para: ["manager", "reception"],
  },
  {
    alvo: "/dashboard",
    eyebrow: "Início",
    titulo: "O negócio em poucos segundos.",
    texto:
      "O Pulso diz o que pede ação agora. Abaixo, faturamento, agenda, clientes, equipe e estoque — sempre com o próximo passo ao lado.",
    para: ["manager"],
  },
  {
    eyebrow: "Pronto",
    titulo: "A barbearia é sua.",
    texto: "Para rever esta apresentação, abra o menu da sua conta (no rodapé da navegação) ou a Ajuda.",
  },
];

type Retangulo = { top: number; left: number; width: number; height: number };

function alvoVisivel(href: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="navegacao"] a[href="${href}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * Apresentação de primeiro acesso: curta (até oito passos), sobre a própria
 * tela, destacando o item real da navegação. Abre sozinha uma vez — quando
 * termina ou é pulada, fica marcada nos metadados da pessoa — e volta
 * sempre que ela pedir ("Rever apresentação").
 *
 * Esc pula, ← → navegam. Com movimento reduzido, nada desliza: o destaque
 * só muda de lugar.
 */
export function Apresentacao({ abrirAoEntrar, scope }: { abrirAoEntrar: boolean; scope: NavScope }) {
  const passos = PASSOS.filter((p) => !p.para || p.para.includes(scope));
  const [aberta, setAberta] = useState(false);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Retangulo | null>(null);
  const marcada = useRef(false);
  const cartao = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Abre sozinha no primeiro acesso — só depois da sequência da marca.
  useEffect(() => {
    if (!abrirAoEntrar) return;
    const t = window.setTimeout(() => setAberta(true), 1100);
    return () => window.clearTimeout(t);
  }, [abrirAoEntrar]);

  useEffect(() => {
    const abrir = () => {
      setIndice(0);
      setAberta(true);
    };
    window.addEventListener(EVENTO_APRESENTACAO, abrir);
    return () => window.removeEventListener(EVENTO_APRESENTACAO, abrir);
  }, []);

  const fechar = useCallback(() => {
    setAberta(false);
    if (!marcada.current) {
      marcada.current = true;
      void marcarApresentacaoVista();
    }
  }, []);

  const passo = passos[Math.min(indice, passos.length - 1)];

  const medir = useCallback(() => {
    if (!passo?.alvo) return setRect(null);
    const el = alvoVisivel(passo.alvo);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 });
  }, [passo]);

  useLayoutEffect(() => {
    if (!aberta) return;
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberta, medir, pathname]);

  useEffect(() => {
    if (!aberta) return;
    cartao.current?.querySelector<HTMLButtonElement>("[data-principal]")?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, passos.length - 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberta, indice, fechar, passos.length]);

  if (!aberta || !passo) return null;

  const ultimo = indice === passos.length - 1;
  // Cartão ao lado do item destacado (a sidebar fica à esquerda); sem
  // alvo, no centro da tela.
  const posicao: React.CSSProperties = rect
    ? { top: Math.max(16, Math.min(rect.top - 8, window.innerHeight - 280)), left: rect.left + rect.width + 20 }
    : {};

  return (
    <div className="fixed inset-0 z-[var(--z-modal)]" role="presentation">
      {/* A sombra do recorte não recebe clique: esta camada segura a tela
          por baixo enquanto a apresentação está aberta. */}
      <div aria-hidden className="absolute inset-0" />
      {/* Véu: com alvo, é a sombra do próprio recorte; sem alvo, um fundo. */}
      {rect ? (
        <div
          aria-hidden
          className="absolute rounded-sm outline-2 outline-solid outline-brand-blue transition-all duration-transicao ease-sinal motion-reduce:transition-none"
          style={{ ...rect, boxShadow: "0 0 0 200vmax rgb(4 23 35 / 0.62)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-neutral-ink/60 animate-fade-in" />
      )}
      <div
        ref={cartao}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apresentacao-titulo"
        aria-describedby="apresentacao-texto"
        key={indice}
        className={cn(
          "absolute w-[min(22rem,calc(100vw-2rem))] rounded-md bg-neutral-warm-white text-neutral-ink p-6 shadow-md animate-rise-in",
          !rect && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={posicao}
      >
        <p className="flex items-center gap-2 font-subtitle text-caption text-neutral-ink/65">
          <span aria-hidden className="size-1.5 bg-brand-blue" />
          {passo.eyebrow}
        </p>
        <h2 id="apresentacao-titulo" className="mt-3 font-heading text-[1.5rem] leading-[1.05] tracking-[-0.03em] font-semibold">
          {passo.titulo}
        </h2>
        <p id="apresentacao-texto" className="mt-3 text-body-sm text-neutral-ink/72">
          {passo.texto}
        </p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1" aria-label={`Passo ${indice + 1} de ${passos.length}`} role="img">
            {passos.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "h-1 transition-all duration-interacao ease-standard",
                  i === indice ? "w-4 bg-brand-blue" : "w-1.5 bg-neutral-ink/20"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!ultimo && (
              <button type="button" onClick={fechar} className="min-h-10 px-3 text-body-sm text-neutral-ink/65 hover:text-neutral-ink">
                Pular
              </button>
            )}
            {indice > 0 && (
              <button
                type="button"
                onClick={() => setIndice((i) => i - 1)}
                className="min-h-10 px-3 rounded-sm text-body-sm text-neutral-ink border border-neutral-ink/20 hover:border-neutral-ink/45"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              data-principal
              onClick={() => (ultimo ? fechar() : setIndice((i) => i + 1))}
              className="min-h-10 px-4 rounded-sm bg-neutral-ink text-neutral-warm-white text-button font-semibold hover:bg-neutral-onyx"
            >
              {ultimo ? "Começar" : indice === 0 ? "Mostrar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botão que reabre a apresentação — usado no menu da conta e na Ajuda. */
export function BotaoReverApresentacao({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(EVENTO_APRESENTACAO))}>
      {children ?? "Rever apresentação"}
    </button>
  );
}
