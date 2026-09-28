import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { entregarPushPendentes } from "@/lib/notificacoes/servidor";

/**
 * Processa a fila de push. Chamado pelo banco (pg_net, logo depois que uma
 * notificação com push é criada, e a cada minuto pelo pg_cron como rede de
 * segurança) — nunca pelo navegador.
 *
 * Não cria nem escolhe destinatário de nada: só entrega o que o banco já
 * decidiu. Mesmo assim exige o segredo (NOTIFICACOES_SEGREDO, ou o
 * CRON_SECRET da Vercel) em Authorization: Bearer; sem segredo configurado
 * o endpoint fica desligado.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: NextRequest): boolean {
  const segredos = [process.env.NOTIFICACOES_SEGREDO, process.env.CRON_SECRET].filter((s): s is string => !!s && s.length >= 24);
  if (segredos.length === 0) return false;
  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recebido);
  return segredos.some((s) => {
    const b = Buffer.from(s);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

async function processar(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const balanco = await entregarPushPendentes({ limite: 200 });
  return NextResponse.json({ ok: true, balanco });
}

export const POST = processar;
// Vercel Cron chama com GET
export const GET = processar;
