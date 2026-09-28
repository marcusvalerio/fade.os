"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasComoLidas,
  arquivarNotificacao,
  type NotificacaoDaCentral,
} from "@/actions/notificacoes";
import { grupoDoDia, quandoRelativo, ROTULO_DA_CATEGORIA, type Categoria } from "@/lib/notificacoes/catalogo";
import { ajustarContador, atualizarContador } from "@/components/notificacoes/contador";
import { capturarNoNavegador } from "@/lib/observabilidade-navegador";
import {
  IconeAgenda,
  IconeClientes,
  IconeFinanceiro,
  IconeEstoque,
  IconeEquipe,
  IconeComissoes,
  IconeConfiguracoes,
  IconeProduto,
  IconeSino,
} from "@/components/ui/nav-icons";
import { cn } from "@/lib/cn";

const ICONE: Record<Categoria, (p: { className?: string }) => React.ReactElement> = {
  agenda: IconeAgenda,
  clientes: IconeClientes,
  financeiro: IconeFinanceiro,
  estoque: IconeEstoque,
  equipe: IconeEquipe,
  produto: IconeProduto,
  sistema: IconeConfiguracoes,
};

type Aba = "todas" | "nao_lidas";
const LIMITE = 30;

/**
 * A lista da central (painel do sino e página inteira). Cada item leva ao
 * contexto (passando por /notificacoes/abrir/<id>, que marca como aberta e
 * lida) e pode ser marcado como lido ou arquivado sem sair do lugar.
 *
 * Não lida: título em peso maior, quadrado da marca à esquerda e o texto
 * "Não lida" para leitores de tela — nunca só a cor.
 */
