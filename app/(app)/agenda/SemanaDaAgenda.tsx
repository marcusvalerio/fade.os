import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addCalendarDays, businessDate, businessDayBounds, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { minutosDeJornada, formatarDuracao } from "@/lib/agenda-ocupacao";
import { distribuirEmFaixas } from "@/lib/agenda-semana";
import { cn } from "@/lib/cn";

const INATIVOS = ["cancelled_by_client", "cancelled_by_company", "no_show"];
const ALTURA_HORA = 56; // px por hora na grade

const ESTILO: Record<string, string> = {
  scheduled: "bg-surface border border-signal/60 text-foreground",
  confirmed: "bg-signal/15 border-l-2 border-signal text-foreground",
  arrived: "bg-warning/20 border-l-2 border-warning text-foreground",
  in_progress: "bg-signal text-signal-foreground",
  completed: "bg-surface-muted text-muted",
};

const ROTULO: Record<string, string> = {
  scheduled: "agendado",
  confirmed: "confirmado",
  arrived: "aguardando",
  in_progress: "em atendimento",
  completed: "concluído",
};

function minutoDoDia(iso: string) {
  const [h, m] = formatBusinessTime(iso).split(":").map(Number);
  return h * 60 + m;
}

function paraMin(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * A semana da agenda, de verdade: sete dias lado a lado, cada horário do
 * tamanho da sua duração. Sobrepostos (profissionais diferentes no mesmo
 * horário) dividem a coluna em faixas; o que está fora do funcionamento —
 * ou da jornada do profissional filtrado — fica hachurado, então o espaço
 * limpo e vazio é exatamente onde ainda cabe gente. Conflito (o mesmo
 * profissional em dois horários ao mesmo tempo) o banco já recusa; se um
 * dia aparecer, a grade marca em vez de esconder.
 */
export async function SemanaDaAgenda({
  companyId,
  unitId,
  inicioSemana,
  hoje,
  profissionalId,
}: {
  companyId: string;
  unitId: string;
  inicioSemana: string;
  hoje: string;
  profissionalId: string | null;
}) {
  const supabase = await createClient();
  const dias = Array.from({ length: 7 }, (_, i) => addCalendarDays(inicioSemana, i));
  const inicio = businessDayBounds(dias[0]).start;
  const fim = businessDayBounds(dias[6]).end;

  const [{ data: linhas }, { data: funcionamento }, { data: equipe }, { data: ausencias }] = await Promise.all([
    supabase
      .from("appointment_service")
      .select("id, starts_at, ends_at, professional_id, service:service_id(name), professional:professional_id(name), appointment:appointment_id(id, status, client:client_id(name))")
      .gte("starts_at", inicio.toISOString())
      .lt("starts_at", fim.toISOString())
      .order("starts_at"),
    supabase.from("unit_business_hours").select("weekday, start_time, end_time, active").eq("unit_id", unitId),
    supabase
      .from("professional")
      .select("id, schedules:professional_schedule(weekday, start_time, end_time, active, breaks:professional_schedule_break(start_time, end_time))")
      .eq("company_id", companyId)
      .eq("active", true),
    supabase
      .from("professional_absence")
      .select("professional_id, starts_at, ends_at")
      .lt("starts_at", fim.toISOString())
      .gt("ends_at", inicio.toISOString()),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todas = ((linhas ?? []) as any[]).filter(
    (l) => !INATIVOS.includes(l.appointment?.status) && (!profissionalId || l.professional_id === profissionalId)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equipeBruta = (equipe ?? []) as any[];

  const porDia = dias.map((dia) => {
    const [a, m, d] = dia.split("-").map(Number);
    const weekday = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
    const f = (funcionamento ?? []).find((h) => h.weekday === weekday && h.active);
    const faixaUnidade = f ? { inicio: f.start_time as string, fim: f.end_time as string } : null;
    const doDia = todas.filter((l) => businessDate(l.starts_at) === dia);

    // Capacidade: soma das janelas reais de quem trabalha no dia (ou só do
    // profissional filtrado), sem quem está ausente.
    const ausentes = new Set(
      (ausencias ?? [])
        .filter((x) => businessDate(x.starts_at) <= dia && businessDate(x.ends_at) >= dia)
        .map((x) => x.professional_id)
    );
    let janelaInicio = faixaUnidade ? paraMin(faixaUnidade.inicio) : null;
    let janelaFim = faixaUnidade ? paraMin(faixaUnidade.fim) : null;
    let capacidade = 0;
    for (const p of equipeBruta) {
      if (profissionalId && p.id !== profissionalId) continue;
      if (ausentes.has(p.id)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = ((p.schedules ?? []) as any[]).find((s) => s.weekday === weekday && s.active);
      if (!j) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pausas = ((j.breaks ?? []) as any[]).map((b) => ({ inicio: b.start_time, fim: b.end_time }));
      capacidade += minutosDeJornada({ inicio: j.start_time, fim: j.end_time }, faixaUnidade, pausas);
      if (profissionalId && faixaUnidade) {
        janelaInicio = Math.max(paraMin(faixaUnidade.inicio), paraMin(j.start_time));
        janelaFim = Math.min(paraMin(faixaUnidade.fim), paraMin(j.end_time));
      }
    }
    if (profissionalId && capacidade === 0) {
      janelaInicio = null;
      janelaFim = null;
    }

    const blocos = doDia.map((l) => ({
      id: l.id as string,
      inicio: minutoDoDia(l.starts_at),
      fim: Math.max(minutoDoDia(l.starts_at) + 10, minutoDoDia(l.ends_at) || minutoDoDia(l.starts_at) + 30),
      linha: l,
    }));
    const ocupado = blocos.reduce((s, b) => s + (b.fim - b.inicio), 0);
    const agendamentos = new Set(doDia.map((l) => l.appointment?.id)).size;

    return { dia, weekday, janelaInicio, janelaFim, blocos, ocupado, capacidade, agendamentos };
  });

  // Recorte vertical: do primeiro horário aberto (ou marcado) ao último.
  const inicios = porDia.flatMap((d) => [d.janelaInicio, ...d.blocos.map((b) => b.inicio)]).filter((v): v is number => v !== null);
  const fins = porDia.flatMap((d) => [d.janelaFim, ...d.blocos.map((b) => b.fim)]).filter((v): v is number => v !== null);
  const topo = inicios.length ? Math.floor(Math.min(...inicios) / 60) * 60 : 8 * 60;
  const base = fins.length ? Math.ceil(Math.max(...fins) / 60) * 60 : 20 * 60;
  const horas = Array.from({ length: Math.max(1, (base - topo) / 60) }, (_, i) => topo / 60 + i);
  const altura = (horas.length * ALTURA_HORA);
  const y = (min: number) => ((min - topo) / 60) * ALTURA_HORA;

  const agora = new Date();
  const minutoAgora = minutoDoDia(agora.toISOString());
  const sufixo = profissionalId ? `&prof=${profissionalId}` : "";

  return (
    <div className="painel overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-[46rem]">
          {/* Cabeçalho: dia, quantos horários e quanto da capacidade está marcada. */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border sticky top-0 bg-surface z-10">
            <span />
            {porDia.map((d) => {
              const pct = d.capacidade > 0 ? Math.min(100, Math.round((d.ocupado / d.capacidade) * 100)) : null;
              const ehHoje = d.dia === hoje;
              return (
                <Link
                  key={d.dia}
                  href={`/agenda?date=${d.dia}${sufixo}`}
                  className="px-2 pt-3 pb-2.5 border-l border-border hover:bg-surface-muted/60 transition-colors duration-micro min-w-0"
                  aria-label={`${formatBusinessDayLabel(d.dia, { weekday: "long", day: "numeric", month: "long" })}: ${d.agendamentos} horário(s)${pct !== null ? `, ${pct}% ocupado` : ""}. Abrir o dia.`}
                >
                  <span className={cn("block font-subtitle text-micro uppercase tracking-label", ehHoje ? "text-signal" : "text-muted")}>
                    {formatBusinessDayLabel(d.dia, { weekday: "short" }).replace(".", "")}
                  </span>
                  <span className="flex items-baseline justify-between gap-2 mt-0.5">
                    <span className={cn("numero text-metric-sm", ehHoje ? "text-signal" : "text-foreground")}>
                      {d.dia.slice(8, 10)}
                    </span>
                    <span className="text-micro text-muted tabular-nums truncate">
                      {d.capacidade === 0 && d.agendamentos === 0 ? "fechado" : `${d.agendamentos} hor.`}
                    </span>
                  </span>
                  <span className="mt-2 block h-1 bg-surface-muted" aria-hidden>
                    <span
                      className={cn("block h-full origin-left animate-crescer motion-reduce:animate-none", (pct ?? 0) >= 90 ? "bg-warning" : "bg-signal")}
                      style={{ width: `${pct ?? 0}%` }}
                    />
                  </span>
                  <span className="block text-micro text-muted mt-1 tabular-nums">
                    {pct === null ? "sem jornada" : `${pct}% · ${formatarDuracao(Math.max(0, d.capacidade - d.ocupado))} livre`}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] relative" style={{ height: altura }}>
            {/* Régua das horas */}
            <div className="relative">
              {horas.map((h, i) => (
                <span key={h} className="absolute right-2 text-micro text-muted tabular-nums -translate-y-1/2" style={{ top: i * ALTURA_HORA }}>
                  {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>

            {porDia.map((d) => {
              const faixas = distribuirEmFaixas(d.blocos);
              const conflitos = new Set<string>();
              for (const a of d.blocos) {
                for (const b of d.blocos) {
                  if (a.id < b.id && a.linha.professional_id === b.linha.professional_id && a.inicio < b.fim && b.inicio < a.fim) {
                    conflitos.add(a.id);
                    conflitos.add(b.id);
                  }
                }
              }
              return (
                <div key={d.dia} className="relative border-l border-border">
                  {/* Fios das horas */}
                  {horas.map((h, i) => (
                    <span key={h} aria-hidden className="absolute inset-x-0 border-t border-border/70" style={{ top: i * ALTURA_HORA }} />
                  ))}
                  {/* Fora do funcionamento / da jornada: hachurado */}
                  {d.janelaInicio === null ? (
                    <span aria-hidden className="absolute inset-0 fora-do-horario" />
                  ) : (
                    <>
                      <span aria-hidden className="absolute inset-x-0 top-0 fora-do-horario" style={{ height: Math.max(0, y(d.janelaInicio)) }} />
                      <span aria-hidden className="absolute inset-x-0 bottom-0 fora-do-horario" style={{ top: y(d.janelaFim ?? base) }} />
                    </>
                  )}
                  {/* Linha do agora */}
                  {d.dia === hoje && minutoAgora >= topo && minutoAgora <= base && (
                    <span aria-hidden className="absolute inset-x-0 z-[2] h-px bg-signal" style={{ top: y(minutoAgora) }}>
                      <span className="absolute -left-1 -top-[3px] size-1.5 bg-signal" />
                    </span>
                  )}
                  {d.blocos.map((b) => {
                    const f = faixas.get(b.id)!;
                    const status = b.linha.appointment?.status as string;
                    const curto = b.fim - b.inicio < 40;
                    return (
                      <Link
                        key={b.id}
                        href={`/agenda?date=${d.dia}${sufixo}`}
                        className={cn(
                          "absolute z-[1] rounded-xs px-1.5 py-1 overflow-hidden text-left transition-[filter] duration-micro hover:brightness-95",
                          ESTILO[status] ?? ESTILO.scheduled,
                          conflitos.has(b.id) && "outline-2 outline-danger"
                        )}
                        style={{
                          top: y(b.inicio) + 1,
                          height: Math.max(18, y(b.fim) - y(b.inicio) - 2),
                          left: `calc(${(f.faixa / f.total) * 100}% + 2px)`,
                          width: `calc(${100 / f.total}% - 4px)`,
                        }}
                        title={`${formatBusinessTime(b.linha.starts_at)} ${b.linha.appointment?.client?.name ?? "Cliente"} · ${b.linha.service?.name} · ${b.linha.professional?.name}`}
                      >
                        <span className="block text-micro tabular-nums leading-tight opacity-80">
                          {formatBusinessTime(b.linha.starts_at)}
                          {conflitos.has(b.id) && " · conflito"}
                        </span>
                        {!curto && (
                          <>
                            <span className="block text-caption font-medium leading-tight truncate">{b.linha.appointment?.client?.name ?? "Cliente"}</span>
                            <span className="block text-micro leading-tight truncate opacity-80">
                              {b.linha.service?.name}
                              {!profissionalId && ` · ${(b.linha.professional?.name ?? "").split(" ")[0]}`}
                            </span>
                          </>
                        )}
                        <span className="sr-only">
                          {b.linha.appointment?.client?.name}, {b.linha.service?.name} com {b.linha.professional?.name}, {ROTULO[status] ?? status}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-3 border-t border-border text-micro text-muted">
        {[
          ["bg-surface border border-signal/60", "Agendado"],
          ["bg-signal/15 border-l-2 border-signal", "Confirmado"],
          ["bg-warning/20 border-l-2 border-warning", "Aguardando"],
          ["bg-signal", "Em atendimento"],
          ["bg-surface-muted", "Concluído"],
          ["fora-do-horario", "Fora do horário"],
        ].map(([cls, rotulo]) => (
          <span key={rotulo} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3", cls)} />
            {rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
