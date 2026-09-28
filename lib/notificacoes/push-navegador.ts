"use client";

import { FIREBASE_VAPID_KEY } from "@/lib/notificacoes-push";
import { capturarNoNavegador } from "@/lib/observabilidade-navegador";
import { registrarAparelho, removerAparelho, definirPush } from "@/actions/notificacoes";

/**
 * Push no navegador — o único lugar do CORTEX que fala com o SDK do
 * Firebase. Carregado sob demanda: ninguém baixa o Firebase só por abrir
 * uma tela; ele sobe quando a pessoa liga as notificações (ou quando já
 * ligou e o token precisa ser conferido, no máximo uma vez por dia).
 *
 * Configuração: só valores PÚBLICOS do app Web do Firebase (os mesmos que
 * qualquer site com Firebase expõe) + a VAPID key pública. Nada secreto.
 */

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const PUSH_CONFIGURADO = Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.messagingSenderId && CONFIG.appId && FIREBASE_VAPID_KEY);

const SW_URL = "/firebase-messaging-sw.js";
const SW_ESCOPO = "/firebase-cloud-messaging-push-scope";
const CHAVE_TOKEN = "cortex.push.token";
const CHAVE_CONFERIDO = "cortex.push.conferido_em";
const CHAVE_ADIADO = "cortex.push.adiado_em";
const CHAVE_DONO = "cortex.push.dono";

export type EstadoDoPush =
  | "indisponivel" // navegador sem suporte (ex.: Safari do iPhone fora da tela de início)
  | "nao_configurado" // ambiente sem as chaves públicas do Firebase
  | "bloqueado" // a pessoa (ou o navegador) negou
  | "pendente" // ainda não perguntamos
  | "ativo"; // este aparelho está registrado

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    /* navegação privada: segue sem lembrar */
  }
}

export function suportaPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad: o Safari só entrega push para o site adicionado à Tela de Início. */
export function ehIosForaDaTelaDeInicio(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function estadoAtual(): EstadoDoPush {
  if (!suportaPush()) return "indisponivel";
  if (!PUSH_CONFIGURADO) return "nao_configurado";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission === "granted" && ler(CHAVE_TOKEN)) return "ativo";
  return "pendente";
}

/** "Agora não" vale por 14 dias neste navegador. */
export function conviteAdiado(): boolean {
  const t = Number(ler(CHAVE_ADIADO) ?? 0);
  return Date.now() - t < 14 * 86_400_000;
}
export function adiarConvite() {
  gravar(CHAVE_ADIADO, String(Date.now()));
}

function rotuloDoAparelho(): string {
  const ua = navigator.userAgent;
  const navegador = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const sistema = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iPhone" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return sistema ? `${navegador} no ${sistema}` : navegador;
}

let donoAtual: string | null = null;

/**
 * Quem está usando este navegador agora. Se o token guardado aqui foi
 * registrado por outra conta (computador do balcão, alguém saiu sem clicar
 * em Sair), ele é descartado: os avisos de uma pessoa nunca aparecem na
 * sessão de outra.
 */
export async function definirDono(userId: string): Promise<void> {
  donoAtual = userId;
  const dono = ler(CHAVE_DONO);
  if (ler(CHAVE_TOKEN) && dono && dono !== userId) {
    gravar(CHAVE_TOKEN, null);
    gravar(CHAVE_CONFERIDO, null);
    try {
      const msg = await obterMensageria();
      if (msg) await (await import("firebase/messaging")).deleteToken(msg);
    } catch (e) {
      capturarNoNavegador(e, "push.trocar_conta");
    }
  }
  if (!ler(CHAVE_TOKEN)) gravar(CHAVE_DONO, null);
}

let mensageria: Promise<import("firebase/messaging").Messaging | null> | null = null;

async function obterMensageria() {
  mensageria ??= (async () => {
    const [{ initializeApp, getApps }, m] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
    if (!(await m.isSupported())) return null;
    const app = getApps()[0] ?? initializeApp(CONFIG as Record<string, string>);
    return m.getMessaging(app);
  })().catch((e) => {
    mensageria = null;
    capturarNoNavegador(e, "push.firebase_init");
    return null;
  });
  return mensageria;
}

async function registroDoWorker() {
  const existente = await navigator.serviceWorker.getRegistration(SW_ESCOPO);
  if (existente) return existente;
  return navigator.serviceWorker.register(SW_URL, { scope: SW_ESCOPO });
}