export function ListaDeNotificacoes({
  area,
  empresaId,
  compacta = false,
  aoAbrir,
}: {
  area: "equipe" | "cliente";
  empresaId: string | null;
  compacta?: boolean;
  aoAbrir?: () => void;
}) {
  const [aba, setAba] = useState<Aba>("todas");
  const [itens, setItens] = useState<NotificacaoDaCentral[] | null>(null);
  const [haMais, setHaMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const idBase = useId();
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const carregar = useCallback(
    async (qual: Aba) => {
      setItens(null);
      try {
        const lista = await listarNotificacoes(area, empresaId, { somenteNaoLidas: qual === "nao_lidas", limite: LIMITE });
        setItens(lista);
        setHaMais(lista.length === LIMITE);
      } catch (e) {
        capturarNoNavegador(e, "notificacoes.listar");
        setItens([]);
      }
    },
    [area, empresaId]
  );

  useEffect(() => {
    void carregar(aba);
  }, [aba, carregar]);

  async function maisAntigas() {
    if (!itens?.length) return;
    setCarregandoMais(true);
    const lista = await listarNotificacoes(area, empresaId, {
      somenteNaoLidas: aba === "nao_lidas",
      limite: LIMITE,
      antes: itens[itens.length - 1].criada_em,
    }).catch(() => []);
    setItens([...itens, ...lista]);
    setHaMais(lista.length === LIMITE);
    setCarregandoMais(false);
  }

  function marcarLida(id: string) {
    setItens((l) => l && (aba === "nao_lidas" ? l.filter((n) => n.id !== id) : l.map((n) => (n.id === id ? { ...n, lida_em: new Date().toISOString() } : n))));
    ajustarContador(-1);
    void marcarNotificacaoLida(id).finally(atualizarContador);
  }

  function arquivar(n: NotificacaoDaCentral) {
    setItens((l) => l && l.filter((x) => x.id !== n.id));
    if (!n.lida_em) ajustarContador(-1);
    setAviso("Notificação arquivada.");
    void arquivarNotificacao(n.id).finally(atualizarContador);
  }

  async function marcarTodas() {
    setItens((l) => (aba === "nao_lidas" ? [] : l && l.map((n) => ({ ...n, lida_em: n.lida_em ?? new Date().toISOString() }))));
    ajustarContador("zerar");
    const n = await marcarTodasComoLidas(area, empresaId).catch(() => 0);
    setAviso(n === 1 ? "1 notificação marcada como lida." : `${n} notificações marcadas como lidas.`);
    void atualizarContador();
  }

  // Setas trocam de aba (padrão de tablist).
  function teclaNaAba(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const prox = (i + (e.key === "ArrowRight" ? 1 : -1) + 2) % 2;
    setAba(prox === 0 ? "todas" : "nao_lidas");
    tabsRef.current[prox]?.focus();
  }

  const temNaoLidas = !!itens?.some((n) => !n.lida_em);
  const agora = new Date();
  const grupos: { rotulo: string; itens: NotificacaoDaCentral[] }[] = [];
  for (const n of itens ?? []) {
    const g = grupoDoDia(n.criada_em, agora);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.rotulo === g) ultimo.itens.push(n);
    else grupos.push({ rotulo: g, itens: [n] });
  }

  const abas: { chave: Aba; rotulo: string }[] = [
    { chave: "todas", rotulo: "Todas" },
    { chave: "nao_lidas", rotulo: "Não lidas" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("flex items-center justify-between gap-3 border-b border-border", compacta ? "px-4" : "")}>
        <div role="tablist" aria-label="Filtrar notificações" className="flex">
          {abas.map((a, i) => (
            <button
              key={a.chave}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idBase}-aba-${a.chave}`}
              aria-selected={aba === a.chave}
              aria-controls={`${idBase}-painel`}
              tabIndex={aba === a.chave ? 0 : -1}
              onClick={() => setAba(a.chave)}
              onKeyDown={(e) => teclaNaAba(e, i)}
              className={cn(
                "alvo-toque relative -mb-px min-h-11 px-3 text-body-sm transition-colors duration-fast ease-standard",
                "border-b-2",
                aba === a.chave ? "border-foreground text-foreground font-medium" : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        {temNaoLidas && (
          <button
            type="button"
            onClick={marcarTodas}
            className="alvo-toque text-caption text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {aviso ?? ""}
      </p>

      <div
        role="tabpanel"
        id={`${idBase}-painel`}
        aria-labelledby={`${idBase}-aba-${aba}`}
        className={cn("min-h-0 flex-1", compacta && "overflow-y-auto overscroll-contain")}
      >
        {itens === null ? (
          <ul aria-busy="true" aria-label="Carregando notificações" className={cn(compacta && "px-4")}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3 py-4 border-b border-border last:border-0">
                <span className="size-8 shrink-0 rounded-sm bg-surface-muted animate-pulse motion-reduce:animate-none" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-2/3 rounded-xs bg-surface-muted animate-pulse motion-reduce:animate-none" />
                  <span className="block h-3 w-full rounded-xs bg-surface-muted animate-pulse motion-reduce:animate-none" />
                </span>
              </li>
            ))}
          </ul>
        ) : itens.length === 0 ? (
          <div className={cn("py-12 text-center", compacta && "px-6")}>
            <IconeSino className="mx-auto size-6 text-muted" />
            <p className="mt-3 text-body-sm font-medium text-foreground">
              {aba === "nao_lidas" ? "Nada novo por aqui." : "Nenhuma notificação ainda."}
            </p>
            <p className="mt-1 text-caption text-muted">
              {aba === "nao_lidas" ? "Você já viu tudo." : "Quando algo pedir sua atenção, aparece aqui."}
            </p>
          </div>
        ) : (
          <div className={cn(compacta && "px-4")}>
            {grupos.map((g) => (
              <section key={g.rotulo} aria-label={g.rotulo}>
                <h3 className="pt-4 pb-1 font-subtitle text-micro uppercase tracking-label text-muted">{g.rotulo}</h3>
                <ul>
                  {g.itens.map((n) => (
                    <ItemDaLista key={n.id} n={n} agora={agora} aoAbrir={aoAbrir} aoMarcarLida={marcarLida} aoArquivar={arquivar} />
                  ))}
                </ul>
              </section>
            ))}
            {haMais && (
              <div className="py-4 text-center">
                <button
                  type="button"
                  onClick={maisAntigas}
                  disabled={carregandoMais}
                  className="alvo-toque text-body-sm text-muted hover:text-foreground disabled:opacity-60"
                >
                  {carregandoMais ? "Carregando…" : "Ver mais antigas"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemDaLista({
  n,
  agora,
  aoAbrir,
  aoMarcarLida,
  aoArquivar,
}: {
  n: NotificacaoDaCentral;
  agora: Date;
  aoAbrir?: () => void;
  aoMarcarLida: (id: string) => void;
  aoArquivar: (n: NotificacaoDaCentral) => void;
}) {
  const Icone = ICONE[n.categoria] ?? IconeSino;
  const IconeFinal = n.tipo === "equipe.comissao_paga" ? IconeComissoes : Icone;
  const naoLida = !n.lida_em;
  const destaque = n.prioridade === "critical" || n.prioridade === "important";
  const quando = quandoRelativo(n.criada_em, agora);
  const dataCompleta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(n.criada_em));

  return (
    <li className="group relative flex items-start gap-3 border-b border-border py-3.5 last:border-0">
      <span
        aria-hidden
        className={cn("absolute -left-3 top-5 size-1.5 bg-brand-blue transition-transform duration-fast", naoLida ? "scale-100" : "scale-0")}
      />
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-sm border",
          naoLida ? "border-border-strong text-foreground" : "border-border text-muted"
        )}
      >
        <IconeFinal className="size-4" />
      </span>

      <a
        href={`/notificacoes/abrir/${n.id}`}
        onClick={() => {
          if (naoLida) ajustarContador(-1);
          aoAbrir?.();
        }}
        className="min-w-0 flex-1 rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="sr-only">{naoLida ? "Não lida. " : ""}{ROTULO_DA_CATEGORIA[n.categoria]}. </span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn("text-body-sm text-foreground", naoLida ? "font-semibold" : "font-normal")}>{n.titulo}</span>
          {destaque && (
            <span className="font-subtitle text-micro uppercase tracking-label text-warning-ink">
              {n.prioridade === "critical" ? "Crítica" : "Importante"}
            </span>
          )}
        </span>
        <span className={cn("mt-0.5 block text-body-sm", naoLida ? "text-foreground/85" : "text-muted")}>{n.corpo}</span>
        <time dateTime={n.criada_em} title={dataCompleta} className="mt-1 block text-caption text-muted">
          {quando}
        </time>
      </a>

      <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
        {naoLida && (
          <button
            type="button"
            onClick={() => aoMarcarLida(n.id)}
            aria-label={`Marcar como lida: ${n.titulo}`}
            title="Marcar como lida"
            className="alvo-toque grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5 6.5 11.5 12.5 5" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => aoArquivar(n)}
          aria-label={`Arquivar: ${n.titulo}`}
          title="Arquivar"
          className="alvo-toque grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="3" width="11" height="3" rx="0.6" />
            <path d="M3.5 6v6.5h9V6M6.5 8.5h3" />
          </svg>
        </button>
      </span>
    </li>
  );
}
