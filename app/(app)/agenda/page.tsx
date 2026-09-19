import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { updateAppointmentStatus } from "@/actions/agenda";
import { startAttendanceFromAppointment } from "@/actions/atendimento";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Vazio, Aviso } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { DateWindowNav } from "./DateWindowNav";
import { businessDayBounds, businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
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

const STATUS_TONE: Record<AppointmentStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  scheduled: "neutral",
  confirmed: "info",
  arrived: "warning",
  in_progress: "warning",
  completed: "success",
  cancelled_by_client: "neutral",
  cancelled_by_company: "neutral",
  no_show: "danger",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; pendentes?: string }>;
}) {
  const { date, pendentes } = await searchParams;
  const somentePendentes = pendentes === "1";
  // "Hoje" é o dia da barbearia. Lido do relógio do servidor (UTC), das 21:00
  // em diante a agenda já abria no dia seguinte.
  const today = businessToday();
  const selectedDate = date ?? today;
  const current = await getCurrentCompany();
  const supabase = await createClient();

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
          "id, starts_at, ends_at, service:service_id(name, default_price), professional:professional_id(name), appointment:appointment_id(id, status, client:client_id(name, phone))"
        )
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .order("starts_at")
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRows = (lines ?? []) as any[];
  const nowMs = Date.now();

  const counts = {
    aguardando: allRows.filter((r) => r.appointment?.status === "arrived").length,
    emAtendimento: allRows.filter((r) => r.appointment?.status === "in_progress").length,
    concluidos: allRows.filter((r) => r.appointment?.status === "completed").length,
    restantes: allRows.filter((r) => ["scheduled", "confirmed"].includes(r.appointment?.status)).length,
  };

  // "Aguardando confirmação" não é um status novo: é o próprio `scheduled`
  // (a equipe ainda não clicou "Confirmar") — ver docs/PUBLIC_BOOKING.md.
  const aguardandoConfirmacao = allRows.filter((r) => r.appointment?.status === "scheduled");
  const rows = somentePendentes ? aguardandoConfirmacao : allRows;
  const dayLabel = relativeDayLabel(selectedDate, today) ??
    formatBusinessDayLabel(selectedDate, { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="relative">
      <PageHeader
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
          <Link href="/agenda/novo" className={buttonClasses()}>
            Novo agendamento
          </Link>
        }
      />

      {unit && <RealtimeRefresh tables={["appointment", "appointment_service"]} />}

      {unit && (
        // KPIs são leitura do dia, não controle da lista — mais respiro aqui
        // separa "o que aconteceu" de "o que eu estou operando" abaixo (R-B7).
        <StatGrid className="mb-8">
          <StatTile label="Aguardando" value={counts.aguardando} tone="warning" />
          <StatTile label="Em atendimento" value={counts.emAtendimento} tone="signal" />
          <StatTile label="Restantes hoje" value={counts.restantes} tone="neutral" />
          <StatTile label="Concluídos" value={counts.concluidos} tone="success" />
        </StatGrid>
      )}

      <DateWindowNav selectedDate={selectedDate} today={today} />

      {unit && aguardandoConfirmacao.length > 0 && (
        <Aviso tom="atencao" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {aguardandoConfirmacao.length} atendimento{aguardandoConfirmacao.length > 1 ? "s" : ""} para{" "}
              {dayLabel} aguardando confirmação
            </span>
            <div className="flex flex-wrap gap-2 shrink-0">
              {somentePendentes ? (
                <Link href={`/agenda?date=${selectedDate}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
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
                  href={`/agenda?date=${selectedDate}&pendentes=1`}
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
                  {marcaAgora && <LinhaDoAgora />}
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
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
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
              titulo={somentePendentes ? "Nenhum atendimento aguardando confirmação" : "Nenhum agendamento para este dia"}
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
function LinhaDoAgora() {
  return (
    <li aria-hidden="true" className="relative flex items-center gap-2.5 px-4 py-1.5 list-none">
      <span className="size-1.5 rounded-full bg-accent shrink-0" />
      <span className="text-[0.625rem] uppercase tracking-[0.08em] text-accent font-semibold shrink-0">
        agora
      </span>
      <span className="h-px flex-1" style={{ backgroundColor: "var(--brand-blue)", opacity: 0.4 }} />
    </li>
  );
}


function StatusActions({
  appointmentId,
  status,
  clientName,
  time,
  serviceName,
}: {
  appointmentId: string;
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
