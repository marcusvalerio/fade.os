import { pareceChaveDeServico } from "@/lib/supabase/service-key";
import { estadoDoEnvioPush } from "@/lib/notificacoes/servidor";
import type { SaudeDasNotificacoes } from "@/lib/admin";
import type { HealthStatus } from "@/app/admin/StatusIndicator";

/**
 * Estado das integrações deste ambiente, para Saúde → Integrações. Só
 * servidor. Diz se cada peça está configurada e com forma válida — NUNCA o
 * valor de nada (nem prefixo de chave). "Configurado" não prova que
 * funciona: a prova é o envio/uso real, medido nas outras seções.
 */
export type Integracao = { nome: string; status: HealthStatus; detalhe: string; efeito?: string };

const tem = (v: string | undefined, min = 1) => typeof v === "string" && v.trim().length >= min;

export function integracoesDoAmbiente(saude: SaudeDasNotificacoes | null): Integracao[] {
  const env = process.env;
  const firebaseWeb = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_VAPID_KEY"];
  const faltandoWeb = firebaseWeb.filter((k) => !tem(env[k]));
  const push = estadoDoEnvioPush();
  const erros = saude?.despertar.erros_1h ?? null;

  return [
    {
      nome: "Supabase · chave de serviço",
      status: pareceChaveDeServico(env.SUPABASE_SERVICE_ROLE_KEY ?? "") ? "operational" : "down",
      detalhe: pareceChaveDeServico(env.SUPABASE_SERVICE_ROLE_KEY ?? "") ? "Presente, com formato válido." : "Ausente ou com formato inválido neste ambiente.",
      efeito: "Sem ela: acesso de profissionais, aprovação de Beta e envio de push não funcionam.",
    },
    {
      nome: "Firebase · navegador",
      status: faltandoWeb.length === 0 ? "operational" : "not_connected",
      detalhe: faltandoWeb.length === 0 ? "Configuração pública completa (inclui VAPID)." : `${faltandoWeb.length} de ${firebaseWeb.length} variáveis públicas faltando.`,
      efeito: "Sem ela: ninguém consegue ativar o push no aparelho; a central continua funcionando.",
    },
    {
      nome: "Firebase · servidor (FCM)",
      status: push.configurado ? "operational" : "not_connected",
      detalhe: push.configurado ? "Conta de serviço presente e legível." : "Conta de serviço ausente ou ilegível.",
      efeito: "Sem ela: o push fica na fila; se ficar preso, o Admin recebe um aviso.",
    },
    {
      nome: "Despertar do envio (banco → servidor)",
      status: !saude ? "unknown" : !saude.despertar_configurado ? "not_connected" : erros && erros > 0 ? "degraded" : "operational",
      detalhe: !saude
        ? "Não foi possível ler."
        : !saude.despertar_configurado
          ? "Endereço/segredo não cadastrados no Vault. O envio acontece quando alguém usa o sino."
          : `${saude.despertar.chamadas_1h ?? 0} chamadas na última hora, ${erros ?? 0} com erro.`,
    },
    {
      nome: "Segredo do processador de push",
      status: tem(env.NOTIFICACOES_SEGREDO, 24) || tem(env.CRON_SECRET, 24) ? "operational" : "not_connected",
      detalhe: tem(env.NOTIFICACOES_SEGREDO, 24) || tem(env.CRON_SECRET, 24) ? "Presente." : "Ausente: /api/notificacoes/processar fica desligado.",
    },
    {
      nome: "Sentry · captura de erros",
      status: tem(env.NEXT_PUBLIC_SENTRY_DSN) ? "operational" : "not_connected",
      detalhe: tem(env.NEXT_PUBLIC_SENTRY_DSN) ? "DSN presente." : "DSN ausente: erros não são registrados.",
    },
    {
      nome: "Sentry · leitura no Admin",
      status: tem(env.SENTRY_API_TOKEN) ? "operational" : "not_connected",
      detalhe: tem(env.SENTRY_API_TOKEN) ? "Token de leitura presente." : "Sem SENTRY_API_TOKEN: a lista de erros não aparece aqui.",
    },
    {
      nome: "Sentry · incidentes críticos → Admin",
      status: tem(env.SENTRY_WEBHOOK_SECRET, 16) ? "operational" : "not_connected",
      detalhe: tem(env.SENTRY_WEBHOOK_SECRET, 16)
        ? "Webhook assinado ativo em /api/plataforma/sentry."
        : "Sem SENTRY_WEBHOOK_SECRET: alertas críticos do Sentry não viram aviso no sino.",
    },
  ];
}
