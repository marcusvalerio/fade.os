import { createAdminClient, ConfigurationError } from "@/lib/supabase/admin";
import { reportarErro } from "@/lib/observabilidade";
import { lerContaDeServico, enviarPush, ConfiguracaoFcmAusente } from "@/lib/notificacoes/fcm";
import { processarFila, type Balanco, type EntregaReservada } from "@/lib/notificacoes/fila";
import type { Publico, Prioridade } from "@/lib/notificacoes/catalogo";

/**
 * Serviço de notificações do CORTEX — lado do servidor. SÓ servidor: usa a
 * service role e a conta de serviço do Firebase.
 *
 * Quase todo aviso nasce no banco (triggers em
 * 20260930110000_notificacoes_eventos.sql), porque é lá que o evento
 * acontece — inclusive quando vem de uma RPC chamada direto do navegador.
 * Este módulo é a porta para o que nasce no servidor Next e para a entrega:
 *
 *   notificarUsuario / notificarGestores / notificarProfissional /
 *   notificarCliente  → notificar() no banco (confere público real,
 *                       preferência, deduplica, cria a entrega push)
 *   entregarPushPendentes → processa a fila e manda pelo FCM
 *
 * Comunicados do Admin (broadcast) têm porta própria, com autorização de
 * admin de plataforma: actions/notificacoes-admin.ts → admin_enviar_comunicado.
 */

export type NovaNotificacao = {
  tipo: string;
  titulo: string;
  corpo: string;
  url?: string | null;
  dados?: Record<string, unknown>;
  /** evita duplicar o mesmo evento (repetição, retry) */
  chave: string;
  prioridade?: Prioridade;
};

function relatar(erro: unknown, contexto: Record<string, string | number>) {
  const extra: Record<string, string | number> = { ...contexto };
  reportarErro(erro, String(contexto.operacao ?? "notificacoes"), extra);
}

async function chamar(fn: string, args: Record<string, unknown>): Promise<number> {
  try {
    const { data, error } = await createAdminClient().rpc(fn, args);
    if (error) throw error;
    return typeof data === "number" ? data : data ? 1 : 0;
  } catch (erro) {
    // Notificar nunca derruba a operação que causou o aviso.
    if (!(erro instanceof ConfigurationError)) relatar(erro, { operacao: "notificacao.criar", funcao: fn, tipo: String(args.p_tipo ?? "") });
    return 0;
  }
}

/** Uma pessoa, num público (e, se houver, numa empresa). */
export function notificarUsuario(userId: string, publico: Publico, empresaId: string | null, n: NovaNotificacao) {
  return chamar("notificar", {
    p_tipo: n.tipo, p_user: userId, p_company: empresaId, p_publico: publico, p_titulo: n.titulo, p_corpo: n.corpo,
    p_url: n.url ?? null, p_dados: n.dados ?? {}, p_chave: `${n.chave}:${userId}`, p_prioridade: n.prioridade ?? null,
  });
}

/** Dono e gerência da empresa (quem causou pode ser excluído). */
export function notificarGestores(empresaId: string, n: NovaNotificacao, excluir?: string | null) {
  return chamar("notificar_gestores", {
    p_company: empresaId, p_tipo: n.tipo, p_titulo: n.titulo, p_corpo: n.corpo, p_url: n.url ?? null,
    p_dados: n.dados ?? {}, p_chave: n.chave, p_excluir: excluir ?? null,
  });
}

export function notificarProfissional(profissionalId: string, n: NovaNotificacao, excluir?: string | null) {
  return chamar("notificar_profissional", {
    p_professional: profissionalId, p_tipo: n.tipo, p_titulo: n.titulo, p_corpo: n.corpo, p_url: n.url ?? null,
    p_dados: n.dados ?? {}, p_chave: n.chave, p_excluir: excluir ?? null,
  });
}

export function notificarCliente(clienteId: string, n: NovaNotificacao, excluir?: string | null) {
  return chamar("notificar_cliente", {
    p_client: clienteId, p_tipo: n.tipo, p_titulo: n.titulo, p_corpo: n.corpo, p_url: n.url ?? null,
    p_dados: n.dados ?? {}, p_chave: n.chave, p_excluir: excluir ?? null,
  });
}

/** O push está configurado neste ambiente? (sem dizer o valor de nada) */
export function estadoDoEnvioPush(): { configurado: boolean; motivo?: string } {
  try {
    return lerContaDeServico() ? { configurado: true } : { configurado: false, motivo: "conta de serviço do Firebase não configurada" };
  } catch (e) {
    return { configurado: false, motivo: (e as Error).message };
  }
}

// Um processamento por instância de cada vez, e no máximo um a cada poucos
// segundos quando o gatilho é o polling do sino.
let emAndamento: Promise<Balanco | null> | null = null;
let ultimoInicio = 0;

export async function entregarPushPendentes(opcoes: { limite?: number; intervaloMinimoMs?: number } = {}): Promise<Balanco | null> {
  if (emAndamento) return emAndamento;
  if (opcoes.intervaloMinimoMs && Date.now() - ultimoInicio < opcoes.intervaloMinimoMs) return null;
  ultimoInicio = Date.now();

  emAndamento = (async () => {
    let conta;
    try {
      conta = lerContaDeServico();
    } catch (e) {
      relatar(e, { operacao: "push.configuracao" });
      return null;
    }
    if (!conta) return null; // sem Firebase no servidor: as notificações ficam só na central
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return null;
    }
    return processarFila(
      {
        async reservar(limite) {
          const { data, error } = await admin.rpc("reservar_entregas_push", { p_limite: limite });
          if (error) throw error;
          return (data ?? []) as EntregaReservada[];
        },
        async registrar(entrega, status, erro) {
          const { error } = await admin.rpc("registrar_entrega_push", { p_entrega: entrega, p_status: status, p_erro: erro ?? null });
          if (error) relatar(error, { operacao: "push.registrar", status });
        },
        enviar: (m) => enviarPush(conta, m),
        relatar,
      },
      opcoes.limite ?? 100
    );
  })()
    .catch((e) => {
      if (!(e instanceof ConfiguracaoFcmAusente)) relatar(e, { operacao: "push.fila" });
      return null;
    })
    .finally(() => {
      emAndamento = null;
    });
  return emAndamento;
}
