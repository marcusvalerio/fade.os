"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/ui/wordmark";

type NavItem = { href: string; label: string };
type NavEntry =
  | { type: "link"; href: string; label: string }
  | { type: "menu"; label: string; items: NavItem[] };
export type NavScope = "manager" | "reception" | "barber";

const ALL_ENTRIES: NavEntry[] = [
  { type: "link", href: "/dashboard", label: "Início" },
  {
    type: "menu",
    label: "Agenda",
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/atendimento", label: "Atendimento" },
    ],
  },
  { type: "link", href: "/clientes", label: "Clientes" },
  {
    type: "menu",
    label: "Negócio",
    items: [
      { href: "/pdv", label: "Nova venda" },
      { href: "/vendas", label: "Vendas" },
      { href: "/caixa", label: "Caixa" },
      { href: "/financeiro", label: "Financeiro" },
    ],
  },
  {
    type: "menu",
    label: "Catálogo",
    items: [
      { href: "/servicos", label: "Serviços" },
      { href: "/produtos", label: "Produtos" },
      { href: "/estoque", label: "Estoque" },
    ],
  },
  {
    type: "menu",
    label: "Equipe",
    items: [
      { href: "/profissionais", label: "Profissionais" },
      { href: "/comissoes", label: "Comissões" },
    ],
  },
  { type: "link", href: "/configuracoes", label: "Configurações" },
];

/**
 * Fora da navegação principal — não apagadas.
 *
 * O MVP operacional é o ciclo cliente → agenda → atendimento → venda →
 * pagamento → caixa → comissão → estoque → histórico. Estas rotas continuam
 * existindo, continuam protegidas pelo middleware e continuam respondendo por
 * URL direta; só deixam de ocupar espaço no menu enquanto o núcleo não estiver
 * consolidado.
 *
 * Ficam listadas aqui, e não apenas removidas, para que a decisão seja
 * legível: quem reintroduzir uma delas devolve a entrada ao menu e apaga a
 * linha correspondente.
 *
 *   /kpis         indicadores com comparação de período — o Início já mostra
 *                 os operacionais
 *   /relatorios   relatório consolidado e impressão
 *   /inteligencia central de insights: inferência sobre retorno de cliente,
 *                 estouro de duração e tendência — depende de volume de dados
 *                 que a operação ainda não tem
 *   /materiais    cadastro de material de consumo: hoje nada no ciclo consome
 *                 material (nenhum movimento de estoque de material existe), e
 *                 o saldo deles segue visível e ajustável em /estoque
 */
export const ROTAS_FORA_DO_MENU = ["/kpis", "/relatorios", "/inteligencia", "/materiais"] as const;

const SCOPE_ALLOWED_HREFS: Record<NavScope, Set<string> | null> = {
  manager: null,
  reception: new Set(["/agenda", "/atendimento", "/pdv", "/caixa", "/clientes"]),
  // O barbeiro tinha /inteligencia como único item fora da operação; com a
  // central pausada, o que sobra é exatamente o trabalho dele.
  barber: new Set(["/agenda", "/atendimento", "/clientes"]),
};

function entryIsActive(entry: NavEntry, pathname: string) {
  if (entry.type === "link") return pathname.startsWith(entry.href);
  return entry.items.some((item) => pathname.startsWith(item.href));
}

function visibleEntries(scope: NavScope): NavEntry[] {
  const allowed = SCOPE_ALLOWED_HREFS[scope];

  return ALL_ENTRIES.map((entry) => {
    if (entry.type === "link") {
      return allowed && !allowed.has(entry.href) ? null : entry;
    }

    const items = allowed ? entry.items.filter((item) => allowed.has(item.href)) : entry.items;
    return items.length > 0 ? { ...entry, items } : null;
  }).filter((entry): entry is NavEntry => entry !== null);
}

