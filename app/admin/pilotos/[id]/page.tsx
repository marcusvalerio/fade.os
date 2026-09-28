import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { detalheDoPiloto, haQuanto, MODULOS_DA_MATRIZ } from "@/lib/admin";
import {
  diaDoPiloto,
  rotuloDoDia,
  variacao,
  mediaAnterior,
  desdeODiaZero,
  somaNoPiloto,
  horasNoPiloto,
  modulosNoPiloto,
  diasSemUso,
  linhaDoTempo,
  TOTAL_DE_FALHAS,
  type MetricasDoDia,
  type SnapshotDoPiloto,
} from "@/lib/piloto";
import { nivelDeInatividade } from "@/lib/admin-saude";
import { lerErrosDoSentry } from "@/lib/sentry-leitura";
import { formatCurrency } from "@/lib/format";
import { AcoesDoPiloto } from "../AcoesDoPiloto";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Piloto" };

const dataCurta = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const numero = (n: number) => n.toLocaleString("pt-BR");
const PAPEL: Record<string, string> = { owner: "Dono", admin: "Gerente", staff: "Equipe", profissional: "Profissional" };

type Indicador = {
  rotulo: string;
  valor: string;
  atual: number | null;
  nota?: string;
  tom?: "atencao" | "alerta";
  moeda?: boolean;
};

/**
 * Piloto — Dia X/N, os indicadores do dia (com a comparação contra o dia
 * anterior e a média dos dias anteriores), a evolução desde o Dia 0 e o
 * uso por pessoa. Tudo vem dos retratos gravados pelo banco; só "Erros"
 * (Sentry) é lido na hora.
 */
