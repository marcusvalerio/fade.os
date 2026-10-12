/**
 * Pilotos — leitura dos retratos diários (piloto_snapshot.metricas, versão 1)
 * e as contas que a tela faz em cima deles. Só informação para o Admin:
 * nada aqui notifica ninguém.
 *
 * Sem imports: roda no servidor e no runner de testes.
 */

export type StatusDoPiloto = "planejado" | "ativo" | "encerrado" | "cancelado";

export type UsoDoUsuarioNoDia = {
  user_id: string;
  papel: string;
  professional_id: string | null;
  profissional: string | null;
  ultimo_acesso: string | null;
  dias_sem_acesso: number | null;
  horas_ativas: number;
  acoes: number;
  ativo: boolean;
};

export type MetricasDoDia = {
  versao: number;
  dia: string;
  janela: { inicio: string; fim: string; estado_em: string };
  usuarios: {
    total: number;
    ativos: number;
    nunca_entraram: number;
    sem_acesso_7: number;
    sem_acesso_10: number;
    ultimo_acesso: string | null;
    por_usuario: UsoDoUsuarioNoDia[];
  };
  profissionais: { cadastrados_ativos: number; com_login: number; com_login_ativos_no_dia: number; atendendo_no_dia: number };
  clientes: { total: number; novos: number; contas_total: number; contas_novas: number };
  agendamentos: { criados: number; para_o_dia: number; realizados: number; cancelados: number; nao_compareceu: number; passados_sem_fechamento: number };
  atendimentos: { abertos: number; concluidos: number; cancelados: number; em_andamento_24h: number };
  vendas: {
    concluidas: number;
    valor: number;
    balcao: number;
    canceladas: number;
    valor_cancelado: number;
    por_metodo: Record<string, number>;
    estornos: number;
    valor_estornado: number;
  };
  caixa: { abertos: number; fechados: number; com_diferenca: number; diferenca_total: number; abertos_agora: number };
  comissoes: { geradas: number; valor_gerado: number; pagas: number; valor_pago: number; revertidas: number; a_pagar_total: number };
  estoque: { movimentacoes: number; por_tipo: Record<string, number>; abaixo_do_minimo: number; negativos: number };
  financeiro_manual: { lancamentos: number; receitas: number; despesas: number };
  notificacoes: { geradas: number; lidas: number; abertas: number; push: Record<string, number> };
  modulos: Record<string, number>;
  modulos_usados: number;
  operacoes: number;
  horas: number[];
  horas_sessao: number[];
  incidentes: { avisos_plataforma: number; jobs_com_falha: number; push_falhas: number };
  acumulado: {
    clientes: number;
    agendamentos: number;
    atendimentos: number;
    vendas: number;
    valor_vendido: number;
    comissoes: number;
    movimentacoes_estoque: number;
    notificacoes: number;
  };
  inatividade: { sem_uso_no_dia: boolean; ultima_operacao: string | null; dias_sem_operacao: number | null; dias_sem_acesso: number | null };
  falhas: {
    vendas_canceladas: number;
    estornos: number;
    caixas_com_diferenca: number;
    atendimentos_presos: number;
    agendamentos_sem_fechamento: number;
    estoque_negativo: number;
    push_falhas: number;
    jobs_com_falha: number;
  };
};

export type SnapshotDoPiloto = {
  dia: string;
  dia_do_piloto: number;
  final: boolean;
  atrasado: boolean;
  capturado_em: string;
  metricas: MetricasDoDia;
};

const DIA_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const somarDias = (iso: string, n: number) => new Date(utc(iso) + n * DIA_MS).toISOString().slice(0, 10);

export type FaseDoPiloto = "antes" | "dia0" | "andamento" | "depois";

/** "Dia X/N" a partir das datas (todas YYYY-MM-DD em São Paulo). */
export function diaDoPiloto(inicio: string, fim: string, hoje: string): { dia: number; total: number; fase: FaseDoPiloto } {
  const total = Math.round((utc(fim) - utc(inicio)) / DIA_MS) + 1;
  const dia = Math.round((utc(hoje) - utc(inicio)) / DIA_MS) + 1;
  if (dia < 0) return { dia: 0, total, fase: "antes" };
  if (dia === 0) return { dia: 0, total, fase: "dia0" };
  if (dia > total) return { dia: total, total, fase: "depois" };
  return { dia, total, fase: "andamento" };
}

export function rotuloDoDia(n: number, total: number) {
  return n === 0 ? "Dia 0 (base)" : `Dia ${n}/${total}`;
}

