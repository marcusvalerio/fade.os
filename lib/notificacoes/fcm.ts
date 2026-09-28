import { createSign, createPrivateKey } from "node:crypto";

/**
 * Envio pelo Firebase Cloud Messaging (API HTTP v1), só no servidor.
 *
 * Sem firebase-admin: o SDK inteiro (~10 MB instalado) serviria para uma
 * chamada HTTP. Aqui a conta de serviço assina um JWT (RS256, node:crypto),
 * troca por um access token do Google (cacheado até perto de expirar) e
 * manda a mensagem para cada token.
 *
 * A conta de serviço vem de variável de ambiente PRIVADA da Vercel
 * (FIREBASE_SERVICE_ACCOUNT com o JSON inteiro, ou FIREBASE_PROJECT_ID +
 * FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY). Nunca NEXT_PUBLIC_, nunca
 * no código, nunca em log ou Sentry: os erros daqui citam o que falta,
 * não o valor.
 *
 * Sem imports do projeto: testável no runner do Node com fetch simulado.
 */

export type ContaDeServico = { projectId: string; clientEmail: string; privateKey: string };

export class ConfiguracaoFcmAusente extends Error {
  constructor(motivo: string) {
    super(`Envio de push não configurado: ${motivo}`);
    this.name = "ConfiguracaoFcmAusente";
  }
}

/** Lê a conta de serviço do ambiente; null quando não configurada. */
export function lerContaDeServico(env: Record<string, string | undefined> = process.env): ContaDeServico | null {
  const json = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (json) {
    let c: { project_id?: string; client_email?: string; private_key?: string };
    try {
      c = JSON.parse(json);
    } catch {
      throw new ConfiguracaoFcmAusente("FIREBASE_SERVICE_ACCOUNT não é um JSON válido");
    }
    if (!c.project_id || !c.client_email || !c.private_key) {
      throw new ConfiguracaoFcmAusente("FIREBASE_SERVICE_ACCOUNT sem project_id, client_email ou private_key");
    }
    return { projectId: c.project_id, clientEmail: c.client_email, privateKey: c.private_key };
  }
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  // Na Vercel a chave costuma chegar com "\n" literal no lugar das quebras.
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!projectId && !clientEmail && !privateKey) return null;
  if (!projectId || !clientEmail || !privateKey) {
    const faltando = [!projectId && "FIREBASE_PROJECT_ID", !clientEmail && "FIREBASE_CLIENT_EMAIL", !privateKey && "FIREBASE_PRIVATE_KEY"].filter(Boolean);
    throw new ConfiguracaoFcmAusente(`faltando ${faltando.join(", ")}`);
  }
  return { projectId, clientEmail, privateKey };
}

function base64url(v: Buffer | string) {
  return Buffer.from(v).toString("base64url");
}

export function assinarJwt(conta: ContaDeServico, agoraSeg = Math.floor(Date.now() / 1000)): string {
  let chave;
  try {
    chave = createPrivateKey(conta.privateKey);
  } catch {
    throw new ConfiguracaoFcmAusente("a chave privada da conta de serviço não pôde ser lida");
  }
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      iss: conta.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agoraSeg,
      exp: agoraSeg + 3600,
    })
  );
  const assinador = createSign("RSA-SHA256");
  assinador.update(`${cabecalho}.${corpo}`);
  return `${cabecalho}.${corpo}.${base64url(assinador.sign(chave))}`;
}

type Fetch = typeof fetch;
let tokenEmCache: { valor: string; expiraEm: number; email: string } | null = null;

export function limparCacheDoToken() {
  tokenEmCache = null;
}

export async function tokenDeAcesso(conta: ContaDeServico, f: Fetch = fetch, agora = Date.now()): Promise<string> {
  if (tokenEmCache && tokenEmCache.email === conta.clientEmail && tokenEmCache.expiraEm - 60_000 > agora) {
    return tokenEmCache.valor;
  }
  const resposta = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assinarJwt(conta, Math.floor(agora / 1000)),
    }),
  });
  if (!resposta.ok) {
    // O corpo do Google não traz segredo, mas pode ser longo; basta o código.
    throw new ConfiguracaoFcmAusente(`o Google recusou a conta de serviço (HTTP ${resposta.status})`);
  }
  const j = (await resposta.json()) as { access_token: string; expires_in: number };
  tokenEmCache = { valor: j.access_token, expiraEm: agora + j.expires_in * 1000, email: conta.clientEmail };
  return j.access_token;
}

