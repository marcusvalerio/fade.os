import { classificar, lerProblema, resumir, type ProblemaClassificado, type ResumoDeErros } from "@/lib/sentry-classificacao";

/**
 * Leitura do Sentry para o Admin > Saúde — só no servidor. O token
 * (SENTRY_API_TOKEN, escopo de leitura) nunca vai para o navegador: não
 * tem prefixo NEXT_PUBLIC_ e este módulo só é importado por Server
 * Components do /admin.
 *
 * Três estados, sempre ditos com todas as letras:
 *   nao_conectado — sem token configurado
 *   indisponivel  — a API respondeu erro ou não respondeu a tempo
 *   ok            — dados reais do projeto
 */

const API = process.env.SENTRY_API_URL || "https://us.sentry.io";
const ORG = process.env.SENTRY_ORG || "cortexos";
const PROJETO = process.env.SENTRY_PROJECT || "cortex-os";
const PROJETO_ID = process.env.SENTRY_PROJECT_ID || "4512159586779136";

export type AmbienteDoSentry = "production" | "preview" | "development";

export type LeituraDoSentry =
  | { estado: "nao_conectado" }
  | { estado: "indisponivel"; motivo: string }
  | {
      estado: "ok";
      ambiente: AmbienteDoSentry;
      problemas: ProblemaClassificado[];
      resumo: ResumoDeErros;
      porEmpresa: Record<string, number>;
      painel: string;
    };

async function chamar(caminho: string, token: string) {
  return fetch(`${API}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(6000),
  });
}

export async function lerErrosDoSentry(ambiente: AmbienteDoSentry = "production"): Promise<LeituraDoSentry> {
  const token = process.env.SENTRY_API_TOKEN;
  if (!token) return { estado: "nao_conectado" };

  try {
    const q = new URLSearchParams({ statsPeriod: "14d", query: "is:unresolved", environment: ambiente, limit: "25", sort: "date" });
    const r = await chamar(`/api/0/projects/${ORG}/${PROJETO}/issues/?${q}`, token);
    if (!r.ok) return { estado: "indisponivel", motivo: r.status === 401 || r.status === 403 ? "Token sem permissão de leitura." : `A API respondeu ${r.status}.` };
    const brutos = (await r.json()) as Record<string, unknown>[];
    const agora = Date.now();
    const problemas = brutos.map(lerProblema).filter((p): p is NonNullable<typeof p> => p !== null).map((p) => classificar(p, agora));

    // Erros por empresa (tag empresa_id posta pelo CORTEX) — opcional: se a
    // consulta falhar, a lista de problemas continua valendo.
    let porEmpresa: Record<string, number> = {};
    try {
      const e = new URLSearchParams({ dataset: "errors", statsPeriod: "30d", project: PROJETO_ID, environment: ambiente, query: "has:empresa_id", per_page: "100" });
      e.append("field", "empresa_id");
      e.append("field", "count()");
      const re = await chamar(`/api/0/organizations/${ORG}/events/?${e}`, token);
      if (re.ok) {
        const corpo = (await re.json()) as { data?: { empresa_id?: string; "count()"?: number }[] };
        porEmpresa = Object.fromEntries((corpo.data ?? []).filter((l) => l.empresa_id).map((l) => [String(l.empresa_id), Number(l["count()"] ?? 0)]));
      }
    } catch {
      porEmpresa = {};
    }

    return {
      estado: "ok",
      ambiente,
      problemas,
      resumo: resumir(problemas),
      porEmpresa,
      painel: `https://${ORG}.sentry.io/issues/?project=${PROJETO_ID}&environment=${ambiente}&query=is%3Aunresolved`,
    };
  } catch (erro) {
    return { estado: "indisponivel", motivo: erro instanceof Error && erro.name === "TimeoutError" ? "O Sentry não respondeu a tempo." : "Não foi possível falar com o Sentry." };
  }
}
