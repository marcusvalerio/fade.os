import type { MensagemPush, ResultadoDoEnvio } from "./fcm.ts";

/**
 * Processa a fila de push: reserva entregas pendentes no banco, envia cada
 * uma e registra o resultado. Tudo que toca o mundo (banco, FCM, Sentry)
 * entra por parâmetro — o arquivo não importa nada do projeto e é testado
 * com dublês (fila.test.ts).
 *
 * Garantias:
 *   - a reserva usa FOR UPDATE SKIP LOCKED: dois processamentos ao mesmo
 *     tempo (after() de uma ação + cron) não mandam a mesma entrega;
 *   - token recusado pelo FCM invalida o aparelho e as outras entregas
 *     pendentes dele (no banco, registrar_entrega_push);
 *   - falha transitória volta para 'pendente' (até 5 tentativas, 1 dia);
 *   - configuração ausente ou recusada para o lote inteiro sem gastar
 *     tentativas: as entregas voltam para 'pendente' e o Sentry recebe um
 *     aviso só.
 */

export type EntregaReservada = {
  entrega_id: string;
  notificacao_id: string;
  token: string;
  titulo: string;
  corpo: string;
  url: string | null;
  prioridade: string;
  tipo: string;
  categoria: string;
  tentativas: number;
};

export type StatusRegistrado = "enviada" | "falhou" | "token_invalido" | "pendente";

export type DependenciasDaFila = {
  reservar: (limite: number) => Promise<EntregaReservada[]>;
  registrar: (entregaId: string, status: StatusRegistrado, erro?: string) => Promise<void>;
  enviar: (m: MensagemPush) => Promise<ResultadoDoEnvio>;
  relatar: (erro: unknown, contexto: Record<string, string | number>) => void;
};

export type Balanco = { reservadas: number; enviadas: number; invalidas: number; falhas: number; adiadas: number; configuracao: boolean };

const MAXIMO_DE_TENTATIVAS = 5;

export async function processarFila(dep: DependenciasDaFila, limite = 100): Promise<Balanco> {
  const balanco: Balanco = { reservadas: 0, enviadas: 0, invalidas: 0, falhas: 0, adiadas: 0, configuracao: false };
  const lote = await dep.reservar(limite);
  balanco.reservadas = lote.length;

  for (let i = 0; i < lote.length; i++) {
    const e = lote[i];
    let r: ResultadoDoEnvio;
    try {
      r = await dep.enviar({
        token: e.token,
        notificacaoId: e.notificacao_id,
        titulo: e.titulo,
        corpo: e.corpo,
        url: e.url,
        prioridade: e.prioridade,
        tipo: e.tipo,
        categoria: e.categoria,
      });
    } catch (erro) {
      // Configuração (conta de serviço ausente/ilegível/recusada): nada do
      // lote vai sair. Devolve tudo para a fila e avisa uma vez.
      if ((erro as Error)?.name === "ConfiguracaoFcmAusente") {
        balanco.configuracao = true;
        dep.relatar(erro, { operacao: "push.configuracao", pendentes: lote.length - i });
        for (const resto of lote.slice(i)) await dep.registrar(resto.entrega_id, "pendente", "push não configurado");
        balanco.adiadas += lote.length - i;
        return balanco;
      }
      r = { status: "tentar_de_novo", erro: `inesperado: ${(erro as Error)?.name ?? "erro"}` };
      dep.relatar(erro, { operacao: "push.envio", tipo: e.tipo, categoria: e.categoria });
    }

    if (r.status === "enviada") {
      await dep.registrar(e.entrega_id, "enviada");
      balanco.enviadas++;
    } else if (r.status === "token_invalido") {
      await dep.registrar(e.entrega_id, "token_invalido", r.erro);
      balanco.invalidas++;
    } else if (r.status === "tentar_de_novo" && e.tentativas < MAXIMO_DE_TENTATIVAS) {
      await dep.registrar(e.entrega_id, "pendente", r.erro);
      balanco.adiadas++;
    } else {
      await dep.registrar(e.entrega_id, "falhou", r.erro);
      balanco.falhas++;
      if (r.status === "falhou" && r.configuracao) balanco.configuracao = true;
      dep.relatar(new Error(`Push não entregue: ${r.erro}`), { operacao: "push.envio", tipo: e.tipo, categoria: e.categoria, tentativas: e.tentativas });
    }
  }
  return balanco;
}
