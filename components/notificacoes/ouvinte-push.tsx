"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { capturarNoNavegador } from "@/lib/observabilidade-navegador";
import { destinoSeguro } from "@/lib/notificacoes/catalogo";
import { EVENTO_NOTIFICACOES } from "@/components/notificacoes/contador";

// Um ouvinte por aba, mesmo que o componente monte duas vezes (StrictMode,
// troca de layout): o service worker nunca gera dois toasts.
let instalado = false;
let aoMudar: ((m: MensagemDoWorker) => void) | null = null;

type MensagemDoWorker =
  | { origem: "cortex-push"; tipo: "primeiro-plano"; dados: { titulo?: string; corpo?: string; url?: string; notificacao_id?: string } }
  | { origem: "cortex-push"; tipo: "chegou" | "renovar-token" }
  | { origem: "cortex-push"; tipo: "abrir"; destino: string }
  | { origem: "cortex-push"; tipo: "erro"; onde: string; mensagem: string };

/**
 * Liga a aba ao service worker do push: aviso em primeiro plano (sem
 * notificação duplicada no sistema), clique vindo do sistema, token
 * renovado e erros do worker (→ Sentry). Também confere, uma vez por dia, se
 * o token deste aparelho ainda é o mesmo e se pertence a quem está logado.
 *
 * Não pede permissão nenhuma: isso só acontece num clique (ConvitePush).
 */
export function OuvintePush({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const { show } = useToast();

  useEffect(() => {
    aoMudar = (m) => {
      if (m.tipo === "primeiro-plano") {
        const titulo = m.dados.titulo ?? "Nova notificação";
        show(m.dados.corpo ? `${titulo} — ${m.dados.corpo}` : titulo);
        window.dispatchEvent(new Event(EVENTO_NOTIFICACOES));
      } else if (m.tipo === "chegou") {
        window.dispatchEvent(new Event(EVENTO_NOTIFICACOES));
      } else if (m.tipo === "abrir") {
        const destino = destinoSeguro(m.destino);
        if (destino) router.push(destino);
      } else if (m.tipo === "renovar-token") {
        void import("@/lib/notificacoes/push-navegador").then((p) => p.conferirToken(true));
      } else if (m.tipo === "erro") {
        capturarNoNavegador(new Error(`service worker (${m.onde}): ${m.mensagem}`), "push.service_worker");
      }
    };
    return () => {
      aoMudar = null;
    };
  }, [router, show]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!instalado) {
      instalado = true;
      navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
        const m = e.data as MensagemDoWorker | undefined;
        if (m?.origem === "cortex-push") aoMudar?.(m);
      });
      navigator.serviceWorker.startMessages?.();
    }
  }, []);

  useEffect(() => {
    // Depois que a tela assentou: nada disso compete com o carregamento.
    const t = window.setTimeout(() => {
      void import("@/lib/notificacoes/push-navegador")
        .then(async (p) => {
          await p.definirDono(usuarioId);
          await p.conferirToken();
        })
        .catch((e) => capturarNoNavegador(e, "push.conferir"));
    }, 4000);
    return () => window.clearTimeout(t);
  }, [usuarioId]);

  return null;
}
