"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { EVENTO_NOTIFICACOES } from "@/components/notificacoes/contador";
import { pedidosBetaPendentes } from "@/actions/pedidos-beta";
import { descricaoDaFaixa, novosPedidos, tituloDaFaixa, type PedidosPendentes } from "@/lib/pedidos-beta";
import { quandoRelativo } from "@/lib/notificacoes/catalogo";
import { cn } from "@/lib/cn";

/**
 * IMPORTANTE · ACESSO BETA — a faixa que não deixa um pedido passar.
 *
 * Fica no topo de todas as telas do Admin enquanto existir pedido pendente
 * e some sozinha quando não houver mais nenhum. A fonte é o estado do pedido,
 * não a notificação: se um aviso falhar, o pedido continua aqui.
 *
 * Atualiza sem recarregar: consulta leve a cada 30 s (inclusive com a aba em
 * segundo plano, onde o navegador espaça para ~1 min), ao voltar para a aba e
 * quando o sino avisa que algo mudou. Pedido novo → aviso na tela, sino
 * atualizado e, com a aba em segundo plano e permissão dada, notificação do
 * sistema — uma vez por pedido nesta aba.
 *
 * Tempo real: a notificação `plataforma.beta_solicitacao` chega pelo Realtime
 * (components/notificacoes/contador.ts) como EVENTO_NOTIFICACOES, e a faixa
 * consulta na hora. A consulta de 30 s continua como rede de segurança.
 */

const INTERVALO_MS = 30_000;
const ROTAS_QUE_MOSTRAM_PEDIDOS = ["/admin", "/admin/acessos", "/admin/alertas", "/admin/avisos"];

export function FaixaDePedidosBeta({ inicial }: { inicial: PedidosPendentes | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { show } = useToast();
  const [dados, setDados] = useState<PedidosPendentes | null>(inicial);
  const [chegouAgora, setChegouAgora] = useState(false);
  const vistos = useRef(new Set((inicial?.recentes ?? []).map((r) => r.id)));
  const rota = useRef(pathname);
  rota.current = pathname;
  const totalAtual = useRef(inicial?.total ?? 0);

  // O servidor manda o estado novo a cada navegação (o layout relê): uma
  // aprovação feita em outra tela já chega aqui sem esperar a consulta.
  useEffect(() => {
    setDados(inicial);
    totalAtual.current = inicial?.total ?? 0;
    (inicial?.recentes ?? []).forEach((r) => vistos.current.add(r.id));
  }, [inicial]);

  useEffect(() => {
    let buscando = false;
    let vivo = true;

    async function consultar() {
      if (buscando) return;
      buscando = true;
      try {
        const novo = await pedidosBetaPendentes();
        if (!vivo || !novo) return;
        const chegaram = novosPedidos(vistos.current, novo.recentes);
        chegaram.forEach((r) => vistos.current.add(r.id));
        const mudou = novo.total !== totalAtual.current;
        totalAtual.current = novo.total;
        setDados(novo);
        // A Central ("Pede ação") e Acessos são telas do servidor: quando a
        // contagem muda, elas relêem também.
        if (mudou && ROTAS_QUE_MOSTRAM_PEDIDOS.includes(rota.current)) router.refresh();
        if (chegaram.length > 0) avisar(novo, chegaram.length);
      } catch {
        /* rede caiu: tenta no próximo ciclo */
      } finally {
        buscando = false;
      }
    }

    function avisar(novo: PedidosPendentes, quantos: number) {
      const titulo = quantos === 1 ? "Novo pedido de acesso ao Beta" : `${quantos} novos pedidos de acesso ao Beta`;
      show(`${titulo} — ${descricaoDaFaixa(novo)}`);
      setChegouAgora(true);
      window.setTimeout(() => setChegouAgora(false), 6000);
      window.dispatchEvent(new CustomEvent(EVENTO_NOTIFICACOES, { detail: { origem: "faixa-beta" } }));
      if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          // tag = pedido mais recente: duas abas abertas substituem a mesma
          // notificação do sistema em vez de empilhar duas.
          new Notification(titulo, { body: descricaoDaFaixa(novo), tag: `beta:${novo.recentes[0]?.id ?? "novo"}` });
        } catch {
          /* alguns navegadores móveis só aceitam via service worker */
        }
      }
    }

    function aoVoltar() {
      if (document.visibilityState === "visible") void consultar();
    }
    function aoMudarSino(e: Event) {
      if ((e as CustomEvent).detail?.origem !== "faixa-beta") void consultar();
    }

    const timer = window.setInterval(consultar, INTERVALO_MS);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO_NOTIFICACOES, aoMudarSino);
    return () => {
      vivo = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO_NOTIFICACOES, aoMudarSino);
    };
  }, [router, show]);

  if (!dados || dados.total === 0) return null;
  const ultimo = dados.recentes[0];

  return (
    <section aria-label="Pedidos de acesso ao Beta aguardando decisão" aria-live="polite" className="mb-6 animate-rise-in">
      <Link
        href="/admin/acessos#pendentes"
        className={cn(
          "group grid grid-cols-[0.625rem_minmax(0,1fr)] sm:grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3",
          "rounded-lg border border-warning/35 bg-warning/[0.07] px-5 py-4",
          "transition-colors duration-fast ease-standard hover:bg-warning/[0.11] hover:border-warning/60",
          chegouAgora && "border-warning/80"
        )}
      >
        <span aria-hidden className="relative self-start mt-1.5 size-2.5 bg-warning">
          {chegouAgora && <span className="absolute inset-0 bg-warning animate-ping motion-reduce:hidden" />}
        </span>
        <span className="min-w-0">
          <span className="block font-subtitle text-micro uppercase tracking-label text-warning-ink">Importante · Acesso Beta</span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-medium text-foreground">{tituloDaFaixa(dados.total)}</span>
            {ultimo && <span className="mono text-caption text-muted">{quandoRelativo(ultimo.criadoEm).toLowerCase()}</span>}
          </span>
          <span className="block text-caption text-muted mt-0.5 break-words">{descricaoDaFaixa(dados)}</span>
        </span>
        <span className="col-start-2 sm:col-start-auto justify-self-start sm:justify-self-end inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-warning/40 px-3.5 text-body-sm font-medium text-warning-ink group-hover:border-warning/70">
          {dados.total === 1 ? "Analisar solicitação" : "Analisar solicitações"}
          <span aria-hidden className="transition-transform duration-fast ease-standard group-hover:translate-x-0.5">→</span>
        </span>
      </Link>
    </section>
  );
}
