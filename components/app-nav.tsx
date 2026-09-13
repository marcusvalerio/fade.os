"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/ui/wordmark";
import { CortexMark } from "@/components/ui/cortex-mark";
import { GlassSurface } from "@/components/ui/glass-surface";
import {
  IconeInicio,
  IconeAgenda,
  IconeClientes,
  IconeNegocio,
  IconeCatalogo,
  IconeEquipe,
  IconeFinanceiro,
  IconeConfiguracoes,
} from "@/components/ui/nav-icons";

type IconeType = (props: { className?: string }) => React.ReactElement;
type NavItem = { href: string; label: string };
type NavEntry =
  | { type: "link"; href: string; label: string; icone: IconeType }
  | { type: "menu"; label: string; icone: IconeType; items: NavItem[] };
export type NavScope = "manager" | "reception" | "barber";

/**
 * R23.4: Financeiro sai de dentro do menu "Negócio" e vira item de primeiro
 * nível — é assim que a referência da sidebar lista os itens, um ao lado do
 * outro, não um dentro do outro. Nenhuma tela mudou: /financeiro é a mesma
 * rota, só o caminho até ela ficou mais curto.
 */
const ALL_ENTRIES: NavEntry[] = [
  { type: "link", href: "/dashboard", label: "Início", icone: IconeInicio },
  {
    type: "menu",
    label: "Agenda",
    icone: IconeAgenda,
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/atendimento", label: "Atendimento" },
    ],
  },
  { type: "link", href: "/clientes", label: "Clientes", icone: IconeClientes },
  {
    type: "menu",
    label: "Negócio",
    icone: IconeNegocio,
    items: [
      { href: "/pdv", label: "Nova venda" },
      { href: "/vendas", label: "Vendas" },
      { href: "/caixa", label: "Caixa" },
    ],
  },
  {
    type: "menu",
    label: "Catálogo",
    icone: IconeCatalogo,
    items: [
      { href: "/servicos", label: "Serviços" },
      { href: "/produtos", label: "Produtos" },
      { href: "/estoque", label: "Estoque" },
    ],
  },
  {
    type: "menu",
    label: "Equipe",
    icone: IconeEquipe,
    items: [
      { href: "/profissionais", label: "Profissionais" },
      { href: "/comissoes", label: "Comissões" },
    ],
  },
  { type: "link", href: "/financeiro", label: "Financeiro", icone: IconeFinanceiro },
  { type: "link", href: "/configuracoes", label: "Configurações", icone: IconeConfiguracoes },
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

/**
 * O shell do produto (R23.4) — sidebar fixa no desktop, drawer em tela
 * cheia no mobile. Antes disto era uma barra horizontal no topo; a
 * referência de identidade usa uma arquitetura estrutural diferente
 * (sidebar + header operacional + conteúdo editorial), não só uma paleta
 * nova sobre a mesma barra. `children` é a página em si — o shell inteiro
 * (sidebar, header, drawer) vive num componente só porque o botão do menu
 * mobile e o drawer que ele abre precisam do mesmo estado, e forçar isso
 * através da fronteira servidor/cliente do layout só complicaria sem
 * necessidade.
 */
