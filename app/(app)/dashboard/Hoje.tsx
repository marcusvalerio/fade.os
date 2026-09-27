import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientBehaviors } from "@/lib/crm";
import { businessDayBounds, businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { formatCurrency } from "@/lib/format";
import { sinaisDoPulso, agoraEmUmaFrase, ROTULO_DO_NIVEL, type Nivel } from "@/lib/pulso";
import { estadoDoDia } from "@/lib/inicio";
import { minutosDeJornada, ocupacaoDoDia, formatarDuracao } from "@/lib/agenda-ocupacao";
import { rotularHomonimos } from "@/lib/pessoas";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const MARCA_DO_NIVEL: Record<Nivel, string> = {
  critico: "bg-danger",
  importante: "bg-warning",
  atencao: "border-[1.5px] border-warning",
  info: "bg-signal",
};

const TINTA_DO_NIVEL: Record<Nivel, string> = {
  critico: "text-danger-ink",
  importante: "text-warning-ink",
  atencao: "text-warning-ink",
  info: "text-info-ink",
};

const INATIVOS = ["cancelled_by_client", "cancelled_by_company", "no_show"];

/**
 * HOJE — o topo do Início: em que estado a barbearia está agora, o que pede
 * ação e como a equipe está ocupada. Tudo sai do banco neste request, numa
 * rodada de consultas em paralelo; nada é estimado.
 */
export async function Hoje({ companyId, primeiroNome }: { companyId: string; primeiroNome: string }) {
  const supabase = await createClient();
  const hoje = businessToday();
  const { start, end } = businessDayBounds(hoje);
  const agora = Date.now();
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const weekday = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();

  const { data: unit } = await supabase
    .from("unit")
    .select("id")
    .eq("company_id", companyId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const [
    { data: linhas },
    { data: equipe },
    { data: funcionamento },
    { data: ausencias },
    { count: esquecidos },
    { data: caixa },
    { data: comissoes },
    { data: produtos },
    comportamentos,
  ] = await Promise.all([
    supabase
      .from("appointment_service")
      .select(
        "id, starts_at, ends_at, professional_id, service:service_id(name), appointment:appointment_id(id, status, updated_at, client:client_id(id, name))"
      )
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    supabase
      .from("professional")
      .select(
        "id, name, phone:phone_last4, schedules:professional_schedule(weekday, start_time, end_time, active, breaks:professional_schedule_break(start_time, end_time))"
      )
      .eq("company_id", companyId)
      .eq("active", true),
    unit
      ? supabase
          .from("unit_business_hours")
          .select("start_time, end_time, active")
          .eq("unit_id", unit.id)
          .eq("weekday", weekday)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("professional_absence")
      .select("professional_id")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString()),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "in_progress")
      .lt("created_at", start.toISOString()),
    supabase.from("cash_session").select("id").eq("company_id", companyId).eq("status", "open").limit(1),
    supabase.from("commission").select("amount").eq("company_id", companyId).eq("status", "due"),
    supabase.from("product").select("current_stock, minimum_stock").eq("company_id", companyId).eq("active", true),
    getClientBehaviors(companyId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todas = (linhas ?? []) as any[];

  // Um agendamento com dois serviços são duas linhas: conta-se o agendamento.
  const porAgendamento = new Map<string, { status: string; inicio: number; atualizado: number; cliente: string }>();
  todas.forEach((l) => {
    const id = l.appointment?.id;
    if (!id || porAgendamento.has(id)) return;
    porAgendamento.set(id, {
      status: l.appointment.status,
      inicio: new Date(l.starts_at).getTime(),
      atualizado: new Date(l.appointment.updated_at ?? l.starts_at).getTime(),
      cliente: l.appointment.client?.name ?? "Cliente",
    });
  });
  const ags = Array.from(porAgendamento.values()).filter((a) => !INATIVOS.includes(a.status));
  const conta = (s: string[]) => ags.filter((a) => s.includes(a.status)).length;
  const pendentes = ags.filter((a) => ["scheduled", "confirmed"].includes(a.status));
  const proximoAg = pendentes.filter((a) => a.inicio >= agora).sort((a, b) => a.inicio - b.inicio)[0];

  const numeros = {
    total: ags.length,
    restantes: pendentes.filter((a) => a.inicio >= agora).length,
    emAtendimento: conta(["in_progress"]),
    aguardando: conta(["arrived"]),
    concluidos: conta(["completed"]),
    atrasados: pendentes.filter((a) => a.inicio < agora - 10 * 60_000).length,
    // "Chegou" é a última mudança do agendamento que está aguardando: o
    // updated_at marca desde quando ele espera.
    esperandoMuito: ags.filter((a) => a.status === "arrived" && agora - a.atualizado > 15 * 60_000).length,
  };
  const confirmados = conta(["confirmed"]);

  const dados = {
    ...numeros,
    pendentesConfirmacao: ags.filter((a) => a.status === "scheduled" && a.inicio >= agora).length,
    atendimentosEsquecidos: esquecidos ?? 0,
    caixaAberto: (caixa ?? []).length > 0,
    atendimentosHoje: ags.length,
    clientesParaChamar: Array.from(comportamentos.values()).filter((c) => c.status === "atencao" || c.status === "recuperacao").length,
    estoqueCritico: (produtos ?? []).filter((p) => Number(p.current_stock) <= Number(p.minimum_stock)).length,
    comissoesDevidas: (comissoes ?? []).reduce((s, c) => s + Number(c.amount), 0),
  };

  const sinais = sinaisDoPulso(dados, formatCurrency);
  const frase = agoraEmUmaFrase(
    dados,
    proximoAg ? { hora: formatBusinessTime(new Date(proximoAg.inicio).toISOString()), cliente: proximoAg.cliente } : null
  );
  const estado = estadoDoDia(numeros);

  // Equipe de hoje: quem tem jornada no dia da semana e não está ausente,
  // com a janela real (jornada ∩ funcionamento − intervalos).
  const faixa = funcionamento && funcionamento.active ? { inicio: funcionamento.start_time, fim: funcionamento.end_time } : null;
  const ausentes = new Set((ausencias ?? []).map((a) => a.professional_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equipeBruta = (equipe ?? []) as any[];
  const rotulos = new Map(rotularHomonimos(equipeBruta).map((p) => [p.id, p.name]));
  const equipeHoje = equipeBruta
    .map((p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jornada = ((p.schedules ?? []) as any[]).find((j) => j.weekday === weekday && j.active);
      const jornadaMin = ausentes.has(p.id)
        ? 0
        : minutosDeJornada(
            jornada ? { inicio: jornada.start_time, fim: jornada.end_time } : null,
            faixa,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((jornada?.breaks ?? []) as any[]).map((b) => ({ inicio: b.start_time, fim: b.end_time }))
          );
      const marcados = todas
        .filter((l) => l.professional_id === p.id && !INATIVOS.includes(l.appointment?.status))
        .map((l) => Math.round((new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime()) / 60000));
      return {
        id: p.id as string,
        nome: (rotulos.get(p.id) ?? p.name) as string,
        ausente: ausentes.has(p.id),
        ocupacao: ocupacaoDoDia(jornadaMin, marcados),
        horarios: marcados.length,
      };
    })
    .filter((p) => p.ocupacao.jornadaMin > 0 || p.horarios > 0 || p.ausente)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const trabalhando = equipeHoje.filter((p) => p.ocupacao.jornadaMin > 0).length;

  const proximos = todas
    .filter((l) => ["scheduled", "confirmed", "arrived", "in_progress"].includes(l.appointment?.status))
    .filter((l) => l.appointment?.status === "in_progress" || new Date(l.starts_at).getTime() >= agora - 15 * 60_000)
    .slice(0, 5);

  const hora = Number(formatBusinessTime(new Date()).slice(0, 2));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const rotuloHoje = formatBusinessDayLabel(hoje, { weekday: "long", day: "numeric", month: "long" });

  const fatos: { rotulo: string; valor: string; tom?: string }[] = [
    { rotulo: "Horários hoje", valor: String(numeros.total) },
    { rotulo: "Confirmados", valor: String(confirmados) },
    { rotulo: "Aguardando", valor: String(numeros.aguardando), tom: numeros.aguardando > 0 ? "text-warning-ink" : undefined },
    { rotulo: "Em atendimento", valor: String(numeros.emAtendimento), tom: numeros.emAtendimento > 0 ? "text-info-ink" : undefined },
    { rotulo: "Concluídos", valor: String(numeros.concluidos) },
    { rotulo: "Equipe hoje", valor: equipeHoje.length > 0 ? `${trabalhando} de ${equipeBruta.length}` : "—" },
    { rotulo: "Caixa", valor: dados.caixaAberto ? "Aberto" : "Fechado", tom: dados.caixaAberto ? "text-success-ink" : undefined },
  ];

  return (
    <div className="space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">
          {saudacao}, {primeiroNome} · {rotuloHoje}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 flex-1 basis-72">
            <h1 className="text-page-title text-foreground">
              {estado.tom === "atencao" && <span aria-hidden className="inline-block size-2.5 bg-warning mr-3 align-middle -translate-y-1" />}
              {estado.titulo}
            </h1>
            <p className="font-subtitle text-subtitle text-muted mt-2.5">{frase}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/agenda/novo" className={buttonClasses()}>
              Novo agendamento
            </Link>
            <Link href="/atendimento/novo" className={buttonClasses({ variant: "secondary" })}>
              Atender agora
            </Link>
          </div>
        </div>

        {/* Fatos do dia: uma faixa com fios de 1px entre as células (o gap
            deixa aparecer a cor da borda), em qualquer largura. */}
        <dl className="mt-7 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-px bg-border border-y border-border">
          {fatos.map((f, i) => (
            <div
              key={f.rotulo}
              className="min-w-0 bg-background py-4 px-4 animate-rise-in motion-reduce:animate-none"
              style={{ animationDelay: `calc(${i} * var(--stagger) / 2)` }}
            >
              <dt className="font-subtitle text-caption text-muted truncate">{f.rotulo}</dt>
              <dd className={cn("numero text-metric-sm text-foreground mt-1.5", f.tom)}>{f.valor}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* PULSO — o que pede ação, do mais urgente ao informativo. */}
        <section aria-labelledby="pulso-titulo" className="painel lg:col-span-7 overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="pulso-vivo size-2 bg-signal" />
              <h2 id="pulso-titulo" className="text-section-title text-foreground">
                Pulso da operação
              </h2>
            </div>
            <span className="font-subtitle text-caption text-muted tabular-nums">
              {formatBusinessTime(new Date(agora).toISOString())}
            </span>
          </div>
          {sinais.length === 0 ? (
            <div className="px-5 sm:px-6 pb-6">
              <p className="text-body-sm text-foreground font-medium">Nada pedindo atenção agora.</p>
              <p className="text-caption text-muted mt-1">
                Quando algo precisar de você — cliente esperando, horário atrasando, caixa fechado — aparece aqui, com o
                lugar onde se resolve.
              </p>
            </div>
          ) : (
            <ul className="border-t border-border divide-y divide-border">
              {sinais.map((s, i) => (
                <li key={s.chave} className="animate-rise-in motion-reduce:animate-none" style={{ animationDelay: `calc(${i} * var(--stagger))` }}>
                  <Link
                    href={s.href}
                    className="group flex items-start gap-3.5 px-5 sm:px-6 py-4 transition-colors duration-micro ease-standard hover:bg-surface-muted/60"
                  >
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0", MARCA_DO_NIVEL[s.tom])} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-subtitle text-micro uppercase tracking-label", TINTA_DO_NIVEL[s.tom])}>
                        {ROTULO_DO_NIVEL[s.tom]}
                      </span>
                      <span className="block text-body-sm font-medium text-foreground mt-1">{s.titulo}</span>
                      <span className="block text-caption text-muted mt-0.5">{s.detalhe}</span>
                    </span>
                    <span className="shrink-0 self-center text-caption font-medium text-foreground whitespace-nowrap group-hover:translate-x-0.5 transition-transform duration-micro ease-standard">
                      {s.acao} <span aria-hidden>→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AGENDA DE HOJE — quem está ocupado e o que vem a seguir. */}
        <section aria-labelledby="hoje-agenda-titulo" className="painel lg:col-span-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="hoje-agenda-titulo" className="text-section-title text-foreground">
              Agenda de hoje
            </h2>
            <Link href="/agenda" className="text-caption text-muted hover:text-foreground">
              Abrir agenda →
            </Link>
          </div>

          {equipeHoje.length === 0 ? (
            <p className="text-caption text-muted mt-4">Ninguém com jornada hoje. Ajuste as jornadas em Equipe.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {equipeHoje.map((p, i) => (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/agenda?prof=${p.id}`} className="text-body-sm text-foreground truncate hover:underline underline-offset-4">
                      {p.nome}
                    </Link>
                    <span className="text-caption text-muted tabular-nums shrink-0">
                      {p.ausente
                        ? "ausente hoje"
                        : p.ocupacao.pct === null
                          ? `${p.horarios} horário(s)`
                          : `${p.ocupacao.pct}% · ${p.ocupacao.livreMin > 0 ? `${formatarDuracao(p.ocupacao.livreMin)} livre` : "cheio"}`}
                    </span>
                  </div>
                  <span
                    className="mt-1.5 block h-1 bg-surface-muted"
                    role="img"
                    aria-label={
                      p.ocupacao.pct === null ? `${p.nome}: sem jornada hoje` : `${p.nome}: ${p.ocupacao.pct}% da jornada ocupada`
                    }
                  >
                    <span
                      className={cn(
                        "block h-full origin-left animate-crescer motion-reduce:animate-none",
                        (p.ocupacao.pct ?? 0) >= 90 ? "bg-warning" : "bg-signal"
                      )}
                      style={{ width: `${p.ocupacao.pct ?? 0}%`, animationDelay: `calc(${i} * var(--stagger) / 2)` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <p className="font-subtitle text-caption text-muted">A seguir</p>
            {proximos.length === 0 ? (
              <p className="text-body-sm text-muted mt-2">
                Nada mais marcado para hoje.{" "}
                <Link href="/agenda/novo" className="text-foreground underline underline-offset-4 decoration-signal">
                  Marcar um horário
                </Link>
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {proximos.map((l) => {
                  const emCurso = l.appointment?.status === "in_progress";
                  return (
                    <li key={l.id} className="flex items-baseline gap-3 py-2">
                      <span className={cn("numero text-body w-12 shrink-0", emCurso ? "text-info-ink" : "text-foreground")}>
                        {formatBusinessTime(l.starts_at)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">
                        {l.appointment?.client?.name ?? "Cliente"}
                        <span className="text-muted"> · {l.service?.name}</span>
                      </span>
                      {emCurso && <span className="font-subtitle text-micro uppercase tracking-label text-info-ink shrink-0">na cadeira</span>}
                      {l.appointment?.status === "arrived" && (
                        <span className="font-subtitle text-micro uppercase tracking-label text-warning-ink shrink-0">chegou</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
