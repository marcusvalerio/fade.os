"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/ui/wordmark";
import { CortexMark } from "@/components/ui/cortex-mark";
import { SinoDeNotificacoes } from "@/components/notificacoes/sino";
import {
  IconeInicio,
  IconeAgenda,
  IconeAtendimento,
  IconeClientes,
  IconeVenda,
  IconeRecibo,
  IconeCaixa,
  IconeFinanceiro,
  IconeServicos,
  IconeProdutos,
  IconeEstoque,
  IconeEquipe,
  IconeComissoes,
  IconeConfiguracoes,
  IconeAjuda,
  IconeExpandir,
} from "@/components/ui/nav-icons";

type IconeType = (props: { className?: string }) => React.ReactElement;
type Destino = { href: string; label: string; icone: IconeType };
type Grupo = { rotulo: string; itens: Destino[] };
export type NavScope = "manager" | "reception" | "barber";

/**
 * A navegação do produto, em grupos que dizem PARA QUE serve cada tela —
 * não um acordeão que esconde o destino atrás de um clique. Cada tela é um
 * item visível; o grupo é só um rótulo em Supreme. É assim que a sidebar
 * some visualmente: nenhum item tem caixa, borda ou pílula; o que está
 * ativo ganha o quadrado da marca e a tinta clara, e mais nada.
 */
const GRUPOS: Grupo[] = [
  {
    rotulo: "Dia a dia",
    itens: [
      { href: "/dashboard", label: "Início", icone: IconeInicio },
      { href: "/agenda", label: "Agenda", icone: IconeAgenda },
      { href: "/atendimento", label: "Atendimento", icone: IconeAtendimento },
      { href: "/pdv", label: "Nova venda", icone: IconeVenda },
    ],
  },
  {
    rotulo: "Dinheiro",
    itens: [
      { href: "/caixa", label: "Caixa", icone: IconeCaixa },
      { href: "/vendas", label: "Vendas", icone: IconeRecibo },
      { href: "/financeiro", label: "Financeiro", icone: IconeFinanceiro },
      { href: "/comissoes", label: "Comissões", icone: IconeComissoes },
    ],
  },
  {
    rotulo: "Cadastros",
    itens: [
      { href: "/clientes", label: "Clientes", icone: IconeClientes },
      { href: "/servicos", label: "Serviços", icone: IconeServicos },
      { href: "/produtos", label: "Produtos", icone: IconeProdutos },
      { href: "/estoque", label: "Estoque", icone: IconeEstoque },
      { href: "/profissionais", label: "Equipe", icone: IconeEquipe },
    ],
  },
];

const RODAPE: Destino[] = [
  { href: "/configuracoes", label: "Configurações", icone: IconeConfiguracoes },
  { href: "/ajuda", label: "Ajuda", icone: IconeAjuda },
];

/**
 * Fora da navegação principal — não apagadas. Continuam protegidas pelo
 * middleware e respondem por URL direta; só não ocupam o menu enquanto o
 * núcleo operacional é o que importa.
 *
 *   /kpis         indicadores com comparação de período — o Início já mostra
 *   /relatorios   relatório consolidado e impressão
 *   /inteligencia central de insights — depende de volume que a operação
 *                 ainda não tem; o Pulso e o CRM do Início cobrem o agora
 *   /materiais    cadastro de material de consumo; saldo segue em /estoque
 */
export const ROTAS_FORA_DO_MENU = ["/kpis", "/relatorios", "/inteligencia", "/materiais"] as const;

/** Autorização real vem do RLS e de cada página; aqui é só o que aparece. */
const SCOPE_ALLOWED_HREFS: Record<NavScope, Set<string> | null> = {
  manager: null,
  reception: new Set(["/agenda", "/atendimento", "/pdv", "/caixa", "/clientes", "/ajuda"]),
  // O barbeiro vê a própria comissão (a página filtra pelo profissional dele).
  barber: new Set(["/agenda", "/atendimento", "/clientes", "/comissoes", "/ajuda"]),
};