export function AppNav({
  scope = "manager",
  identidade,
  header,
  children,
}: {
  scope?: NavScope;
  /** Avatar + nome + função + controle da unidade — mesmo conteúdo na
   *  sidebar (desktop) e no rodapé do drawer (mobile). */
  identidade?: React.ReactNode;
  /** Nome da empresa + identidade do usuário no topo da coluna de
   *  conteúdo — quem chama já decide o que fica visível em cada
   *  largura (a parte de usuário/sair se esconde no mobile porque já
   *  vive em `identidade`, dentro do drawer). */
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const entries = visibleEntries(scope);

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

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--background)" }}>
      {/*
        A sidebar — a moldura do produto, não conteúdo. Por isso ela é a
        única parte do CORTEX.OS que não troca com o tema, exatamente como a
        barra horizontal que ela substitui (--shell-* nunca é redefinido em
        .light).
      */}
      <aside
        className="hidden md:flex md:flex-col w-60 shrink-0 sticky top-0 h-screen"
        style={{ backgroundColor: "var(--shell-bg)", borderRight: "1px solid var(--shell-border)" }}
      >
        <div className="px-6 pt-6 pb-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2">
            <CortexMark size={22} toneA="var(--brand-yellow)" toneB="var(--shell-accent)" />
            <Wordmark tamanho="md" className="text-shell-foreground" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Navegação principal">
          {entries.map((entry) => (
            <SidebarEntryRow
              key={entry.type === "link" ? entry.href : entry.label}
              entry={entry}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Perfil + controle da unidade — sempre visíveis, nunca escondidos
            atrás de um menu a mais. */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--shell-border)" }}>
          {identidade}
        </div>
      </aside>

      {/* Painel mobile — mesma ideia da sidebar, em tela cheia. */}
      {mobileOpen && (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação principal"
          // 100dvh e não 100vh: no iOS a barra do Safari entra e sai, e com vh
          // o rodapé do painel fica embaixo dela.
          className="md:hidden fixed inset-0 z-[var(--z-modal)] flex h-[100dvh] flex-col bg-shell-bg animate-fade-in"
        >
          <div
            className="shell w-full flex items-center justify-between border-b py-4 text-shell-foreground"
            style={{ borderColor: "var(--shell-border)" }}
          >
            <span className="inline-flex items-center gap-2">
              <CortexMark size={20} toneA="var(--brand-yellow)" toneB="var(--shell-accent)" />
              <Wordmark tamanho="md" />
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="text-nav text-shell-muted hover:text-shell-foreground min-h-11 px-3 -mr-3"
            >
              Fechar
            </button>
          </div>

          <div
            className="shell w-full flex-1 overflow-y-auto overscroll-contain py-4"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
          >
            {entries.map((entry) => {
              const Icone = entry.icone;
              if (entry.type === "link") {
                const active = pathname.startsWith(entry.href);
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 border-b text-body transition-colors",
                      active ? "text-shell-foreground" : "text-shell-muted"
                    )}
                    style={{ borderColor: "var(--shell-border)" }}
                  >
                    <Icone className="size-5 shrink-0" />
                    {entry.label}
                  </Link>
                );
              }

              return (
                <div key={entry.label} className="border-b py-3" style={{ borderColor: "var(--shell-border)" }}>
                  <p className="flex items-center gap-2 text-label uppercase text-shell-muted mb-1">
                    <Icone className="size-4 shrink-0" />
                    {entry.label}
                  </p>
                  {entry.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center pl-7 text-body transition-colors",
                          active ? "text-shell-foreground" : "text-shell-muted"
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div
            className="shell w-full border-t py-4"
            style={{ borderColor: "var(--shell-border)", paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {identidade}
          </div>
        </div>
      )}

      {/* Coluna de conteúdo — header operacional + a página em si. */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/*
          R23.5: era uma faixa de py-4 com blocos de duas linhas em escala de
          texto normal — media perto de 76px de altura, quase uma segunda
          área hero antes do conteúdo. Aqui é uma faixa de CONTEXTO: py-2.5,
          textos compactos, ícones/avatares um degrau menores. O objetivo não
          é "menor por menor" — é que o conteúdo comece muito mais cedo sem
          a empresa ou o operador deixarem de ser identificáveis.

          Sticky + Glass (de volta, R23.5): sidebar e header precisam "parecer
          parte do mesmo sistema", não sidebar + topbar genérica — por isso o
          header volta a usar os tokens do shell (nunca troca com o tema da
          página, como a sidebar) e o material glass real: agora que ele é
          sticky, o conteúdo rolando por baixo é exatamente o "algo atrás
          dele" que dá ao blur uma razão de existir.
        */}
        {/*
          `sticky` mora no wrapper, não na GlassSurface: `.glass-surface-shell`
          já fixa `position: relative` (precisa disso para o próprio ::before
          de highlight) — colocar `sticky` na mesma classe perdia o empate de
          especificidade contra essa regra e o header nunca ficava fixo.
        */}
        <div className="sticky top-0 z-[var(--z-header)]">
          <GlassSurface as="header" tone="shell">
            <div className="shell flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-panel"
                aria-label="Abrir navegação"
                className="md:hidden text-shell-foreground inline-flex items-center justify-center min-h-11 min-w-11 -ml-2 shrink-0"
              >
                <span aria-hidden="true" className="flex flex-col gap-[3px]">
                  <span className="block h-px w-4 bg-current" />
                  <span className="block h-px w-4 bg-current" />
                  <span className="block h-px w-4 bg-current" />
                </span>
              </button>
              <div className="flex-1 min-w-0 flex items-center justify-between gap-4">{header}</div>
            </div>
          </GlassSurface>
        </div>

        <main className="shell py-8 flex-1 w-full">{children}</main>
      </div>
    </div>
  );
}

function SidebarEntryRow({ entry, pathname }: { entry: NavEntry; pathname: string }) {
  const Icone = entry.icone;
  const active = entryIsActive(entry, pathname);
  const href = entry.type === "link" ? entry.href : entry.items[0].href;

  return (
    <div>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-md px-3 py-2.5 text-nav transition-colors duration-fast ease-standard",
          // Amarelo no item ativo (R23.4): decisão explícita da direção para
          // a sidebar, diferente do azul que marca "ativo" no resto do
          // shell — aqui o pedido foi Sunny Yellow "de forma muito clara".
          active
            ? "bg-signal text-signal-foreground font-medium"
            : "text-shell-muted hover:text-shell-foreground hover:bg-white/5"
        )}
      >
        <Icone className="size-[1.1rem] shrink-0" />
        <span className="truncate">{entry.label}</span>
      </Link>

      {/* Os irmãos da área atual, indentados — a mesma sub-navegação de
          antes, só que dentro da coluna em vez de numa segunda barra. */}
      {entry.type === "menu" && active && entry.items.length > 1 && (
        <div className="mt-0.5 mb-1 ml-[2.05rem] space-y-0.5">
          {entry.items.map((item) => {
            const itemAtivo = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={itemAtivo ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2.5 py-1.5 text-body-sm transition-colors duration-fast ease-standard",
                  itemAtivo ? "text-shell-foreground font-medium" : "text-shell-muted hover:text-shell-foreground"
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
}
