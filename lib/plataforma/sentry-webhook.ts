import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook do Sentry → incidente crítico no Admin.
 *
 * Só vira notificação o que o Sentry já classificou como crítico:
 *   * alerta de evento ("event_alert") disparado por uma regra de alerta em
 *     produção — quem decide o que é crítico é a regra no Sentry, não este
 *     código; erros comuns sem regra ficam no dashboard (Saúde → Erros);
 *   * alerta de métrica ("metric_alert") com action "critical".
 * Resolvido/aviso/instalação/issue comum: ignorado.
 *
 * A chave é por issue (ou alerta) e por dia: a mesma falha não repete o
 * push a cada evento. O corpo leva título e ambiente — nunca mensagem de
 * exceção, usuário, e-mail ou payload.
 *
 * Sem imports do Next: roda no teste.
 */

export type IncidenteDoSentry = {
  titulo: string;
  corpo: string;
  chave: string;
  dados: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Assinatura: HMAC-SHA256 (hex) do corpo cru com o segredo da integração. */
export function assinaturaValida(corpo: string, assinatura: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < 16 || !assinatura) return false;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(corpo, "utf8").digest("hex"));
  const recebido = Buffer.from(assinatura.trim());
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

function texto(v: unknown, max = 90): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function idSeguro(v: unknown): string {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : "";
}

function tag(tags: unknown, nome: string): string {
  if (!Array.isArray(tags)) return "";
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === nome && typeof t[1] === "string") return t[1];
    if (t && typeof t === "object" && (t as { key?: unknown }).key === nome) return String((t as { value?: unknown }).value ?? "");
  }
  return "";
}

export function interpretarWebhookDoSentry(recurso: string | null, payload: unknown, dia: string): IncidenteDoSentry | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { action?: unknown; data?: Record<string, unknown> };
  const data = (p.data ?? {}) as Record<string, unknown>;

  if (recurso === "event_alert" && p.action === "triggered") {
    const evento = (data.event ?? {}) as Record<string, unknown>;
    const ambiente = texto(evento.environment, 30) || tag(evento.tags, "environment");
    if (ambiente && ambiente !== "production") return null;
    const issue = idSeguro(evento.issue_id) || idSeguro(evento.event_id);
    if (!issue) return null;
    const regra = texto(data.triggered_rule, 60);
    const titulo = texto(evento.title) || "Erro em produção";
    const empresa = tag(evento.tags, "empresa_id");
    return {
      titulo: "Incidente crítico em produção",
      corpo: `${titulo}${regra ? ` · regra “${regra}”` : ""}. Veja frequência e quem foi afetado.`,
      chave: `sentry.issue:${issue}:${dia}`,
      dados: { origem: "sentry", issue, ...(UUID.test(empresa) ? { empresa } : {}) },
    };
  }

  if (recurso === "metric_alert" && p.action === "critical") {
    const alerta = (data.metric_alert ?? {}) as Record<string, unknown>;
    const id = idSeguro(alerta.id);
    if (!id) return null;
    const regra = (alerta.alert_rule ?? {}) as Record<string, unknown>;
    const nome = texto(data.description_title) || texto(regra.name) || "Alerta de métrica";
    return {
      titulo: "Alerta crítico da plataforma",
      corpo: `${nome}. O limite crítico configurado no Sentry foi atingido.`,
      chave: `sentry.metrica:${id}:${dia}`,
      dados: { origem: "sentry", alerta: id },
    };
  }

  return null;
}
