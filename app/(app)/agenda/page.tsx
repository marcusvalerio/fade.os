import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { updateAppointmentStatus } from "@/actions/agenda";
import { startAttendanceFromAppointment } from "@/actions/atendimento";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Vazio, Aviso } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DateWindowNav } from "./DateWindowNav";
import { addCalendarDays, businessDate, businessDayBounds, businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { escopoDaAgenda } from "@/lib/permissions";
import { minutosDeJornada, ocupacaoDoDia, formatarDuracao } from "@/lib/agenda-ocupacao";
import { segundaDaSemana } from "@/lib/agenda-semana";
import { SemanaDaAgenda } from "./SemanaDaAgenda";
import { rotularHomonimos } from "@/lib/pessoas";
import { formatMinutes, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { whatsAppUrl } from "@/lib/whatsapp";
import { buildConfirmationMessage, relativeDayLabel } from "./confirmation-message";
import type { AppointmentStatus } from "@/lib/types";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Aguardando",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled_by_client: "Cancelado pelo cliente",
  cancelled_by_company: "Cancelado",
  no_show: "Não compareceu",
};

/*
 * O estado de cada horário é o sinal do CORTEX — quadrado + palavra — e não
 * um badge por linha. Vazado = ainda não aconteceu nada (agendado,
 * cancelado); cheio = algo aconteceu, na cor do que aconteceu. A palavra é
 * sempre visível: a cor nunca é o único sinal.
 */
const STATUS_SINAL: Record<AppointmentStatus, { quadrado: string; texto: string }> = {
  scheduled: { quadrado: "border border-border-strong", texto: "text-muted" },
  confirmed: { quadrado: "bg-signal", texto: "text-foreground" },
  arrived: { quadrado: "bg-warning", texto: "text-warning-ink" },
  in_progress: { quadrado: "bg-signal", texto: "text-accent" },
  completed: { quadrado: "bg-success", texto: "text-success-ink" },
  cancelled_by_client: { quadrado: "border border-border-strong", texto: "text-muted" },
  cancelled_by_company: { quadrado: "border border-border-strong", texto: "text-muted" },
  no_show: { quadrado: "bg-danger", texto: "text-danger-ink" },
};

// Filtro que não casa com nenhuma linha: vínculo sem cadastro de profissional.
const SEM_PROFISSIONAL = "00000000-0000-0000-0000-000000000000";

function EstadoDoHorario({ status }: { status: AppointmentStatus }) {
  const sinal = STATUS_SINAL[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-caption font-medium whitespace-nowrap", sinal.texto)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0", sinal.quadrado)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; pendentes?: string; prof?: string; vista?: string }>;
}) {
  const { date, pendentes, prof, vista } = await searchParams;
  const semana = vista === "semana";
  const somentePendentes = pendentes === "1";
  // "Hoje" é o dia da barbearia. Lido do relógio do servidor (UTC), das 21:00
  // em diante a agenda já abria no dia seguinte.
  const today = businessToday();
  const selectedDate = date ?? today;
  const current = await getCurrentCompany();
  const supabase = await createClient();
  // Barbeiro vê só a própria agenda: o profissional vem da sessão, e `?prof=`
  // é ignorado para ele. Sem cadastro de profissional o filtro usa um id que
  // não existe — lista vazia, nunca a equipe. O RLS faz o mesmo no banco.
  const escopo = await escopoDaAgenda(current!.company.id);
  const somenteDe = escopo.equipe ? null : (escopo.profissionalId ?? SEM_PROFISSIONAL);

  const { data: unit } = await supabase
    .from("unit")
    .select("id, name")
    .eq("company_id", current!.company.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  // O dia da barbearia vai de 00:00 a 00:00 no fuso dela, o que em UTC são
  // 03:00 a 03:00. Filtrar com strings ingênuas fazia o Postgres recortar o
  // dia em UTC: um agendamento das 23:30 caía no dia seguinte, e as três
  // primeiras horas da madrugada apareciam no dia anterior.
  const { start: dayStart, end: dayEnd } = businessDayBounds(selectedDate);

  const { data: lines } = unit
    ? await supabase
        .from("appointment_service")
        .select(
          "id, starts_at, ends_at, service:service_id(name, default_price), professional:professional_id(id, name), appointment:appointment_id(id, status, client:client_id(name, phone))"
        )
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .match(somenteDe ? { professional_id: somenteDe } : {})
        .order("starts_at")
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linhasDoDia = (lines ?? []) as any[];
  const nowMs = Date.now();

  // A equipe do dia: quem tem jornada neste dia da semana, com a janela real
  // de trabalho (jornada ∩ funcionamento − intervalos) — a mesma que o motor
  // de disponibilidade usa. Daqui saem o filtro por profissional, "Minha
  // agenda" e a ocupação.
  const [ano, mes, dia] = selectedDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  const inicioSemana = addCalendarDays(selectedDate, -3);
  const [user, { data: equipe }, { data: funcionamento }, { data: linhasDaJanela }] = await Promise.all([
    requireAuthenticatedUser(),
    supabase
      .from("professional")
      .select(
        "id, name, user_id, role_title, phone:phone_last4, schedules:professional_schedule(weekday, start_time, end_time, active, breaks:professional_schedule_break(start_time, end_time))"
      )
      .eq("company_id", current!.company.id)
      .eq("active", true)
      .match(somenteDe ? { id: somenteDe } : {}),
    unit
      ? supabase
          .from("unit_business_hours")
          .select("start_time, end_time, active")
          .eq("unit_id", unit.id)
          .eq("weekday", weekday)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Carga da semana em volta do dia escolhido: quantos agendamentos
    // ativos cada dia da janela de datas tem.
    unit
      ? supabase
          .from("appointment_service")
          .select("starts_at, appointment:appointment_id!inner(id, status)")
          .gte("starts_at", businessDayBounds(inicioSemana).start.toISOString())
          .lt("starts_at", businessDayBounds(addCalendarDays(inicioSemana, 6)).end.toISOString())
          .match(somenteDe ? { professional_id: somenteDe } : {})
          .not("appointment.status", "in", "(cancelled_by_client,cancelled_by_company,no_show)")
      : Promise.resolve({ data: [] }),
  ]);

  const cargaPorDia: Record<string, number> = {};
  const vistosPorDia = new Map<string, Set<string>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((linhasDaJanela ?? []) as any[]).forEach((l) => {
    const d = businessDate(l.starts_at);
    const set = vistosPorDia.get(d) ?? new Set<string>();
    set.add(l.appointment?.id);
    vistosPorDia.set(d, set);
    cargaPorDia[d] = set.size;
  });

  const faixaFuncionamento =
    funcionamento && funcionamento.active ? { inicio: funcionamento.start_time, fim: funcionamento.end_time } : null;
  const ativos = (s: string) => !["cancelled_by_client", "cancelled_by_company", "no_show"].includes(s);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const equipeBruta = (equipe ?? []) as any[];
  const rotulos = new Map(rotularHomonimos(equipeBruta).map((p) => [p.id, p.name]));
  const equipeDoDia = equipeBruta
    .map((p) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jornada = ((p.schedules ?? []) as any[]).find((j) => j.weekday === weekday && j.active);
      const jornadaMin = minutosDeJornada(
        jornada ? { inicio: jornada.start_time, fim: jornada.end_time } : null,
        faixaFuncionamento,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((jornada?.breaks ?? []) as any[]).map((b) => ({ inicio: b.start_time, fim: b.end_time }))
      );
      const marcados = linhasDoDia
        .filter((l) => l.professional?.id === p.id && ativos(l.appointment?.status))
        .map((l) => Math.round((new Date(l.ends_at).getTime() - new Date(l.starts_at).getTime()) / 60000));
      return { id: p.id as string, nome: (rotulos.get(p.id) ?? p.name) as string, userId: p.user_id as string | null, ocupacao: ocupacaoDoDia(jornadaMin, marcados), atendimentos: marcados.length };
    })
    .filter((p) => p.ocupacao.jornadaMin > 0 || p.atendimentos > 0)
    .sort((a, b) => (b.ocupacao.pct ?? 0) - (a.ocupacao.pct ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));

  const eu = (equipe ?? []).find((p) => p.user_id === user.id);
  const filtroId = somenteDe ?? (prof === "eu" ? eu?.id : prof);
  const filtrado = escopo.equipe ? (equipeDoDia.find((p) => p.id === filtroId) ?? null) : null;
  const allRows = filtroId ? linhasDoDia.filter((l) => l.professional?.id === filtroId) : linhasDoDia;
  const sufixoFiltro = escopo.equipe && prof ? `&prof=${prof}` : "";

  const counts = {
    aguardando: allRows.filter((r) => r.appointment?.status === "arrived").length,
    emAtendimento: allRows.filter((r) => r.appointment?.status === "in_progress").length,
    concluidos: allRows.filter((r) => r.appointment?.status === "completed").length,
    restantes: allRows.filter((r) => ["scheduled", "confirmed"].includes(r.appointment?.status)).length,
  };

  // "Aguardando confirmação" não é um status novo: é o próprio `scheduled`
  // (a equipe ainda não clicou "Confirmar") — ver docs/PUBLIC_BOOKING.md.
  const aguardandoConfirmacao = allRows.filter((r) => r.appointment?.status === "scheduled");
  // Um agendamento com dois serviços são duas linhas — a contagem é de
  // pessoas esperando confirmação, não de linhas.
  const pendentesDeConfirmacao = new Set(aguardandoConfirmacao.map((r) => r.appointment?.id)).size;
  const rows = somentePendentes ? aguardandoConfirmacao : allRows;
  const dayLabel = relativeDayLabel(selectedDate, today) ??
    formatBusinessDayLabel(selectedDate, { weekday: "long", day: "2-digit", month: "long" });

  const alternarVista = (
    <div role="group" aria-label="Visualização" className="inline-flex rounded-sm border border-border-strong p-0.5 text-caption">
      {[
        ["dia", "Dia"],
        ["semana", "Semana"],
      ].map(([valor, rotulo]) => {
        const ativa = (valor === "semana") === semana;
        return (
          <Link
            key={valor}
            href={`/agenda?date=${selectedDate}${valor === "semana" ? "&vista=semana" : ""}${sufixoFiltro}`}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded-xs transition-colors duration-micro",
              ativa ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
            )}
          >
            {rotulo}
          </Link>
        );
      })}
    </div>
  );

  if (semana && unit) {
    const inicioSemana = segundaDaSemana(selectedDate);
    const fimSemana = addCalendarDays(inicioSemana, 6);
    const rotuloSemana = `${formatBusinessDayLabel(inicioSemana, { day: "numeric", month: "short" })} a ${formatBusinessDayLabel(fimSemana, { day: "numeric", month: "short", year: "numeric" })}`;
    const nav = (delta: number) => `/agenda?date=${addCalendarDays(inicioSemana, delta)}&vista=semana${sufixoFiltro}`;
    // Só quem tem jornada ativa entra no filtro — cadastro sem jornada não
    // tem semana para mostrar.
    const equipeNome = equipeBruta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p) => ((p.schedules ?? []) as any[]).some((j) => j.active) || p.id === filtroId)
      .map((p) => ({ id: p.id as string, nome: (rotulos.get(p.id) ?? p.name) as string }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return (
      <div className="relative">
        <PageHeader
          eyebrow="Hoje"
          title="Agenda"
          description={`Semana de ${rotuloSemana}${filtrado ? ` · ${filtrado.nome}` : ""}`}
          action={
            <>
              {alternarVista}
              <Link href={`/agenda/novo?date=${selectedDate >= today ? selectedDate : today}${filtroId && filtroId !== SEM_PROFISSIONAL ? `&prof=${filtroId}` : ""}`} className={buttonClasses()}>
                Novo agendamento
              </Link>
            </>
          }
        />
        <RealtimeRefresh tables={["appointment", "appointment_service"]} />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Link href={nav(-7)} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Semana anterior">
              ←
            </Link>
            <Link href={`/agenda?date=${today}&vista=semana${sufixoFiltro}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Esta semana
            </Link>
            <Link href={nav(7)} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Próxima semana">
              →
            </Link>
          </div>
          {escopo.equipe && (
          <nav aria-label="Filtrar por profissional" className="flex flex-wrap gap-1">
            {[{ id: "", nome: "Equipe inteira" }, ...(eu ? [{ id: "eu", nome: "Minha agenda" }] : []), ...equipeNome].map((p) => {
              const ativo = p.id === "" ? !prof : prof === p.id || (p.id === "eu" && prof === "eu");
              return (
                <Link
                  key={p.id || "todos"}
                  href={`/agenda?date=${selectedDate}&vista=semana${p.id ? `&prof=${p.id}` : ""}`}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "rounded-sm px-2.5 py-1.5 text-caption transition-colors duration-micro",
                    ativo ? "bg-foreground text-background" : "text-muted hover:text-foreground hover:bg-surface"
                  )}
                >
                  {p.nome}
                </Link>
              );
            })}
          </nav>
          )}
        </div>
        <SemanaDaAgenda
          companyId={current!.company.id}
          unitId={unit.id}
          inicioSemana={inicioSemana}
          hoje={today}
          profissionalId={somenteDe ?? filtroId ?? null}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <PageHeader
        eyebrow="Hoje"
        title="Agenda"
        description={
          unit
            ? formatBusinessDayLabel(selectedDate, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })
            : undefined
        }
        action={
          <>
            {unit && alternarVista}
            <Link
              href={`/agenda/novo?date=${selectedDate >= today ? selectedDate : today}${filtroId && filtroId !== SEM_PROFISSIONAL ? `&prof=${filtroId}` : ""}`}
              className={buttonClasses()}
            >
              Novo agendamento
            </Link>
          </>
        }
      />

      {unit && <RealtimeRefresh tables={["appointment", "appointment_service"]} />}

      {unit && (
        // KPIs são leitura do dia, não controle da lista — mais respiro aqui
        // separa "o que aconteceu" de "o que eu estou operando" abaixo (R-B7).
        <StatGrid className="mb-8">
          <StatTile label="Aguardando" value={counts.aguardando} tone="warning" />
          <StatTile label="Em atendimento" value={counts.emAtendimento} tone="signal" />
          <StatTile label={selectedDate === today ? "Restantes hoje" : "Restantes"} value={counts.restantes} tone="neutral" />
          <StatTile label="Concluídos" value={counts.concluidos} tone="success" />
        </StatGrid>
      )}

      <DateWindowNav selectedDate={selectedDate} today={today} carga={cargaPorDia} sufixo={sufixoFiltro} />

      {unit && escopo.equipe && equipeDoDia.length > 0 && (
        <EquipeDoDia
          equipe={equipeDoDia}
          selecionado={filtroId ?? null}
          euId={eu?.id ?? null}
          date={selectedDate}
          filtrado={filtrado?.nome ?? null}
        />
      )}

      {unit && aguardandoConfirmacao.length > 0 && (
        <Aviso tom="atencao" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {pendentesDeConfirmacao} agendamento{pendentesDeConfirmacao > 1 ? "s" : ""} para {dayLabel} aguardando
              confirmação
            </span>
            <div className="flex flex-wrap gap-2 shrink-0">
              {somentePendentes ? (
                <Link href={`/agenda?date=${selectedDate}${sufixoFiltro}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                  Ver todos
                </Link>
              ) : (
                // P0 (revisão visual) — havia um segundo CTA "Enviar
                // lembretes" apontando para este mesmo link: o rótulo
                // prometia um envio em massa que a V1 deliberadamente não
                // faz (cada WhatsApp é aberto e enviado por uma pessoa, um
                // de cada vez). Removido em vez de mantido com um rótulo
                // que não descreve a ação real.
                <Link
                  href={`/agenda?date=${selectedDate}&pendentes=1${sufixoFiltro}`}
                  className={buttonClasses({ variant: "primary", size: "sm" })}
                >
                  Ver pendentes
                </Link>
              )}
            </div>
          </div>
        </Aviso>
      )}

      {!unit ? (
        <Surface>
          <Vazio
            titulo="Cadastre uma unidade primeiro"
            descricao="A agenda organiza os horários por unidade — crie a primeira para começar a marcar atendimentos."
          />
        </Surface>
      ) : (
        <>
          {somentePendentes && (
            <p className="text-caption text-muted mb-3">
              Mostrando só quem está aguardando confirmação. Cada WhatsApp abre separadamente — nunca é
              enviado em massa automaticamente.
            </p>
          )}
          <Surface>
          {rows.length > 0 ? (
            rows.map((l, i) => {
              const status = l.appointment?.status as AppointmentStatus;
              const inicio = new Date(l.starts_at).getTime();
              // Duração já vem da própria query (l.ends_at) — só não era
              // exibida ainda. Nenhum dado novo, só completar o CONTEXTO
              // (horário) com o que falta nele.
              const fim = l.ends_at ? new Date(l.ends_at).getTime() : null;
              const duracaoMin = fim ? Math.round((fim - inicio) / 60000) : null;
              const isPast = inicio < nowMs;
              const isLate = isPast && (status === "scheduled" || status === "confirmed");
              const emCurso = status === "in_progress";
              const aguardando = status === "arrived";
              const encerrado = status === "completed" || status?.startsWith("cancelled") || status === "no_show";

              // A linha do agora entra UMA vez, imediatamente antes do primeiro
              // horário que ainda não passou — é o que responde "onde estou no
              // dia" sem precisar ler hora por hora. Só faz sentido no dia de
              // hoje: em outra data não existe "agora" na lista.
              const marcaAgora =
                selectedDate === today &&
                inicio >= nowMs &&
                (i === 0 || new Date(rows[i - 1].starts_at).getTime() < nowMs);

              return (
                <Fragment key={l.id}>
                  {marcaAgora && <LinhaDoAgora hora={formatBusinessTime(new Date(nowMs).toISOString())} />}
                  <SurfaceRow
                    className={cn(
                      "group flex items-center justify-between gap-4 flex-wrap transition-opacity duration-normal ease-standard hover:bg-surface-muted",
                      // O que já terminou recua, mas não some: continua legível
                      // para conferência, sem competir com o que ainda vai
                      // acontecer.
                      encerrado && "opacity-55"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Trilho: os dois estados que pedem ação agora — em
                          atendimento e aguardando — ganham reforço lateral;
                          o resto fica neutro. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "w-0.5 self-stretch shrink-0 rounded-full",
                          emCurso ? "bg-signal" : aguardando ? "bg-warning" : "bg-transparent"
                        )}
                      />
                      <div className="w-14 shrink-0">
                        <div
                          className={cn(
                            "text-body-sm tabular-nums",
                            emCurso
                              ? "text-foreground font-medium"
                              : isLate
                                ? "text-danger-ink font-medium"
                                : isPast
                                  ? "text-muted"
                                  : "text-foreground"
                          )}
                        >
                          {formatBusinessTime(l.starts_at)}
                          {/* A cor comunica o atraso pra quem vê; quem usa
                              leitor de tela precisa da palavra. */}
                          {isLate && <span className="sr-only"> — atrasado</span>}
                        </div>
                        {duracaoMin !== null && (
                          <div className="text-caption text-muted tabular-nums">
                            {formatMinutes(duracaoMin)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {l.appointment?.client?.name ?? "Cliente"}
                        </p>
                        <p className="text-caption text-muted mt-0.5 truncate">
                          {l.service?.name} · {l.professional?.name}
                          {/* Preço vigente do serviço (service.default_price),
                              não um valor congelado no agendamento — a tabela
                              appointment_service não guarda preço; o valor
                              cobrado de fato só existe depois que o
                              atendimento começa (attendance_item, via
                              trigger). Ver relatório do BLOCO 2. */}
                          {typeof l.service?.default_price === "number" && (
                            <> · {formatCurrency(l.service.default_price)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap justify-end gap-2 min-w-0 shrink">
                      <EstadoDoHorario status={status} />
                      {status === "scheduled" && (
                        <WhatsAppConfirmAction
                          phone={l.appointment?.client?.phone ?? null}
                          clientName={l.appointment?.client?.name ?? "Cliente"}
                          companyName={current!.company.name}
                          dayLabel={dayLabel}
                          time={formatBusinessTime(l.starts_at)}
                          serviceName={l.service?.name ?? "serviço"}
                        />
                      )}
                      <StatusActions
                        appointmentId={l.appointment?.id}
                        podeReagendar={!isPast}
                        status={status}
                        clientName={l.appointment?.client?.name ?? "Cliente"}
                        time={formatBusinessTime(l.starts_at)}
                        serviceName={l.service?.name ?? "serviço"}
                      />
                    </div>
                  </SurfaceRow>
                </Fragment>
              );
            })
          ) : (
            <Vazio
              titulo={
                somentePendentes
                  ? "Nenhum atendimento aguardando confirmação"
                  : filtrado
                    ? `Nada marcado para ${filtrado.nome} neste dia`
                    : "Nenhum agendamento para este dia"
              }
              descricao={
                somentePendentes
                  ? "Todos os agendamentos deste dia já foram confirmados."
                  : "Escolha outra data acima ou crie um novo agendamento."
              }
            />
          )}
          </Surface>
        </>
      )}
    </div>
  );
}

/**
 * Botão de WhatsApp por linha — só aparece para quem ainda está
 * "aguardando confirmação" (status scheduled). V1 não usa API oficial: só
 * abre wa.me com a mensagem pronta, quem decide enviar é sempre uma
 * pessoa. Sem telefone válido, mostra um aviso discreto em vez do botão —
 * nunca finge um link que não abre nada.
 */
function WhatsAppConfirmAction({
  phone,
  clientName,
  companyName,
  dayLabel,
  time,
  serviceName,
}: {
  phone: string | null;
  clientName: string;
  companyName: string;
  dayLabel: string;
  time: string;
  serviceName: string;
}) {
  const message = buildConfirmationMessage({ clientName, companyName, dayLabel, time, serviceName });
  const url = whatsAppUrl(phone, message);

  if (!url) {
    return <span className="text-caption text-muted">Sem WhatsApp</span>;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
      WhatsApp
    </a>
  );
}

/**
 * A marca do agora.
 *
 * Um fio fino atravessando a lista, com a hora presa nele. É o mesmo gesto do
 * calendário de parede com a régua do dia: não pisca, não anima, não compete
 * com o conteúdo — só diz, sem que ninguém precise procurar, até onde o dia
 * já andou.
 *
 * Azul, não amarelo (R23.1): isto é orientação temporal — informação, não
 * ação — e é exatamente o trabalho que a cor de função faz no sistema. O
 * amarelo continua reservado para "em atendimento agora", que é estado
 * operacional, não relógio.
 *
 * Fora do dia de hoje ela não é renderizada: "agora" não existe em 12 de
 * outubro.
 */
function LinhaDoAgora({ hora }: { hora: string }) {
  return (
    <div aria-hidden="true" className="relative flex items-center gap-2.5 px-4 py-1.5">
      <span className="size-1.5 bg-accent shrink-0" />
      <span className="text-micro uppercase tracking-label text-accent font-semibold shrink-0 tabular-nums">
        agora · {hora}
      </span>
      <span className="h-px flex-1 bg-brand-blue/40" />
    </div>
  );
}


function StatusActions({
  appointmentId,
  podeReagendar,
  status,
  clientName,
  time,
  serviceName,
}: {
  appointmentId: string;
  podeReagendar: boolean;
  status: AppointmentStatus;
  clientName: string;
  time: string;
  serviceName: string;
}) {
  if (status === "completed" || status.startsWith("cancelled") || status === "no_show") {
    return null;
  }

  const nextStatus: AppointmentStatus | null =
    status === "scheduled"
      ? "confirmed"
      : status === "confirmed"
        ? "arrived"
        : status === "arrived"
          ? "in_progress"
          : null;

  const nextLabel =
    nextStatus === "confirmed"
      ? "Confirmar"
      : nextStatus === "arrived"
        ? "Cliente chegou"
        : nextStatus === "in_progress"
          ? "Iniciar atendimento"
          : null;

  const nextLabelPendente =
    nextStatus === "confirmed"
      ? "Confirmando…"
      : nextStatus === "arrived"
        ? "Registrando…"
        : nextStatus === "in_progress"
          ? "Iniciando…"
          : undefined;

  const contexto = `${clientName} · ${time} · ${serviceName}`;

  return (
    // Em 390px os três botões somam ~363px e o grupo tinha `shrink-0`: não
    // encolhia nem quebrava, e empurrava 49px para fora da tela — a Agenda
    // rolava de lado no celular, que é onde ela mais é usada. Deixar quebrar
    // resolve sem esconder ação nenhuma.
    <div className="flex flex-wrap justify-end gap-2">
      {nextStatus && (
        <form
          action={async () => {
            "use server";
            if (nextStatus === "in_progress") {
              await startAttendanceFromAppointment(appointmentId);
            } else {
              await updateAppointmentStatus(appointmentId, nextStatus);
            }
          }}
        >
          {/* Ação primária do fluxo: sempre visível, nunca contextual —
              é o próximo passo esperado desta linha. */}
          <BotaoDeAcao
            size="sm"
            variant={nextStatus === "arrived" ? "primary" : "secondary"}
            rotuloPendente={nextLabelPendente}
          >
            {nextLabel}
          </BotaoDeAcao>
        </form>
      )}
      {/*
        Ações secundárias (cancelar/não compareceu): em ponteiro fino
        (mouse/trackpad) só aparecem no hover da linha ou quando o foco do
        teclado entra no grupo — em toque, onde hover não existe, permanecem
        sempre visíveis exatamente como antes (R-B7). group-focus-within
        garante que Tab nunca esconde uma ação de quem navega por teclado.
      */}
      <div
        className={cn(
          "flex flex-wrap justify-end gap-2 opacity-100 transition-opacity duration-fast ease-standard",
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
        )}
      >
        {podeReagendar && (status === "scheduled" || status === "confirmed") && (
          <Link
            href={`/agenda/${appointmentId}/reagendar`}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Reagendar
          </Link>
        )}
        <ConfirmButton
          label="Cancelar"
          confirmTitle="Cancelar agendamento?"
          confirmDescription={`${contexto}. O cliente será marcado como cancelado pela empresa. Essa ação não pode ser desfeita.`}
          confirmLabel="Cancelar agendamento"
          onConfirm={async () => {
            "use server";
            await updateAppointmentStatus(appointmentId, "cancelled_by_company");
          }}
        />
        <ConfirmButton
          label="Não compareceu"
          confirmTitle="Marcar como não compareceu?"
          confirmDescription={contexto}
          onConfirm={async () => {
            "use server";
            await updateAppointmentStatus(appointmentId, "no_show");
          }}
        />
      </div>
    </div>
  );
}


/**
 * A equipe do dia — quem trabalha hoje e quanto da jornada já está marcado.
 *
 * É também o filtro da lista: tocar num nome mostra só a agenda dele. A barra
 * é proporção de tempo (jornada ∩ funcionamento − intervalos, a mesma janela
 * do motor de disponibilidade), não uma meta: 100% quer dizer "não cabe mais
 * nada", não "ótimo".
 */
function EquipeDoDia({
  equipe,
  selecionado,
  euId,
  date,
  filtrado,
}: {
  equipe: { id: string; nome: string; ocupacao: { jornadaMin: number; ocupadoMin: number; livreMin: number; pct: number | null }; atendimentos: number }[];
  selecionado: string | null;
  euId: string | null;
  date: string;
  filtrado: string | null;
}) {
  return (
    <section aria-label="Equipe do dia" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-label uppercase text-muted">
          Equipe {filtrado ? `· mostrando ${filtrado}` : "do dia"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {euId && (
            <Link
              href={`/agenda?date=${date}&prof=eu`}
              aria-current={selecionado === euId ? "page" : undefined}
              className={buttonClasses({ variant: selecionado === euId ? "primary" : "secondary", size: "sm" })}
            >
              Minha agenda
            </Link>
          )}
          {selecionado && (
            <Link href={`/agenda?date=${date}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Ver todos
            </Link>
          )}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {equipe.map((p) => {
          const ativo = p.id === selecionado;
          const pct = p.ocupacao.pct ?? 0;
          return (
            <li key={p.id} className="rounded-md border border-border bg-surface overflow-hidden">
              <Link
                href={ativo ? `/agenda?date=${date}` : `/agenda?date=${date}&prof=${p.id}`}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "alvo-toque block px-4 py-3 transition-colors duration-fast ease-standard hover:bg-surface-muted",
                  ativo && "bg-surface-muted"
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-body-sm font-medium text-foreground truncate">
                    {ativo && <span aria-hidden="true" className="inline-block size-1.5 bg-signal mr-2 align-middle" />}
                    {p.nome}
                  </span>
                  <span className="text-caption text-muted tabular-nums shrink-0">
                    {p.ocupacao.jornadaMin > 0
                      ? p.ocupacao.livreMin > 0
                        ? `${formatarDuracao(p.ocupacao.livreMin)} livre`
                        : "sem horário livre"
                      : "sem jornada"}
                  </span>
                </span>
                <span
                  className="mt-2 block h-1 w-full bg-surface-muted"
                  role="img"
                  aria-label={
                    p.ocupacao.pct === null
                      ? `${p.atendimentos} atendimento(s), sem jornada neste dia`
                      : `${pct}% da jornada ocupada, ${p.atendimentos} atendimento(s)`
                  }
                >
                  <span
                    className={cn(
                      "block h-full origin-left animate-crescer motion-reduce:animate-none",
                      pct >= 90 ? "bg-warning" : "bg-signal"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