export default async function PilotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d, erros] = await Promise.all([detalheDoPiloto(id), lerErrosDoSentry("production")]);
  if (!d) notFound();

  const { piloto, snapshots, hoje } = d;
  const fase = diaDoPiloto(piloto.inicio, piloto.fim, hoje);
  const aberto = piloto.status === "planejado" || piloto.status === "ativo";
  const ordenados = [...snapshots].sort((a, b) => a.dia.localeCompare(b.dia));
  const atual = ordenados.at(-1) ?? null;
  const anterior = ordenados.length > 1 ? ordenados.at(-2)! : null;
  const m = atual?.metricas ?? null;
  const errosDaEmpresa = erros.estado === "ok" ? (erros.porEmpresa[piloto.company_id] ?? 0) : null;
  const semUso = diasSemUso(ordenados);
  const emailDe = new Map(d.usuarios.map((u) => [u.user_id, u]));

  const comparar = (ler: (x: MetricasDoDia) => number) => {
    if (!atual) return { dia: null, media: null };
    return {
      dia: anterior ? variacao(ler(atual.metricas), ler(anterior.metricas)) : null,
      media: (() => {
        const med = mediaAnterior(ordenados, atual.dia, ler);
        return med === null ? null : variacao(ler(atual.metricas), med);
      })(),
    };
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 animate-rise-in">
        <div className="min-w-0">
          <p className="eyebrow">
            <Link href="/admin/pilotos" className="hover:underline underline-offset-4">
              Pilotos
            </Link>
          </p>
          <h1 className="text-page-title text-foreground mt-2.5">{piloto.nome}</h1>
          <p className="font-subtitle text-subtitle text-muted mt-2.5">
            <Link href={`/admin/empresas/${piloto.company_id}`} className="underline-offset-4 hover:underline hover:text-foreground">
              {piloto.empresa}
            </Link>{" "}
            · {dataCurta(piloto.inicio)} a {dataCurta(piloto.fim)} · base no Dia 0 ({dataCurta(ordenados[0]?.dia ?? piloto.inicio)})
          </p>
          {piloto.objetivo && <p className="text-caption text-muted mt-1 max-w-prose">{piloto.objetivo}</p>}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3">
          <p className="numero text-metric-sm text-foreground">
            {aberto ? rotuloDoDia(fase.dia, fase.total) : piloto.status === "cancelado" ? "Cancelado" : "Encerrado"}
          </p>
          {aberto && <AcoesDoPiloto id={piloto.id} />}
        </div>
      </header>

      {!aberto && piloto.motivo_encerramento && (
        <p className="text-caption text-muted">
          {piloto.status === "cancelado" ? "Cancelado" : "Encerrado"} {haQuanto(piloto.encerrado_em)} · {piloto.motivo_encerramento}
        </p>
      )}

      {!m ? (
        <div className="painel p-6">
          <p className="text-body-sm text-muted">
            Nenhum retrato ainda. O Dia 0 é registrado na véspera do início e a coleta roda de hora em hora.
          </p>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------ Indicadores do dia */}
          <section aria-labelledby="dia-titulo" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="dia-titulo" className="text-section-title text-foreground">
                {rotuloDoDia(atual!.dia_do_piloto, fase.total)} · {dataCurta(atual!.dia)}
              </h2>
              <p className="text-caption text-muted">
                {atual!.final ? "dia fechado" : "parcial"} · atualizado {haQuanto(atual!.capturado_em)}
                {anterior ? ` · comparado com ${dataCurta(anterior.dia)} e com a média dos dias anteriores` : ""}
              </p>
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-px bg-border border border-border rounded-md overflow-hidden">
              <Cartao
                i={{
                  rotulo: "Último acesso",
                  valor: haQuanto(m.usuarios.ultimo_acesso),
                  atual: null,
                  nota: m.inatividade.dias_sem_acesso === null ? "ninguém entrou" : `${m.inatividade.dias_sem_acesso} dias sem acesso`,
                  tom: (m.inatividade.dias_sem_acesso ?? 0) >= 10 ? "alerta" : (m.inatividade.dias_sem_acesso ?? 0) >= 7 ? "atencao" : undefined,
                }}
              />
              <Cartao i={{ rotulo: "Usuários ativos", valor: `${m.usuarios.ativos}/${m.usuarios.total}`, atual: m.usuarios.ativos }} c={comparar((x) => x.usuarios.ativos)} />
              <Cartao
                i={{ rotulo: "Agendamentos criados", valor: numero(m.agendamentos.criados), atual: m.agendamentos.criados, nota: `${m.agendamentos.realizados} realizados · ${m.agendamentos.cancelados} cancelados` }}
                c={comparar((x) => x.agendamentos.criados)}
              />
              <Cartao
                i={{ rotulo: "Atendimentos concluídos", valor: numero(m.atendimentos.concluidos), atual: m.atendimentos.concluidos, nota: `${m.atendimentos.abertos} abertos no dia` }}
                c={comparar((x) => x.atendimentos.concluidos)}
              />
              <Cartao
                i={{ rotulo: "Faturamento", valor: formatCurrency(m.vendas.valor), atual: m.vendas.valor, moeda: true, nota: `${m.vendas.concluidas} vendas · ${m.caixa.fechados} caixas fechados` }}
                c={comparar((x) => x.vendas.valor)}
              />
              <Cartao
                i={{ rotulo: "Clientes", valor: numero(m.clientes.total), atual: m.clientes.novos, nota: `${m.clientes.novos} novos no dia` }}
                c={comparar((x) => x.clientes.novos)}
              />
              <Cartao
                i={{ rotulo: "Módulos usados", valor: `${m.modulos_usados}/${MODULOS_DA_MATRIZ.length}`, atual: m.modulos_usados, nota: `${numero(m.operacoes)} registros` }}
                c={comparar((x) => x.modulos_usados)}
              />
              <Cartao
                i={{ rotulo: "Notificações", valor: numero(m.notificacoes.geradas), atual: m.notificacoes.geradas, nota: `${m.notificacoes.lidas} lidas · ${m.notificacoes.abertas} abertas` }}
                c={comparar((x) => x.notificacoes.geradas)}
              />
              <Cartao
                i={{
                  rotulo: "Incidentes",
                  valor: numero(m.incidentes.avisos_plataforma + m.incidentes.push_falhas),
                  atual: null,
                  nota: `Sentry 30 dias: ${errosDaEmpresa === null ? "indisponível" : errosDaEmpresa} · jobs com falha: ${m.incidentes.jobs_com_falha}`,
                  tom: m.incidentes.avisos_plataforma + m.incidentes.push_falhas > 0 || (errosDaEmpresa ?? 0) > 0 ? "alerta" : undefined,
                }}
              />
              <Cartao
                i={{
                  rotulo: "Inatividade",
                  valor: m.inatividade.sem_uso_no_dia ? "Sem uso no dia" : "Houve uso",
                  atual: null,
                  nota: `${semUso.dias} dias sem uso no piloto · maior sequência ${semUso.maiorSequencia}`,
                  tom: m.inatividade.sem_uso_no_dia ? "atencao" : undefined,
                }}
              />
            </dl>
          </section>

          {/* -------------------------------------------------- Desde o Dia 0 */}
          <section aria-labelledby="desde-titulo" className="space-y-3">
            <h2 id="desde-titulo" className="text-section-title text-foreground">Desde o Dia 0</h2>
            <p className="text-caption text-muted -mt-2">O que aconteceu durante o piloto (o histórico anterior, inclusive de testes, fica na base).</p>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
              {[
                ["Vendas", desdeODiaZero(ordenados, (x) => x.acumulado.vendas), false],
                ["Faturamento", desdeODiaZero(ordenados, (x) => x.acumulado.valor_vendido), true],
                ["Agendamentos", desdeODiaZero(ordenados, (x) => x.acumulado.agendamentos), false],
                ["Atendimentos", desdeODiaZero(ordenados, (x) => x.acumulado.atendimentos), false],
                ["Clientes novos", desdeODiaZero(ordenados, (x) => x.acumulado.clientes), false],
                ["Comissões geradas", desdeODiaZero(ordenados, (x) => x.acumulado.comissoes), true],
                ["Movimentações de estoque", desdeODiaZero(ordenados, (x) => x.acumulado.movimentacoes_estoque), false],
                ["Registros (todos os módulos)", ordenados.some((s) => s.dia_do_piloto >= 1) ? somaNoPiloto(ordenados, (x) => x.operacoes) : null, false],
              ].map(([rotulo, v, moeda]) => (
                <div key={rotulo as string} className="bg-surface p-4 min-w-0">
                  <dt className="font-subtitle text-caption text-muted truncate">{rotulo as string}</dt>
                  <dd className="numero text-body text-foreground mt-1.5">
                    {v === null ? "—" : moeda ? formatCurrency(v as number) : `${(v as number) > 0 ? "+" : ""}${numero(v as number)}`}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ------------------------------------------------------- Evolução */}
          <section aria-labelledby="evolucao-titulo" className="painel overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 id="evolucao-titulo" className="text-section-title text-foreground">Evolução dia a dia</h2>
              <p className="text-caption text-muted mt-1">Números do próprio dia. A seta compara com o dia anterior.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-caption">
                <thead>
                  <tr className="border-y border-border text-muted font-subtitle text-left">
                    {["Dia", "Ativos", "Registros", "Agend.", "Atend.", "Faturamento", "Módulos", "Falhas", ""].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-normal first:pl-5 last:pr-5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhaDoTempo(piloto.inicio, piloto.fim, ordenados).map(({ dia, n, snapshot }, i, todos) => {
                    const ant = i > 0 ? todos[i - 1].snapshot : null;
                    const x = snapshot?.metricas;
                    return (
                      <tr key={dia} className={cn("border-b border-border last:border-b-0", !snapshot && "text-muted")}>
                        <th scope="row" className="px-3 py-2 pl-5 text-left font-normal whitespace-nowrap">
                          <span className="text-foreground">{n === 0 ? "Dia 0" : `Dia ${n}`}</span> <span className="text-muted">{dataCurta(dia)}</span>
                        </th>
                        {x ? (
                          <>
                            <td className="px-3 py-2 numero">{x.usuarios.ativos}</td>
                            <td className="px-3 py-2 numero">
                              {numero(x.operacoes)} <Seta atual={x.operacoes} anterior={ant?.metricas.operacoes} />
                            </td>
                            <td className="px-3 py-2 numero">{x.agendamentos.criados}</td>
                            <td className="px-3 py-2 numero">{x.atendimentos.concluidos}</td>
                            <td className="px-3 py-2 numero whitespace-nowrap">{formatCurrency(x.vendas.valor)}</td>
                            <td className="px-3 py-2 numero">{x.modulos_usados}</td>
                            <td className={cn("px-3 py-2 numero", TOTAL_DE_FALHAS(x.falhas) > 0 && "text-warning-ink")}>{TOTAL_DE_FALHAS(x.falhas)}</td>
                            <td className="px-3 py-2 pr-5 text-muted whitespace-nowrap">
                              {x.inatividade.sem_uso_no_dia ? "sem uso" : ""}
                              {!snapshot!.final ? " parcial" : ""}
                            </td>
                          </>
                        ) : (
                          <td colSpan={8} className="px-3 py-2 pr-5">
                            {dia > hoje ? "a registrar" : "sem retrato"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-caption text-muted border-t border-border">
              Falhas do dia = vendas canceladas + estornos + caixas com diferença + falhas de push + jobs com falha.
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Modulos snaps={ordenados} atual={m} />
            <Horarios snaps={ordenados} />
          </div>

          <UsoPorPessoa snaps={ordenados} atual={atual!} emailDe={emailDe} />

          <FalhasAgora m={m} />
        </>
      )}
    </div>
  );
}

function Seta({ atual, anterior }: { atual: number; anterior: number | undefined }) {
  const v = variacao(atual, anterior);
  if (!v || v.delta === 0) return null;
  return (
    <span className={cn("text-micro", v.delta > 0 ? "text-success-ink" : "text-warning-ink")} aria-label={`${v.delta > 0 ? "subiu" : "caiu"} ${Math.abs(v.delta)}`}>
      {v.delta > 0 ? "▲" : "▼"}
    </span>
  );
}

function Delta({ rotulo, v, moeda }: { rotulo: string; v: { delta: number; pct: number | null } | null; moeda?: boolean }) {
  if (!v) return null;
  const sinal = v.delta > 0 ? "+" : "";
  const texto = moeda ? `${sinal}${formatCurrency(v.delta)}` : `${sinal}${Math.round(v.delta * 10) / 10}`;
  return (
    <span className={cn("block", v.delta > 0 ? "text-success-ink" : v.delta < 0 ? "text-warning-ink" : "text-muted")}>
      {texto}
      {v.pct !== null ? ` (${sinal}${v.pct}%)` : ""} {rotulo}
    </span>
  );
}

function Cartao({ i, c }: { i: Indicador; c?: { dia: ReturnType<typeof variacao>; media: ReturnType<typeof variacao> } }) {
  return (
    <div className="bg-surface p-4 min-w-0">
      <dt className="font-subtitle text-caption text-muted flex items-center gap-1.5">
        {i.tom && <span aria-hidden className={cn("size-1.5 shrink-0", i.tom === "alerta" ? "bg-danger" : "bg-warning")} />}
        <span className="truncate">{i.rotulo}</span>
      </dt>
      <dd className="numero text-metric-sm text-foreground mt-1.5 truncate">{i.valor}</dd>
      <dd className="text-micro text-muted mt-1 space-y-0.5">
        {i.nota && <span className="block">{i.nota}</span>}
        {c && <Delta rotulo="vs. ontem" v={c.dia} moeda={i.moeda} />}
        {c && <Delta rotulo="vs. média" v={c.media} moeda={i.moeda} />}
      </dd>
    </div>
  );
}

function Modulos({ snaps, atual }: { snaps: SnapshotDoPiloto[]; atual: MetricasDoDia }) {
  const periodo = modulosNoPiloto(snaps);
  const temPeriodo = periodo.length > 0;
  const linhas = temPeriodo
    ? periodo
    : Object.entries(atual.modulos).map(([modulo, registros]) => ({ modulo, registros: Number(registros), dias: 1 }));
  const max = Math.max(1, ...linhas.map((l) => l.registros));
  const usados = new Set(linhas.map((l) => l.modulo));
  return (
    <section aria-labelledby="modulos-titulo" className="painel overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 id="modulos-titulo" className="text-section-title text-foreground">Uso dos módulos</h2>
        <p className="text-caption text-muted mt-1">{temPeriodo ? "Somado nos dias do piloto" : "No dia mais recente"} · dias com uso ao lado.</p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {linhas.map((l) => (
          <li key={l.modulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-2.5">
            <span className="text-body-sm text-foreground truncate">{l.modulo}</span>
            <span className="text-caption text-muted numero">
              {numero(l.registros)}
              {temPeriodo ? ` · ${l.dias} ${l.dias === 1 ? "dia" : "dias"}` : ""}
            </span>
            <span aria-hidden className="col-span-2 h-1 bg-surface-muted">
              <span className="block h-full bg-chart" style={{ width: `${(l.registros / max) * 100}%` }} />
            </span>
          </li>
        ))}
        {MODULOS_DA_MATRIZ.filter((mod) => !usados.has(mod)).length > 0 && (
          <li className="px-5 py-2.5 text-caption text-muted">
            Sem uso: {MODULOS_DA_MATRIZ.filter((mod) => !usados.has(mod)).join(", ")}.
          </li>
        )}
      </ul>
    </section>
  );
}

function Horarios({ snaps }: { snaps: SnapshotDoPiloto[] }) {
  const doPiloto = snaps.some((s) => s.dia_do_piloto >= 1);
  const base = doPiloto ? snaps : snaps.map((s) => ({ ...s, dia_do_piloto: 1 }));
  const ops = horasNoPiloto(base, "horas");
  const sessoes = horasNoPiloto(base, "horas_sessao");
  const max = Math.max(1, ...ops, ...sessoes);
  const porDiaDaSemana = Array.from({ length: 7 }, () => 0);
  for (const s of base) {
    if (s.dia_do_piloto < 1) continue;
    porDiaDaSemana[new Date(`${s.dia}T12:00:00Z`).getUTCDay()] += s.metricas.operacoes;
  }
  const maxDia = Math.max(1, ...porDiaDaSemana);
  const faixa = (h: number) => ops[h] > 0 || sessoes[h] > 0;
  const primeira = ops.findIndex((_, h) => faixa(h));
  const ultima = 23 - [...ops].reverse().findIndex((_, i) => faixa(23 - i));
  const horas = primeira < 0 ? [] : Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
  return (
    <section aria-labelledby="horarios-titulo" className="painel overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 id="horarios-titulo" className="text-section-title text-foreground">Horários e dias de maior uso</h2>
        <p className="text-caption text-muted mt-1">
          {doPiloto ? "Dias do piloto" : "Dia 0"}, horário de São Paulo. Barra cheia = registros; contorno = pessoas com sessão ativa.
        </p>
      </div>
      {horas.length === 0 ? (
        <p className="px-5 pb-5 text-caption text-muted">Sem registros nem sessões ainda.</p>
      ) : (
        <ul className="px-5 pb-4 space-y-1">
          {horas.map((h) => (
            <li key={h} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-caption">
              <span className="numero text-muted">{String(h).padStart(2, "0")}h</span>
              <span aria-hidden className="relative h-3">
                <span className="absolute inset-y-0 left-0 border border-chart" style={{ width: `${(sessoes[h] / max) * 100}%` }} />
                <span className="absolute inset-y-[3px] left-0 bg-chart" style={{ width: `${(ops[h] / max) * 100}%` }} />
              </span>
              <span className="numero text-muted text-right">
                {ops[h]} · {sessoes[h]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {doPiloto && (
        <ul className="grid grid-cols-7 gap-px bg-border border-t border-border">
          {porDiaDaSemana.map((n, i) => (
            <li key={i} className="bg-surface px-2 py-2.5 text-center">
              <span className="block text-micro text-muted">{DIAS_DA_SEMANA[i]}</span>
              <span className="block numero text-caption text-foreground">{n}</span>
              <span aria-hidden className="mx-auto mt-1 block h-1 w-8 bg-surface-muted">
                <span className="block h-full bg-chart" style={{ width: `${(n / maxDia) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UsoPorPessoa({
  snaps,
  atual,
  emailDe,
}: {
  snaps: SnapshotDoPiloto[];
  atual: SnapshotDoPiloto;
  emailDe: Map<string, { email: string; ultimo_acesso: string | null }>;
}) {
  const doPiloto = snaps.filter((s) => s.dia_do_piloto >= 1);
  const diasAtivos = (uid: string) => doPiloto.filter((s) => s.metricas.usuarios.por_usuario.some((u) => u.user_id === uid && u.ativo)).length;
  const acoesNoPiloto = (uid: string) =>
    doPiloto.reduce((a, s) => a + (s.metricas.usuarios.por_usuario.find((u) => u.user_id === uid)?.acoes ?? 0), 0);
  const pessoas = atual.metricas.usuarios.por_usuario;
  return (
    <section aria-labelledby="pessoas-titulo" className="painel overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 id="pessoas-titulo" className="text-section-title text-foreground">Uso por pessoa</h2>
        <p className="text-caption text-muted mt-1">
          Donos, equipe e profissionais com login. Horas = horas com sessão ativa no dia; ações = registros na auditoria da barbearia.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-caption">
          <thead>
            <tr className="border-y border-border text-muted font-subtitle text-left">
              {["Pessoa", "Papel", "Último acesso", "Hoje: horas · ações", "Dias ativos", "Ações no piloto"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-normal first:pl-5 last:pr-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pessoas.map((u) => {
              const pessoa = emailDe.get(u.user_id);
              const ultimo = pessoa?.ultimo_acesso ?? u.ultimo_acesso;
              const dias = ultimo ? Math.max(0, Math.floor((Date.now() - Date.parse(ultimo)) / 86_400_000)) : null;
              const nivel = nivelDeInatividade(dias, ultimo);
              return (
                <tr key={u.user_id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-3 py-2 pl-5 text-left font-normal min-w-0">
                    <span className="block text-foreground truncate max-w-[16rem]">{u.profissional ?? pessoa?.email ?? "—"}</span>
                    {u.profissional && pessoa?.email && <span className="block text-muted truncate max-w-[16rem]">{pessoa.email}</span>}
                  </th>
                  <td className="px-3 py-2">{PAPEL[u.papel] ?? u.papel}</td>
                  <td className={cn("px-3 py-2 whitespace-nowrap", nivel === "prolongada" ? "text-danger-ink" : nivel === "atencao" ? "text-warning-ink" : "")}>
                    {ultimo ? haQuanto(ultimo) : "nunca entrou"}
                  </td>
                  <td className="px-3 py-2 numero">
                    {u.horas_ativas} · {u.acoes}
                  </td>
                  <td className="px-3 py-2 numero">
                    {diasAtivos(u.user_id)}/{doPiloto.length}
                  </td>
                  <td className="px-3 py-2 pr-5 numero">{acoesNoPiloto(u.user_id)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FalhasAgora({ m }: { m: MetricasDoDia }) {
  const itens: [string, number, string][] = [
    ["Atendimentos abertos há mais de 24 h", m.atendimentos.em_andamento_24h, "estado agora"],
    ["Agendamentos passados sem fechamento", m.agendamentos.passados_sem_fechamento, "estado agora"],
    ["Itens com estoque negativo", m.estoque.negativos, "estado agora"],
    ["Itens abaixo do mínimo", m.estoque.abaixo_do_minimo, "estado agora"],
    ["Caixas abertos", m.caixa.abertos_agora, "estado agora"],
    ["Vendas canceladas", m.vendas.canceladas, "no dia"],
    ["Estornos", m.vendas.estornos, "no dia"],
    ["Caixas fechados com diferença", m.caixa.com_diferenca, "no dia"],
    ["Falhas de push", m.incidentes.push_falhas, "no dia"],
    ["Jobs com falha (plataforma)", m.incidentes.jobs_com_falha, "no dia"],
  ];
  return (
    <section aria-labelledby="falhas-titulo" className="painel overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 id="falhas-titulo" className="text-section-title text-foreground">Falhas e gargalos</h2>
        <p className="text-caption text-muted mt-1">
          “Estado agora” inclui o histórico anterior ao piloto; compare com o Dia 0 antes de concluir. Comissões a pagar: {formatCurrency(m.comissoes.a_pagar_total)}.
        </p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-px bg-border border-t border-border">
        {itens.map(([rotulo, n, quando]) => (
          <li key={rotulo} className="bg-surface px-5 py-3 flex items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-body-sm text-foreground truncate">{rotulo}</span>
              <span className="block text-micro text-muted">{quando}</span>
            </span>
            <span className={cn("numero text-body shrink-0", n > 0 ? "text-warning-ink" : "text-muted")}>{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