export function AppNav({ scope = "manager" }: { scope?: NavScope }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const entries = visibleEntries(scope);
  const currentEntry = entries.find((entry) => entryIsActive(entry, pathname));
  const currentLabel =
    currentEntry?.type === "menu"
      ? currentEntry.items.find((item) => pathname.startsWith(item.href))?.label ?? currentEntry.label
      : currentEntry?.label ?? "Menu";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Enquanto o painel está aberto ele é a tela inteira: a página atrás não
  // pode rolar junto no toque.
  useEffect(() => {
    if (!mobileOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  // Os irmãos da área atual — é o que a sub-barra mostra.
  const subitens = currentEntry?.type === "menu" ? currentEntry.items : [];

  return (
    <>
      {/*
        A navegação tinha dropdown: clicar na área abria um menu, e só o
        segundo clique navegava. Numa barbearia se alterna entre Agenda e
        Atendimento o dia inteiro — dois cliques para a tela mais usada é
        caro, e o menu flutuante é justamente o que fazia o produto parecer
        painel administrativo.

        Agora a área navega no primeiro clique, direto para a sua tela
        principal, e os irmãos dela aparecem numa segunda linha só quando
        você está dentro daquela área. A navegação deixa de ser um índice de
        módulos e passa a mostrar onde você está.
      */}
      <nav className="shell hidden md:flex gap-6 border-b border-border" aria-label="Navegação principal">
        {entries.map((entry) => {
          const active = entryIsActive(entry, pathname);
          const href = entry.type === "link" ? entry.href : entry.items[0].href;

          return (
            <Link
              key={entry.type === "link" ? entry.href : entry.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative text-nav py-3 whitespace-nowrap transition-colors",
                "duration-[var(--duration-micro)] ease-standard",
                active ? "text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {entry.label}
              {/*
                O filete da área ativa. Fica no fluxo, escalando em X a partir
                da esquerda — some e aparece sem empurrar nada, e sem o pulo
                de 2px que uma borda condicional causa.
              */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 -bottom-px h-0.5 bg-signal origin-left",
                  "transition-transform duration-[var(--duration-interacao)] ease-emphasized",
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-hover:bg-border-strong"
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* Sub-barra contextual: só existe quando a área tem mais de uma tela. */}
      {subitens.length > 1 && (
        <div className="shell hidden md:flex gap-5 py-2.5" aria-label={`Seções de ${currentEntry?.label}`}>
          {subitens.map((item) => {
            const itemAtivo = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={itemAtivo ? "page" : undefined}
                className={cn(
                  "text-body-sm transition-colors duration-[var(--duration-micro)] ease-standard",
                  itemAtivo
                    ? "text-foreground font-medium"
                    : "text-muted hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/*
        Mobile: a barra mostra onde a pessoa está e um único alvo para abrir a
        navegação. Nada de rolagem lateral e nada de submenu dentro de submenu
        — o painel abre com as áreas já expandidas.
      */}
      <div className="shell md:hidden flex items-center justify-between gap-3 py-2">
        <span className="text-nav text-foreground truncate">{currentLabel}</span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
          className="text-nav text-muted hover:text-foreground inline-flex items-center gap-2 min-h-11 px-2 -mr-2"
        >
          Menu
          <span aria-hidden="true" className="flex flex-col gap-[3px]">
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
            <span className="block h-px w-4 bg-current" />
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação principal"
          // 100dvh e não 100vh: no iOS a barra do Safari entra e sai, e com vh
          // o rodapé do painel fica embaixo dela. pb com safe-area para o
          // último item não morrer atrás do indicador de home.
          className="md:hidden fixed inset-0 z-[var(--z-modal)] flex h-[100dvh] flex-col bg-background animate-fade-in"
        >
          <div className="shell w-full flex items-center justify-between border-b border-border py-4">
            <Wordmark tamanho="md" />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="text-nav text-muted hover:text-foreground min-h-11 px-3 -mr-3"
            >
              Fechar
            </button>
          </div>

          <div
            className="shell w-full flex-1 overflow-y-auto overscroll-contain py-4"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
          >
            {entries.map((entry) => {
              if (entry.type === "link") {
                const active = pathname.startsWith(entry.href);
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center border-b border-border text-body transition-colors",
                      active ? "text-foreground" : "text-muted"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("mr-3 h-4 w-0.5", active ? "bg-signal" : "bg-transparent")}
                    />
                    {entry.label}
                  </Link>
                );
              }

              return (
                <div key={entry.label} className="border-b border-border py-3">
                  <p className="text-label uppercase text-muted mb-1">{entry.label}</p>
                  {entry.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center text-body transition-colors",
                          active ? "text-foreground" : "text-muted"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn("mr-3 h-4 w-0.5", active ? "bg-signal" : "bg-transparent")}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