/** Variação contra uma referência; null quando não há base para comparar. */
export function variacao(atual: number, anterior: number | null | undefined): { delta: number; pct: number | null } | null {
  if (anterior === null || anterior === undefined || !Number.isFinite(anterior)) return null;
  const delta = atual - anterior;
  return { delta, pct: anterior === 0 ? null : Math.round((delta / anterior) * 100) };
}

/** Média de um indicador nos dias do piloto ANTERIORES ao dia dado (Dia 0 fica fora: é base). */
export function mediaAnterior(snaps: SnapshotDoPiloto[], dia: string, ler: (m: MetricasDoDia) => number): number | null {
  const anteriores = snaps.filter((s) => s.dia < dia && s.dia_do_piloto >= 1);
  if (anteriores.length === 0) return null;
  return anteriores.reduce((a, s) => a + ler(s.metricas), 0) / anteriores.length;
}

/** Diferença de um acumulado contra o Dia 0: o que aconteceu DURANTE o piloto. */
export function desdeODiaZero(snaps: SnapshotDoPiloto[], ler: (m: MetricasDoDia) => number): number | null {
  const base = snaps.find((s) => s.dia_do_piloto === 0);
  const ultimo = [...snaps].sort((a, b) => a.dia.localeCompare(b.dia)).at(-1);
  if (!base || !ultimo || ultimo === base) return null;
  return ler(ultimo.metricas) - ler(base.metricas);
}

/** Soma de um indicador diário nos dias do piloto (1..N), sem o Dia 0. */
export function somaNoPiloto(snaps: SnapshotDoPiloto[], ler: (m: MetricasDoDia) => number): number {
  return snaps.filter((s) => s.dia_do_piloto >= 1).reduce((a, s) => a + ler(s.metricas), 0);
}

/** Distribuição por hora somada nos dias do piloto (sem o Dia 0). */
export function horasNoPiloto(snaps: SnapshotDoPiloto[], campo: "horas" | "horas_sessao"): number[] {
  const total = Array.from({ length: 24 }, () => 0);
  for (const s of snaps) {
    if (s.dia_do_piloto < 1) continue;
    (s.metricas[campo] ?? []).forEach((n, h) => {
      if (h < 24) total[h] += Number(n) || 0;
    });
  }
  return total;
}

/** Módulos somados nos dias do piloto, do mais usado ao menos. */
export function modulosNoPiloto(snaps: SnapshotDoPiloto[]): { modulo: string; registros: number; dias: number }[] {
  const mapa = new Map<string, { registros: number; dias: number }>();
  for (const s of snaps) {
    if (s.dia_do_piloto < 1) continue;
    for (const [m, n] of Object.entries(s.metricas.modulos ?? {})) {
      const atual = mapa.get(m) ?? { registros: 0, dias: 0 };
      mapa.set(m, { registros: atual.registros + Number(n), dias: atual.dias + (Number(n) > 0 ? 1 : 0) });
    }
  }
  return [...mapa.entries()].map(([modulo, v]) => ({ modulo, ...v })).sort((a, b) => b.registros - a.registros);
}

/** Dias sem nenhum uso (sem acesso e sem operação) no período, e a maior sequência. */
export function diasSemUso(snaps: SnapshotDoPiloto[]): { dias: number; maiorSequencia: number } {
  const ordenados = snaps.filter((s) => s.dia_do_piloto >= 1).sort((a, b) => a.dia.localeCompare(b.dia));
  let dias = 0;
  let seq = 0;
  let maior = 0;
  for (const s of ordenados) {
    if (s.metricas.inatividade?.sem_uso_no_dia) {
      dias += 1;
      seq += 1;
      maior = Math.max(maior, seq);
    } else seq = 0;
  }
  return { dias, maiorSequencia: maior };
}

/** Linha do tempo esperada: Dia 0..N, marcando os que já têm retrato. */
export function linhaDoTempo(inicio: string, fim: string, snaps: SnapshotDoPiloto[]) {
  const porDia = new Map(snaps.map((s) => [s.dia, s]));
  const total = Math.round((utc(fim) - utc(inicio)) / DIA_MS) + 1;
  return Array.from({ length: total + 1 }, (_, i) => {
    const dia = somarDias(inicio, i - 1);
    return { dia, n: i, snapshot: porDia.get(dia) ?? null };
  });
}

export const TOTAL_DE_FALHAS = (f: MetricasDoDia["falhas"]) =>
  f.vendas_canceladas + f.estornos + f.caixas_com_diferenca + f.push_falhas + f.jobs_com_falha;
