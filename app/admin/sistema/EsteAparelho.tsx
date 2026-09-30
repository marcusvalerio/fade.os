"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Estado = "ok" | "pendente" | "verificando";

/**
 * O que só o navegador sabe: service worker registrado, permissão de
 * notificação, e se o canal Realtime deste Admin conecta de verdade (abre um
 * canal só para o teste e fecha em seguida). Nada é gravado.
 */
export function EsteAparelho({ pushAtivoNaConta, aparelhosDaConta, firebaseNavegador }: { pushAtivoNaConta: boolean; aparelhosDaConta: number; firebaseNavegador: boolean }) {
  const [sw, setSw] = useState<Estado>("verificando");
  const [permissao, setPermissao] = useState<string>("verificando");
  const [realtime, setRealtime] = useState<Estado>("verificando");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) setSw("pendente");
    else
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => setSw(regs.some((r) => (r.active?.scriptURL ?? "").includes("firebase-messaging-sw")) ? "ok" : "pendente"))
        .catch(() => setSw("pendente"));
    setPermissao(typeof Notification === "undefined" ? "indisponível" : Notification.permission);

    const supabase = createClient();
    const canal = supabase.channel(`saude-realtime-${Math.random().toString(36).slice(2)}`);
    const t = window.setTimeout(() => setRealtime("pendente"), 8000);
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(t);
        setRealtime("ok");
        void supabase.removeChannel(canal);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        window.clearTimeout(t);
        setRealtime("pendente");
      }
    });
    return () => {
      window.clearTimeout(t);
      void supabase.removeChannel(canal);
    };
  }, []);

  const rotuloPermissao: Record<string, string> = {
    granted: "permitida",
    denied: "bloqueada neste navegador",
    default: "ainda não pedida",
    indisponível: "não suportada",
    verificando: "verificando…",
  };

  return (
    <ul className="divide-y divide-border">
      <Linha rotulo="Realtime (conexão deste navegador)" estado={realtime} detalhe={realtime === "ok" ? "Conectado agora." : realtime === "pendente" ? "Não conectou em 8 s." : "Conectando…"} />
      <Linha rotulo="Service Worker" estado={sw} detalhe={sw === "ok" ? "Registrado neste navegador." : sw === "pendente" ? "Não registrado — ele é instalado quando o push é ativado neste aparelho." : "Verificando…"} />
      <Linha
        rotulo="Permissão de notificação"
        estado={permissao === "granted" ? "ok" : permissao === "verificando" ? "verificando" : "pendente"}
        detalhe={rotuloPermissao[permissao] ?? permissao}
      />
      <Linha
        rotulo="Dispositivo atual"
        estado={pushAtivoNaConta && aparelhosDaConta > 0 && sw === "ok" ? "ok" : "pendente"}
        detalhe={
          !firebaseNavegador
            ? "Não registrado — o push não pode ser ativado enquanto a configuração pública do Firebase estiver ausente."
            : pushAtivoNaConta && aparelhosDaConta > 0
              ? `Ativo — ${aparelhosDaConta} aparelho(s) desta conta.`
              : "Não registrado — ative em Avisos → Preferências neste aparelho."
        }
      />
    </ul>
  );
}

export function Linha({ rotulo, estado, detalhe }: { rotulo: string; estado: Estado; detalhe: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
      <span className="text-body-sm text-foreground">{rotulo}</span>
      <span className="flex items-baseline gap-2 min-w-0">
        <span
          className={
            estado === "ok"
              ? "font-subtitle text-micro uppercase tracking-label text-success-ink"
              : estado === "pendente"
                ? "font-subtitle text-micro uppercase tracking-label text-warning-ink"
                : "font-subtitle text-micro uppercase tracking-label text-muted"
          }
        >
          {estado === "ok" ? "OK" : estado === "pendente" ? "Pendente" : "…"}
        </span>
        <span className="text-caption text-muted text-right">{detalhe}</span>
      </span>
    </li>
  );
}
