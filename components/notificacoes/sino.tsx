"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconeSino, IconeConfiguracoes } from "@/components/ui/nav-icons";
import { ListaDeNotificacoes } from "@/components/notificacoes/lista";
import { ConvitePush } from "@/components/notificacoes/convite-push";
import { useNaoLidas } from "@/components/notificacoes/contador";
import { rotuloDoSino, textoDoBadge, type Area } from "@/lib/notificacoes/catalogo";
import { cn } from "@/lib/cn";

/**
 * O sino. Três lugares, uma peça:
 *   - "sidebar": item do rodapé da sidebar (tinta), painel ao lado;
 *   - "barra":   faixa do celular (tinta);
 *   - "claro":   cabeçalho da área do cliente.
 * No celular o painel é uma folha que sobe de baixo (sem dropdown enorme);
 * do sm para cima, um painel ancorado no sino. O painel vai para o <body>
 * (portal): a sidebar é sticky e prenderia o painel atrás do conteúdo.
 * Fecha com Esc, clique fora, troca de página ou ao abrir uma notificação;
 * o foco volta para o sino.
 */
export function SinoDeNotificacoes({
  area,
  empresaId,
  variante,
  recolhida = false,
  linkTudo,
  linkPreferencias,
  temaDoPainel,
}: {
  area: Area;
  empresaId: string | null;
  variante: "sidebar" | "barra" | "claro";
  recolhida?: boolean;
  linkTudo?: string;
  linkPreferencias: string;
  /** classe de tema para o painel (vai para o <body> e perde o tema do shell — ex.: "admin-console") */
  temaDoPainel?: string;
}) {
  const naoLidas = useNaoLidas(area, empresaId);
  const [aberto, setAberto] = useState(false);
  const [celular, setCelular] = useState(false);
  const pathname = usePathname();
  const caixaRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<React.CSSProperties>({});
  const botaoRef = useRef<HTMLButtonElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const tituloId = useId();
  const painelId = useId();
  const badge = textoDoBadge(naoLidas);

  useEffect(() => setAberto(false), [pathname]);

  useEffect(() => {
    if (!aberto) return;
    tituloRef.current?.focus();
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (caixaRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    };
    // No celular a folha cobre a tela: a página por trás não rola.
    const ehCelular = window.matchMedia("(max-width: 639px)").matches;
    setCelular(ehCelular);
    const overflow = document.body.style.overflow;
    if (ehCelular) document.body.style.overflow = "hidden";
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  // Posição do painel a partir do sino (recalculada ao redimensionar).
  useLayoutEffect(() => {
    if (!aberto) return;
    const posicionar = () => {
      const r = botaoRef.current?.getBoundingClientRect();
      const W = window.innerWidth;
      const H = window.innerHeight;
      if (!r || W < 640) return setPosicao({});
      const largura = Math.min(384, W - 32);
      if (variante === "sidebar") {
        const left = Math.min(r.right + 8, W - largura - 16);
        setPosicao({ left, bottom: Math.max(16, H - r.bottom), width: largura, maxHeight: Math.min(576, H - 32) });
      } else {
        const top = r.bottom + 8;
        setPosicao({ top, right: Math.max(16, W - r.right), width: largura, maxHeight: Math.min(576, H - top - 16) });
      }
    };
    posicionar();
    window.addEventListener("resize", posicionar);
    return () => window.removeEventListener("resize", posicionar);
  }, [aberto, variante]);

  const tinta = variante !== "claro";

  return (
    <div ref={caixaRef} className={cn("relative", variante === "sidebar" && "w-full")}>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => {
          setCelular(window.matchMedia("(max-width: 639px)").matches);
          setAberto((v) => !v);
        }}
        aria-expanded={aberto}
        aria-controls={aberto ? painelId : undefined}
        aria-label={rotuloDoSino(naoLidas)}
        title={variante === "sidebar" && recolhida ? rotuloDoSino(naoLidas) : undefined}
        className={cn(
          "relative flex items-center transition-colors duration-micro ease-standard",
          variante === "sidebar" &&
            cn(
              "w-full gap-3 rounded-sm py-[0.4375rem] text-nav",
              recolhida ? "justify-center px-0" : "px-3",
              aberto ? "text-on-ink bg-white/[0.06]" : "text-on-ink-muted hover:text-on-ink hover:bg-white/[0.035]"
            ),
          variante === "barra" && "size-11 justify-center text-on-ink-soft hover:text-on-ink",
          variante === "claro" && "alvo-toque size-10 justify-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
        )}
      >
        <span className="relative">
          <IconeSino className={variante === "sidebar" ? "size-4.5 shrink-0" : "size-5"} />
          {badge && (variante !== "sidebar" || recolhida) && (
            <span
              aria-hidden
              className={cn(
                "absolute -right-2 -top-1.5 min-w-4 rounded-xs px-1 text-center font-heading text-[0.625rem] font-semibold leading-4 numero",
                "bg-brand-blue text-neutral-ink",
                tinta ? "ring-2 ring-shell-bg" : "ring-2 ring-background"
              )}
            >
              {badge}
            </span>
          )}
        </span>
        {variante === "sidebar" && !recolhida && (
          <>
            <span className="truncate">Notificações</span>
            {badge && (
              <span aria-hidden className="ml-auto min-w-5 rounded-xs bg-brand-blue px-1.5 text-center text-micro font-semibold leading-5 text-neutral-ink numero">
                {badge}
              </span>
            )}
          </>
        )}
      </button>

      {aberto && typeof document !== "undefined" && createPortal(
        <div className={cn("contents", temaDoPainel)}>
          {/* Fundo só no celular (a folha é modal lá). */}
          {celular && <div aria-hidden className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-[rgb(var(--shadow-color)/40%)]" onClick={() => setAberto(false)} />}
          <div
            ref={painelRef}
            id={painelId}
            role="dialog"
            aria-labelledby={tituloId}
            aria-modal={celular ? true : undefined}
            className={cn(
              "fixed z-[var(--z-modal)] flex flex-col bg-surface text-foreground shadow-md border border-border motion-reduce:animate-none",
              celular
                ? "inset-x-0 bottom-0 h-[85dvh] rounded-t-md animate-rise-in"
                : cn("rounded-md animate-scale-in", variante === "sidebar" ? "origin-bottom-left" : "origin-top-right")
            )}
            style={celular ? { paddingBottom: "env(safe-area-inset-bottom)" } : posicao}
          >
            {celular && <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" />}
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
              <h2 ref={tituloRef} id={tituloId} tabIndex={-1} className="font-heading text-section-title text-foreground outline-none">
                Notificações
              </h2>
              <div className="flex items-center gap-1">
                <Link
                  href={linkPreferencias}
                  onClick={() => setAberto(false)}
                  aria-label="Preferências de notificação"
                  title="Preferências"
                  className="alvo-toque grid size-9 place-items-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <IconeConfiguracoes className="size-4.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    botaoRef.current?.focus();
                  }}
                  aria-label="Fechar notificações"
                  className="alvo-toque grid size-9 place-items-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
            <ConvitePush publico={area} className="mx-4 mb-3" />
            <ListaDeNotificacoes area={area} empresaId={empresaId} compacta aoAbrir={() => setAberto(false)} />
            {linkTudo && (
              <div className="border-t border-border px-4 py-2.5">
                <Link href={linkTudo} onClick={() => setAberto(false)} className="alvo-toque text-body-sm text-muted hover:text-foreground">
                  Ver todas as notificações
                </Link>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