function permitido(scope: NavScope, href: string) {
  const allowed = SCOPE_ALLOWED_HREFS[scope];
  return !allowed || allowed.has(href);
}

function estaAtivo(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIDEBAR_COLLAPSED_KEY = "cortex_sidebar_collapsed";

export type Contexto = {
  empresa: string;
  unidade: string | null;
  logoUrl: string | null;
};

export type Usuario = { nome: string; papel: string; iniciais: string };

/**
 * O shell do produto. Desktop: sidebar em tinta (a mesma superfície dos
 * capítulos escuros da landing) e NADA acima do conteúdo — a página começa
 * no próprio título. Mobile: uma faixa fina com o menu e a barbearia; o
 * menu abre em tela cheia.
 *
 * `menuConta` chega pronto do layout (formulários com Server Actions: sair,
 * trocar modo, trocar empresa) e é mostrado dentro do menu da conta.
 */
export function AppNav({
  scope = "manager",
  contexto,
  usuario,
  menuConta,
  entrada = false,
  empresaId,
  children,
}: {
  scope?: NavScope;
  /** Empresa atual — recorta a central de notificações. */
  empresaId: string;
  contexto: Contexto;
  usuario: Usuario;
  menuConta?: React.ReactNode;
  /** Acabou de entrar: o conteúdo sobe por baixo da sequência da marca. */
  entrada?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // Armazenamento bloqueado: segue expandida.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Só não lembra entre sessões.
      }
      return next;
    });
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => permitido(scope, i.href)) })).filter(
    (g) => g.itens.length > 0
  );
  const rodape = RODAPE.filter((i) => permitido(scope, i.href));

  return (
    <div className="min-h-screen md:flex bg-background">
      <aside
        data-tour="navegacao"
        className={cn(
          "hidden md:flex md:flex-col shrink-0 sticky top-0 h-screen bg-shell-bg text-shell-foreground",
          "transition-[width] duration-interacao ease-standard",
          collapsed ? "w-17" : "w-62"
        )}
      >
        <div className={cn("flex items-center h-15 shrink-0", collapsed ? "justify-center" : "px-5")}>
          <Link href="/dashboard" className="inline-flex items-center text-shell-foreground" aria-label="Início — CORTEX.OS">
            {collapsed ? <CortexMark size={12} /> : <Wordmark tamanho="md" />}
          </Link>
        </div>

        {!collapsed && <ContextoDaEmpresa contexto={contexto} />}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4" aria-label="Navegação principal">
          {grupos.map((grupo, g) => (
            <div key={grupo.rotulo} className={cn(g > 0 && "mt-4")}>
              {collapsed ? (
                g > 0 && <div aria-hidden className="mx-3 mb-3 h-px bg-shell-border" />
              ) : (
                <p className="px-3 pt-3 mb-1.5 border-t border-shell-border font-subtitle text-micro font-bold uppercase tracking-label text-shell-foreground">
                  {grupo.rotulo}
                </p>
              )}
              <ul className="space-y-px">
                {grupo.itens.map((item) => (
                  <li key={item.href}>
                    <ItemDaSidebar item={item} ativo={estaAtivo(item.href, pathname)} recolhida={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 px-3 pt-2.5 pb-3 space-y-px border-t border-shell-border">
          {rodape.map((item) => (
            <ItemDaSidebar key={item.href} item={item} ativo={estaAtivo(item.href, pathname)} recolhida={collapsed} />
          ))}
          <SinoDeNotificacoes
            area="equipe"
            empresaId={empresaId}
            variante="sidebar"
            recolhida={collapsed}
            linkTudo="/notificacoes"
            linkPreferencias="/configuracoes/notificacoes"
          />
          <MenuDaConta usuario={usuario} recolhida={collapsed}>
            {menuConta}
          </MenuDaConta>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "w-full flex items-center gap-3 rounded-sm py-1.5 text-caption text-shell-muted",
              "hover:text-shell-foreground transition-colors duration-micro ease-standard",
              collapsed ? "justify-center" : "px-3"
            )}
          >
            <IconeExpandir className={cn("size-4 shrink-0", collapsed && "rotate-180")} />
            {!collapsed && "Recolher"}
          </button>
        </div>
      </aside>

      {/* Mobile: faixa fina + painel em tela cheia. */}
      <header className="md:hidden sticky top-0 z-[var(--z-header)] bg-shell-bg text-shell-foreground">
        <div className="flex items-center gap-2 h-14 px-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label="Abrir navegação"
            className="inline-flex items-center justify-center size-11 shrink-0"
          >
            <span aria-hidden="true" className="flex flex-col gap-1">
              <span className="block h-px w-4.5 bg-current" />
              <span className="block h-px w-4.5 bg-current" />
              <span className="block h-px w-3 bg-current" />
            </span>
          </button>
          <Link href="/dashboard" aria-label="Início — CORTEX.OS" className="shrink-0">
            <Wordmark tamanho="sm" />
          </Link>
          <span className="ml-auto min-w-0 truncate text-caption text-shell-muted">{contexto.empresa}</span>
          <SinoDeNotificacoes
            area="equipe"
            empresaId={empresaId}
            variante="barra"
            linkTudo="/notificacoes"
            linkPreferencias="/configuracoes/notificacoes"
          />
        </div>
      </header>

      {mobileOpen && (
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação principal"
          className="md:hidden fixed inset-0 z-[var(--z-modal)] flex h-[100dvh] flex-col bg-shell-bg text-shell-foreground animate-fade-in"
        >
          <div className="flex items-center justify-between h-14 px-4 border-b border-shell-border">
            <Wordmark tamanho="sm" />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="text-nav text-shell-muted hover:text-shell-foreground min-h-11 px-3 -mr-3"
            >
              Fechar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <ContextoDaEmpresa contexto={contexto} compacto />
            {grupos.map((grupo) => (
              <div key={grupo.rotulo} className="mt-5">
                <p className="mb-1 font-subtitle text-micro font-bold uppercase tracking-label text-shell-foreground">{grupo.rotulo}</p>
                <div className="grid grid-cols-2 gap-x-3">
                  {grupo.itens.map((item) => {
                    const ativo = estaAtivo(item.href, pathname);
                    const Icone = item.icone;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={ativo ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center gap-3 text-body",
                          ativo ? "text-shell-foreground" : "text-shell-muted"
                        )}
                      >
                        <Icone className={cn("size-5 shrink-0", ativo ? "text-brand-blue" : "text-shell-muted")} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-5 pt-3 border-t border-shell-border grid grid-cols-2 gap-x-3">
              {rodape.map((item) => {
                const Icone = item.icone;
                return (
                  <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-3 text-body text-shell-muted">
                    <Icone className="size-5 shrink-0 text-shell-muted" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div
            className="px-4 pt-3 border-t border-shell-border"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <IdentidadeDoUsuario usuario={usuario} />
            <div className="mt-3">{menuConta}</div>
          </div>
        </div>
      )}

      <div className={cn("flex-1 min-w-0", entrada && "entrada-produto")}>
        <main className={cn("shell py-7 sm:py-9 lg:py-11 w-full", scope === "barber" && "pb-28 md:pb-11")}>{children}</main>
        {scope === "barber" && <AbasDoBarbeiro pathname={pathname} />}
      </div>
    </div>
  );
}

function ItemDaSidebar({ item, ativo, recolhida }: { item: Destino; ativo: boolean; recolhida: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      aria-label={recolhida ? item.label : undefined}
      title={recolhida ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-sm py-[0.4375rem] text-nav transition-colors duration-micro ease-standard",
        recolhida ? "justify-center px-0" : "px-3",
        ativo ? "text-shell-foreground bg-surface-muted" : "text-shell-muted hover:text-shell-foreground hover:bg-surface-muted/60"
      )}
    >
      {/* O quadrado da marca marca onde você está — o mesmo sinal do eyebrow da landing. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 size-1.5 bg-brand-blue transition-transform duration-interacao ease-sinal",
          ativo ? "scale-100" : "scale-0"
        )}
      />
      <Icone className={cn("size-4.5 shrink-0", ativo ? "text-brand-blue" : "text-current")} />
      {!recolhida && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function ContextoDaEmpresa({ contexto, compacto = false }: { contexto: Contexto; compacto?: boolean }) {
  const inicial = contexto.empresa.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div className={cn("flex items-center gap-3 min-w-0", compacto ? "" : "mx-3 mb-4 px-2.5 py-2 rounded-sm bg-surface-muted/70")}>
      {contexto.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={contexto.logoUrl} alt="" className="size-8 rounded-xs object-cover shrink-0" />
      ) : (
        <span aria-hidden className="size-8 rounded-xs grid place-items-center shrink-0 bg-brand-blue text-neutral-ink font-heading text-body font-semibold">
          {inicial}
        </span>
      )}
      <span className="min-w-0 flex flex-col leading-tight">
        <span className="text-body-sm font-medium text-shell-foreground truncate">{contexto.empresa}</span>
        {contexto.unidade && <span className="text-micro text-shell-muted truncate mt-0.5">{contexto.unidade}</span>}
      </span>
    </div>
  );
}

function IdentidadeDoUsuario({ usuario }: { usuario: Usuario }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span
        aria-hidden
        className="size-8 rounded-xs grid place-items-center shrink-0 bg-surface-muted text-micro font-semibold text-shell-foreground"
      >
        {usuario.iniciais}
      </span>
      <span className="min-w-0 flex flex-col leading-tight text-left">
        <span className="text-body-sm text-shell-foreground truncate">{usuario.nome}</span>
        <span className="text-micro text-shell-muted truncate mt-0.5">{usuario.papel}</span>
      </span>
    </span>
  );
}

/**
 * O menu da conta: tema, rever a apresentação, trocar modo/empresa, sair.
 * Um popover ancorado no rodapé da sidebar — fecha com Esc, clique fora ou
 * troca de página.
 */
function MenuDaConta({
  usuario,
  recolhida,
  children,
}: {
  usuario: Usuario;
  recolhida: boolean;
  children?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setAberto(false), [pathname]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative pt-1">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={`Conta de ${usuario.nome}`}
        className={cn(
          "w-full flex items-center rounded-sm py-1.5 hover:bg-surface-muted/60 transition-colors duration-micro ease-standard",
          recolhida ? "justify-center" : "px-2"
        )}
      >
        {recolhida ? (
          <span aria-hidden className="size-8 rounded-xs grid place-items-center bg-surface-muted text-micro font-semibold text-shell-foreground">
            {usuario.iniciais}
          </span>
        ) : (
          <IdentidadeDoUsuario usuario={usuario} />
        )}
      </button>
      {aberto && (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full mb-2 z-[var(--z-dropdown)] w-64 rounded-md p-3 animate-scale-in origin-bottom-left",
            "bg-neutral-onyx text-shell-foreground shadow-md border border-shell-border",
            recolhida ? "left-full ml-2 bottom-0 mb-0" : "left-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}


/**
 * Celular do barbeiro (redesenho nov/2026): as quatro telas do dia numa barra
 * fixa embaixo, ao alcance do polegar. O menu do topo continua para Ajuda e
 * conta. Só no celular; no computador vale a barra lateral.
 */
const ABAS_DO_BARBEIRO: { href: string; label: string }[] = [
  { href: "/agenda", label: "Agenda" },
  { href: "/atendimento", label: "Atender" },
  { href: "/clientes", label: "Clientes" },
  { href: "/comissoes", label: "Comissões" },
];

function AbasDoBarbeiro({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Atalhos do dia"
      className="md:hidden fixed inset-x-0 bottom-0 z-[var(--z-header)] grid grid-cols-4 border-t border-border bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ABAS_DO_BARBEIRO.map((a) => {
        const ativo = estaAtivo(a.href, pathname);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1.5 text-caption",
              ativo ? "font-bold text-info-ink" : "text-muted"
            )}
          >
            <span aria-hidden className={cn("h-1 w-6 rounded-full", ativo ? "bg-primary" : "bg-transparent")} />
            {a.label}
          </Link>
        );
      })}
    </nav>
  );
}