export type MensagemPush = {
  token: string;
  notificacaoId: string;
  titulo: string;
  corpo: string;
  url: string | null;
  prioridade: string;
  tipo: string;
  categoria: string;
};

/**
 * Mensagem só de dados: quem desenha a notificação é o nosso service worker
 * (mesmo visual e mesmo clique em qualquer navegador), e o clique passa por
 * /notificacoes/abrir/<id>, que confere a dona e marca como aberta.
 */
export function montarMensagem(m: MensagemPush) {
  const urgente = m.prioridade === "critical" || m.prioridade === "important";
  return {
    message: {
      token: m.token,
      data: {
        notificacao_id: m.notificacaoId,
        titulo: m.titulo,
        corpo: m.corpo,
        url: m.url ?? "",
        prioridade: m.prioridade,
        tipo: m.tipo,
        categoria: m.categoria,
      },
      webpush: {
        headers: { Urgency: urgente ? "high" : "normal", TTL: urgente ? "86400" : "21600" },
      },
    },
  };
}

export type ResultadoDoEnvio =
  | { status: "enviada" }
  | { status: "token_invalido"; erro: string }
  // pode dar certo numa próxima tentativa
  | { status: "tentar_de_novo"; erro: string }
  // não adianta repetir (mensagem ou configuração com problema)
  | { status: "falhou"; erro: string; configuracao?: boolean };

type ErroFcm = { error?: { code?: number; status?: string; message?: string; details?: { "@type"?: string; errorCode?: string }[] } };

/** Traduz a resposta do FCM no que fazer com a entrega. */
export function classificarResposta(httpStatus: number, corpo: ErroFcm | null): ResultadoDoEnvio {
  if (httpStatus >= 200 && httpStatus < 300) return { status: "enviada" };
  const e = corpo?.error;
  const codigoFcm = e?.details?.find((d) => d.errorCode)?.errorCode;
  const status = e?.status ?? "";
  const resumo = `${httpStatus} ${codigoFcm ?? status}`.trim();

  if (codigoFcm === "UNREGISTERED" || httpStatus === 404) return { status: "token_invalido", erro: resumo };
  if (codigoFcm === "SENDER_ID_MISMATCH") return { status: "token_invalido", erro: resumo };
  if (codigoFcm === "INVALID_ARGUMENT" || status === "INVALID_ARGUMENT") {
    // O FCM usa INVALID_ARGUMENT também para token malformado.
    if (/registration token/i.test(e?.message ?? "")) return { status: "token_invalido", erro: resumo };
    return { status: "falhou", erro: resumo };
  }
  if (httpStatus === 401 || httpStatus === 403 || codigoFcm === "THIRD_PARTY_AUTH_ERROR") {
    return { status: "falhou", erro: resumo, configuracao: true };
  }
  if (httpStatus === 429 || httpStatus >= 500 || codigoFcm === "QUOTA_EXCEEDED" || codigoFcm === "UNAVAILABLE" || codigoFcm === "INTERNAL") {
    return { status: "tentar_de_novo", erro: resumo };
  }
  return { status: "falhou", erro: resumo };
}

export async function enviarPush(conta: ContaDeServico, m: MensagemPush, f: Fetch = fetch): Promise<ResultadoDoEnvio> {
  const token = await tokenDeAcesso(conta, f);
  let resposta: Response;
  try {
    resposta = await f(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(conta.projectId)}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(montarMensagem(m)),
    });
  } catch (e) {
    return { status: "tentar_de_novo", erro: `rede: ${(e as Error).name}` };
  }
  if (resposta.status === 401) limparCacheDoToken();
  const corpo = resposta.ok ? null : ((await resposta.json().catch(() => null)) as ErroFcm | null);
  return classificarResposta(resposta.status, corpo);
}
