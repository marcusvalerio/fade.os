"use client";

import { useSyncExternalStore } from "react";
import { contarNaoLidas } from "@/actions/notificacoes";
import type { Area } from "@/lib/notificacoes/catalogo";

/**
 * Contador de não lidas compartilhado pela aba inteira. O sino aparece duas
 * vezes no DOM (sidebar no desktop, faixa no celular; uma escondida por
 * CSS) — os dois leem daqui e existe UMA consulta periódica por aba, não uma
 * por sino.
 *
 * Atualiza: a cada 60 s com a aba visível, ao voltar para a aba, e quando
 * alguém avisa (push em primeiro plano, marcar como lida, arquivar).
 */

export const EVENTO_NOTIFICACOES = "cortex:notificacoes";
const INTERVALO_MS = 60_000;

type Chave = { area: Area; empresaId: string | null };

let valor = 0;
let chave: Chave | null = null;
const assinantes = new Set<() => void>();
let timer: number | null = null;
let buscando = false;

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

function ligar() {
  document.addEventListener("visibilitychange", aoMudar);
  window.addEventListener(EVENTO_NOTIFICACOES, aoMudar);
  timer = window.setInterval(aoMudar, INTERVALO_MS);
  void atualizarContador();
}

function desligar() {
  document.removeEventListener("visibilitychange", aoMudar);
  window.removeEventListener(EVENTO_NOTIFICACOES, aoMudar);
  if (timer !== null) window.clearInterval(timer);
  timer = null;
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
