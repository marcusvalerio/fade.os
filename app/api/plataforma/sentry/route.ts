import { NextResponse, type NextRequest } from "next/server";
import { assinaturaValida, interpretarWebhookDoSentry } from "@/lib/plataforma/sentry-webhook";
import { notificarPlataforma } from "@/lib/notificacoes/servidor";

/**
 * Recebe alertas do Sentry (integração interna com webhook) e avisa os
 * platform_admin quando há incidente crítico. Exige a assinatura do Sentry
 * (SENTRY_WEBHOOK_SECRET = "Client Secret" da integração); sem o segredo
 * configurado o endpoint fica desligado. Ver docs/notificacoes.md.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const corpo = await req.text();
  if (corpo.length > 512_000) return NextResponse.json({ ok: false }, { status: 413 });
  if (!assinaturaValida(corpo, req.headers.get("sentry-hook-signature"), process.env.SENTRY_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const incidente = interpretarWebhookDoSentry(req.headers.get("sentry-hook-resource"), payload, dia);
  if (!incidente) return NextResponse.json({ ok: true, notificado: false });
  const n = await notificarPlataforma({
    tipo: "plataforma.incidente",
    titulo: incidente.titulo,
    corpo: incidente.corpo,
    url: "/admin/sistema#erros",
    dados: incidente.dados,
    chave: incidente.chave,
  });
  return NextResponse.json({ ok: true, notificado: n > 0 });
}
