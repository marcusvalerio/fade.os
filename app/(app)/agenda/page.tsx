import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { updateAppointmentStatus } from "@/actions/agenda";
import { startAttendanceFromAppointment } from "@/actions/atendimento";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  addCalendarDays,
  businessDayBounds,
  businessToday,
  formatBusinessDayLabel,
  formatBusinessTime,
} from "@/lib/time";
import { cn } from "@/lib/cn";
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
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
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
          "id, starts_at, ends_at, service:service_id(name), professional:professional_id(name), appointment:appointment_id(id, status, client:client_id(name))"
        )
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .order("starts_at")
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (lines ?? []) as any[];
  const nowMs = Date.now();

  const counts = {
    aguardando: rows.filter((r) => r.appointment?.status === "arrived").length,
    emAtendimento: rows.filter((r) => r.appointment?.status === "in_progress").length,
    concluidos: rows.filter((r) => r.appointment?.status === "completed").length,
    restantes: rows.filter((r) => ["scheduled", "confirmed"].includes(r.appointment?.status)).length,
  };

  return (
    <div>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-md overflow-hidden mb-5 animate-rise-in">
          <StatTile label="Aguardando" value={counts.aguardando} tone="warning" />
          <StatTile label="Em atendimento" value={counts.emAtendimento} tone="signal" />
          <StatTile label="Restantes hoje" value={counts.restantes} tone="neutral" />
          <StatTile label="Concluídos" value={counts.concluidos} tone="success" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-5">
        <Link
          href={`/agenda?date=${addCalendarDays(selectedDate, -1)}`}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
          aria-label="Dia anterior"
        >
          ←
        </Link>
        <Link
          href={`/agenda?date=${today}`}
          className={cn(
            buttonClasses({ variant: selectedDate === today ? "primary" : "secondary", size: "sm" })
          )}
        >
          Hoje
        </Link>
        <Link
          href={`/agenda?date=${addCalendarDays(selectedDate, 1)}`}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
          aria-label="Próximo dia"
        >
          →
        </Link>
      </div>

      {!unit ? (
        <Surface>
          <Vazio
            titulo="Cadastre uma unidade primeiro"
            descricao="A agenda organiza os horários por unidade — crie a primeira para começar a marcar atendimentos."
          />
        </Surface>
      ) : (
        <Surface>
          {rows.length > 0 ? (
            rows.map((l, i) => {
              const status = l.appointment?.status as AppointmentStatus;
              const inicio = new Date(l.starts_at).getTime();
              const isPast = inicio < nowMs;
              const isLate = isPast && (status === "scheduled" || status === "confirmed");
              const emCurso = status === "in_progress";
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
                      "flex items-center justify-between gap-4 flex-wrap transition-opacity duration-normal ease-standard",
                      // O que já terminou recua, mas não some: continua legível
                      // para conferência, sem competir com o que ainda vai
                      // acontecer.
                      encerrado && "opacity-55"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Trilho: só o que está em curso ganha o amarelo. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "w-0.5 self-stretch shrink-0 rounded-full",
                          emCurso ? "bg-signal" : "bg-transparent"
                        )}
                      />
                      <div
                        className={cn(
                          "text-body-sm tabular-nums w-12 shrink-0",
                          emCurso ? "text-foreground font-medium" : isPast ? "text-muted" : "text-foreground"
                        )}
                      >
                        {formatBusinessTime(l.starts_at)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {l.appointment?.client?.name ?? "Cliente"}
                        </p>
                        <p className="text-caption text-muted mt-0.5 truncate">
                          {l.service?.name} · {l.professional?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center flex-wrap justify-end gap-2 min-w-0 shrink">
                      {isLate && (
                        <Badge tone="danger" className="hidden sm:inline-flex">
                          atrasado
                        </Badge>
                      )}
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                      <StatusActions appointmentId={l.appointment?.id} status={status} />
                    </div>
                  </SurfaceRow>
                </Fragment>
              );
            })
          ) : (
            <Vazio
              titulo="Nenhum agendamento para este dia"
              descricao="Escolha outra data acima ou crie um novo agendamento."
            />
          )}
        </Surface>
      )}
    </div>
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
 * Fora do dia de hoje ela não é renderizada: "agora" não existe em 12 de
 * outubro.
 */
function LinhaDoAgora() {
  return (
    <li aria-hidden="true" className="relative flex items-center gap-3 px-4 py-1.5 list-none">
      <span className="text-[0.625rem] uppercase tracking-[0.08em] text-signal font-medium shrink-0">
        agora
      </span>
      <span className="h-px flex-1 bg-signal/45" />
    </li>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "signal" | "neutral" | "success";
}) {
  const toneClass =
    tone === "signal"
      ? "text-signal-foreground bg-signal"
      : tone === "warning"
        ? "text-warning bg-surface"
        : tone === "success"
          ? "text-success bg-surface"
          : "text-foreground bg-surface";

  return (
    <div className={cn("px-4 py-3.5", toneClass)}>
      <p className="text-metric font-heading tabular-nums leading-none">{value}</p>
      <p className="text-label uppercase opacity-70 mt-1.5">{label}</p>
    </div>
  );
}

function StatusActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
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
          <Button type="submit" size="sm" variant={nextStatus === "arrived" ? "primary" : "secondary"}>
            {nextLabel}
          </Button>
        </form>
      )}
      <ConfirmButton
        label="Cancelar"
        confirmTitle="Cancelar agendamento?"
        confirmDescription="O cliente será marcado como cancelado pela empresa. Essa ação não pode ser desfeita."
        confirmLabel="Cancelar agendamento"
        onConfirm={async () => {
          "use server";
          await updateAppointmentStatus(appointmentId, "cancelled_by_company");
        }}
      />
      <ConfirmButton
        label="No-show"
        confirmTitle="Marcar como não compareceu?"
        onConfirm={async () => {
          "use server";
          await updateAppointmentStatus(appointmentId, "no_show");
        }}
      />
    </div>
  );
}
