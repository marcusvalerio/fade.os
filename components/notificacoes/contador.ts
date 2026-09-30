"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { contarNaoLidas } from "@/actions/notificacoes";
import { createClient } from "@/lib/supabase/client";
import type { Area } from "@/lib/notificacoes/catalogo";

/**
 * Contador de não lidas compartilhado pela aba inteira. O sino aparece duas
 * vezes no DOM (sidebar no desktop, faixa no celular; uma escondida por
 * CSS) — os dois leem daqui e existe UMA consulta periódica por aba, não uma
 * por sino.
 *
 * Atualiza: em TEMPO REAL (Realtime do Supabase na tabela `notificacao`,
 * filtrado pela própria pessoa — a RLS garante o resto: cada um só recebe as
 * próprias linhas, e as da plataforma só com sessão do Admin), ao voltar para
 * a aba, quando alguém avisa (push em primeiro plano, marcar como lida,
 * arquivar) e, como rede de segurança se o Realtime cair, a cada 60 s.
 *
 * O evento de tempo real é repassado como EVENTO_NOTIFICACOES com
 * `detail.origem = "realtime"`, e a faixa de pedidos Beta do Admin reage a ele.
 */

export const EVENTO_NOTIFICACOES = "cortex:notificacoes";
const INTERVALO_MS = 60_000;

type Chave = { area: Area; empresaId: string | null };

let valor = 0;
let chave: Chave | null = null;
const assinantes = new Set<() => void>();
let timer: number | null = null;
let buscando = false;
let canal: RealtimeChannel | null = null;
let desligarRealtime: (() => void) | null = null;

function avisar() {
  assinantes.forEach((f) => f());
}

export async function atualizarContador() {
  if (!chave || buscando || document.visibilityState !== "visible") return;
  buscando = true;
  try {
    const n = await contarNaoLidas(chave.area, chave.empresaId);
    if (n !== valor) {
      valor = n;
      avisar();
    }
  } catch {
    /* rede caiu: tenta no próximo ciclo */
  } finally {
    buscando = false;
  }
}

/** Ajuste otimista (marcar como lida antes da resposta do servidor). */
export function ajustarContador(delta: number | "zerar") {
  valor = delta === "zerar" ? 0 : Math.max(0, valor + delta);
  avisar();
}

function aoMudar() {
  void atualizarContador();
}

async function ligarRealtime() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid || timer === null) return; // desligou enquanto esperava
  canal = supabase
    .channel(`notificacoes:${uid}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notificacao", filter: `user_id=eq.${uid}` }, (payload) => {
      const nova = payload.new as { tipo?: string } | undefined;
      window.dispatchEvent(new CustomEvent(EVENTO_NOTIFICACOES, { detail: { origem: "realtime", evento: payload.eventType, tipo: nova?.tipo ?? null } }));
    })
    .subscribe();
  desligarRealtime = () => {
    if (canal) void supabase.removeChannel(canal);
    canal = null;
  };
}

function ligar() {
  document.addEventListener("visibilitychange", aoMudar);
  window.addEventListener(EVENTO_NOTIFICACOES, aoMudar);
  timer = window.setInterval(aoMudar, INTERVALO_MS);
  void atualizarContador();
  void ligarRealtime().catch(() => {
    /* sem Realtime: o intervalo de 60 s segue valendo */
  });
}

function desligar() {
  document.removeEventListener("visibilitychange", aoMudar);
  window.removeEventListener(EVENTO_NOTIFICACOES, aoMudar);
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  desligarRealtime?.();
  desligarRealtime = null;
}

function assinar(nova: Chave) {
  return (f: () => void) => {
    if (!chave || chave.area !== nova.area || chave.empresaId !== nova.empresaId) {
      chave = nova;
      valor = 0;
      if (assinantes.size > 0) void atualizarContador();
    }
    assinantes.add(f);
    if (assinantes.size === 1) ligar();
    return () => {
      assinantes.delete(f);
      if (assinantes.size === 0) desligar();
    };
  };
}

const cacheDeAssinaturas = new Map<string, (f: () => void) => () => void>();

export function useNaoLidas(area: Area, empresaId: string | null): number {
  const k = `${area}:${empresaId ?? ""}`;
  let sub = cacheDeAssinaturas.get(k);
  if (!sub) {
    sub = assinar({ area, empresaId });
    cacheDeAssinaturas.set(k, sub);
  }
  return useSyncExternalStore(sub, () => valor, () => 0);
}
