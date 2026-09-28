/*
 * CORTEX — service worker das notificações push (Firebase Cloud Messaging).
 *
 * Deliberadamente sem o SDK do Firebase aqui dentro: o servidor manda só
 * DADOS (lib/notificacoes/fcm.ts → montarMensagem), e este arquivo desenha a
 * notificação, decide entre mostrar no sistema ou entregar à aba aberta, e
 * cuida do clique. Sem importScripts de outro domínio, sem configuração
 * embutida, sem segredo nenhum.
 *
 * Escopo próprio (/firebase-cloud-messaging-push-scope, o padrão do FCM):
 * este worker NÃO controla as páginas nem intercepta requisições.
 *
 * Erros daqui são repassados às abas abertas, que mandam ao Sentry
 * (components/notificacoes/ouvinte-push.tsx).
 */

const VERSAO = "2026-09-30.1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function avisarAbas(mensagem) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((abas) => abas.forEach((a) => a.postMessage({ origem: "cortex-push", versao: VERSAO, ...mensagem })));
}

function relatarErro(onde, erro) {
  return avisarAbas({ tipo: "erro", onde, mensagem: String((erro && erro.message) || erro).slice(0, 200) });
}

function lerDados(event) {
  if (!event.data) return null;
  let bruto;
  try {
    bruto = event.data.json();
  } catch (e) {
    return null;
  }
  // Mensagem de dados do FCM: { data: {...}, from, fcmMessageId }
  const d = (bruto && (bruto.data || bruto)) || {};
  if (!d.titulo && bruto && bruto.notification) {
    return { titulo: bruto.notification.title, corpo: bruto.notification.body, url: "", notificacao_id: "", prioridade: "normal" };
  }
  return d;
}

function destinoDoClique(d) {
  const url = typeof d.url === "string" && /^\/[A-Za-z0-9]/.test(d.url) ? d.url : "";
  if (d.notificacao_id) {
    return "/notificacoes/abrir/" + encodeURIComponent(d.notificacao_id) + (url ? "?destino=" + encodeURIComponent(url) : "");
  }
  return url || "/";
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const d = lerDados(event);
      if (!d || !d.titulo) return;

      // Com o CORTEX aberto e à vista, a própria tela mostra o aviso (e
      // atualiza o sino) — sem notificação duplicada no sistema.
      const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visivel = abas.find((a) => a.visibilityState === "visible" && a.focused);
      if (visivel) {
        visivel.postMessage({ origem: "cortex-push", tipo: "primeiro-plano", dados: d });
        abas.forEach((a) => a !== visivel && a.postMessage({ origem: "cortex-push", tipo: "chegou" }));
        return;
      }

      const urgente = d.prioridade === "critical" || d.prioridade === "important";
      await self.registration.showNotification(d.titulo, {
        body: d.corpo || "",
        icon: "/apple-icon.png",
        // Mesma notificação não empilha duas vezes (reentrega do FCM).
        tag: d.notificacao_id || undefined,
        renotify: false,
        requireInteraction: d.prioridade === "critical",
        silent: !urgente && d.prioridade === "informational",
        data: { destino: destinoDoClique(d) },
      });
      abas.forEach((a) => a.postMessage({ origem: "cortex-push", tipo: "chegou" }));
    })().catch((e) => relatarErro("push", e))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.destino) || "/";
  event.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aba = abas.find((a) => new URL(a.url).origin === self.location.origin);
      if (aba) {
        // A aba não é controlada por este worker (escopo próprio): quem
        // navega é a própria página.
        await aba.focus();
        aba.postMessage({ origem: "cortex-push", tipo: "abrir", destino });
        return;
      }
      await self.clients.openWindow(destino);
    })().catch((e) => relatarErro("clique", e))
  );
});

// O navegador trocou a inscrição (expirou/rotacionou): as abas abertas
// pedem um token novo e registram de novo.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(avisarAbas({ tipo: "renovar-token" }).catch(() => {}));
});
