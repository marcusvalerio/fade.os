"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

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
      { href: "/materiais", label: "Materiais" },
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
  {
    type: "menu",
    label: "Inteligência",
    items: [
      { href: "/kpis", label: "KPIs" },
      { href: "/relatorios", label: "Relatórios" },
      { href: "/inteligencia", label: "Central" },
    ],
  },
  { type: "link", href: "/configuracoes", label: "Configurações" },
];

const SCOPE_ALLOWED_HREFS: Record<NavScope, Set<string> | null> = {
  manager: null,
  reception: new Set(["/agenda", "/atendimento", "/pdv", "/caixa", "/clientes"]),
  barber: new Set(["/agenda", "/atendimento", "/clientes", "/inteligencia"]),
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const entries = visibleEntries(scope);
  const currentEntry = entries.find((entry) => entryIsActive(entry, pathname));
  const currentLabel =
    currentEntry?.type === "menu"
      ? currentEntry.items.find((item) => pathname.startsWith(item.href))?.label ?? currentEntry.label
      : currentEntry?.label ?? "Menu";

  useEffect(() => {
    setOpenMenu(null);
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

  return (
    <>
      {/*
        Desktop: as oito áreas cabem numa linha, com submenu ao clique.
        A partir de md — abaixo disso essa linha virava uma fileira espremida
        com rolagem horizontal, que é justamente o que não pode ser a solução.
      */}
      <nav className="shell hidden md:flex gap-1" aria-label="Navegação principal">
        {entries.map((entry) => {
          const active = entryIsActive(entry, pathname);

          if (entry.type === "link") {
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-nav px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors duration-fast ease-standard",
                  active
                    ? "border-signal text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {entry.label}
              </Link>
            );
          }

          const isOpen = openMenu === entry.label;

          return (
            <div key={entry.label} className="relative shrink-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setOpenMenu(isOpen ? null : entry.label)}
                className={cn(
                  "text-nav px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors duration-fast ease-standard inline-flex items-center gap-1.5",
                  active || isOpen
                    ? "border-signal text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                )}
              >
                {entry.label}
                <span
                  aria-hidden="true"
                  className={cn("text-[10px] transition-transform", isOpen && "rotate-180")}
                >
                  ▾
                </span>
              </button>

              {isOpen && (
                <div
                  role="menu"
                  aria-label={entry.label}
                  className="absolute left-0 top-full z-[var(--z-dropdown)] mt-1 min-w-44 rounded-md border border-border bg-surface p-1 shadow-md"
                >
                  {entry.items.map((item) => {
                    const itemActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        aria-current={itemActive ? "page" : undefined}
                        onClick={() => setOpenMenu(null)}
                        className={cn(
                          "block rounded-sm px-3 py-2 text-body-sm transition-colors",
                          itemActive
                            ? "bg-surface-elevated text-foreground"
                            : "text-muted hover:bg-surface-elevated hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

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
            <span className="font-logo font-[777] text-lg tracking-tight text-foreground">
              FADE OS
            </span>
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