async function pedirToken(): Promise<string> {
  const msg = await obterMensageria();
  if (!msg) throw new Error("Firebase Messaging indisponível neste navegador");
  const { getToken } = await import("firebase/messaging");
  const registro = await registroDoWorker();
  return getToken(msg, { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registro });
}

/** Grava o token no servidor e troca o antigo, se o Firebase gerou outro. */
async function guardarToken(token: string) {
  const anterior = ler(CHAVE_TOKEN);
  const r = await registrarAparelho(token, rotuloDoAparelho());
  if (!r.ok) throw new Error(r.error);
  if (anterior && anterior !== token) await removerAparelho(anterior).catch(() => {});
  gravar(CHAVE_TOKEN, token);
  if (donoAtual) gravar(CHAVE_DONO, donoAtual);
  gravar(CHAVE_CONFERIDO, String(Date.now()));
}

export type ResultadoDaAtivacao = { ok: true } | { ok: false; estado: EstadoDoPush; mensagem: string };

/**
 * Pede permissão e registra este aparelho. Chame SÓ a partir de um clique
 * (o navegador ignora pedido de permissão sem gesto da pessoa).
 */
export async function ativarPush(): Promise<ResultadoDaAtivacao> {
  if (!suportaPush()) {
    return { ok: false, estado: "indisponivel", mensagem: ehIosForaDaTelaDeInicio()
      ? "No iPhone, adicione o CORTEX à Tela de Início (Compartilhar → Adicionar à Tela de Início) e ative por lá."
      : "Este navegador não recebe notificações push." };
  }
  if (!PUSH_CONFIGURADO) return { ok: false, estado: "nao_configurado", mensagem: "Notificações no aparelho ainda não estão disponíveis neste ambiente." };

  let permissao: NotificationPermission;
  try {
    permissao = await Notification.requestPermission();
  } catch (e) {
    capturarNoNavegador(e, "push.permissao");
    return { ok: false, estado: "pendente", mensagem: "Não foi possível pedir a permissão. Tente de novo." };
  }
  if (permissao !== "granted") {
    await definirPush(false, permissao === "denied" ? "denied" : "default").catch(() => {});
    return permissao === "denied"
      ? { ok: false, estado: "bloqueado", mensagem: "As notificações estão bloqueadas neste navegador." }
      : { ok: false, estado: "pendente", mensagem: "Tudo bem, você pode ligar depois." };
  }
  try {
    await guardarToken(await pedirToken());
    return { ok: true };
  } catch (e) {
    capturarNoNavegador(e, "push.token");
    return { ok: false, estado: "pendente", mensagem: "Não conseguimos registrar este aparelho. Tente de novo em instantes." };
  }
}

/** Desliga só ESTE aparelho (os outros continuam recebendo). */
export async function desativarNesteAparelho(): Promise<void> {
  const token = ler(CHAVE_TOKEN);
  gravar(CHAVE_TOKEN, null);
  gravar(CHAVE_DONO, null);
  gravar(CHAVE_CONFERIDO, null);
  if (token) await removerAparelho(token).catch(() => {});
  try {
    const msg = await obterMensageria();
    if (msg) {
      const { deleteToken } = await import("firebase/messaging");
      await deleteToken(msg);
    }
  } catch (e) {
    capturarNoNavegador(e, "push.remover_token");
  }
}

/**
 * Confere o token deste aparelho (o Firebase troca de tempos em tempos e o
 * navegador pode renovar a inscrição). No máximo uma vez por dia, ou quando
 * o service worker avisar que a inscrição mudou.
 */
export async function conferirToken(forcar = false): Promise<void> {
  if (estadoAtual() !== "ativo") {
    // Permissão revogada nas configurações do navegador: o aparelho sai.
    if (suportaPush() && Notification.permission === "denied" && ler(CHAVE_TOKEN)) {
      const velho = ler(CHAVE_TOKEN)!;
      gravar(CHAVE_TOKEN, null);
      await removerAparelho(velho).catch(() => {});
    }
    return;
  }
  const ultima = Number(ler(CHAVE_CONFERIDO) ?? 0);
  if (!forcar && Date.now() - ultima < 86_400_000) return;
  try {
    const token = await pedirToken();
    if (token !== ler(CHAVE_TOKEN) || forcar) await guardarToken(token);
    else gravar(CHAVE_CONFERIDO, String(Date.now()));
  } catch (e) {
    capturarNoNavegador(e, "push.renovar_token");
  }
}

/** Ao sair da conta: este navegador deixa de receber avisos dela. */
export async function esquecerAparelhoAoSair(): Promise<void> {
  if (ler(CHAVE_TOKEN)) await desativarNesteAparelho();
}
