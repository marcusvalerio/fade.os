import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { updateAppointmentStatus } from "@/actions/agenda";
import { startAttendanceFromAppointment } from "@/actions/atendimento";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/field";
import type { AppointmentStatus } from "@/lib/types";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled_by_client: "Cancelado pelo cliente",
  cancelled_by_company: "Cancelado pela empresa",
  no_show: "Não compareceu",
};

const STATUS_TONE: Record<AppointmentStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  scheduled: "info",
  confirmed: "info",
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
  const selectedDate = date ?? new Date().toISOString().slice(0, 10);
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("unit")
    .select("id, name")
    .eq("company_id", current!.company.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const dayStart = `${selectedDate}T00:00:00`;
  const dayEnd = `${selectedDate}T23:59:59`;

  const { data: lines } = unit
    ? await supabase
        .from("appointment_service")
        .select(
          "id, starts_at, ends_at, service:service_id(name), professional:professional_id(name), appointment:appointment_id(id, status, client:client_id(name))"
        )
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd)
        .order("starts_at")
    : { data: [] };

  return (
    <div>
      <PageHeader
        title={unit ? `Agenda · ${unit.name}` : "Agenda"}
        action={
          <Link href="/agenda/novo" className={buttonClasses()}>
            Novo agendamento
          </Link>
        }
      />

      <form className="mb-5">
        <Input type="date" name="date" defaultValue={selectedDate} className="w-auto" />
      </form>

      {!unit ? (
        <Surface>
          <EmptyState
            title="Cadastre uma unidade primeiro"
            description="A agenda organiza os horários por unidade — crie a primeira para começar a marcar atendimentos."
          />
        </Surface>
      ) : (
        <Surface>
          {lines && lines.length > 0 ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lines.map((l: any) => (
              <SurfaceRow key={l.id} className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-body-sm">
                  <p className="font-medium text-foreground">
                    {new Date(l.starts_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    – {l.service?.name} com {l.professional?.name}
                  </p>
                  <p className="text-caption text-muted mt-0.5">{l.appointment?.client?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[l.appointment?.status as AppointmentStatus]}>
                    {STATUS_LABEL[l.appointment?.status as AppointmentStatus]}
                  </Badge>
                  <StatusActions appointmentId={l.appointment?.id} status={l.appointment?.status} />
                </div>
              </SurfaceRow>
            ))
          ) : (
            <EmptyState
              title="Nenhum agendamento para este dia"
              description="Escolha outra data acima ou crie um novo agendamento."
            />
          )}
        </Surface>
      )}
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
    status === "scheduled" ? "confirmed" : status === "confirmed" ? "in_progress" : null;

  return (
    <div className="flex gap-2">
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
          <Button type="submit" size="sm">
            {nextStatus === "confirmed" ? "Confirmar" : "Iniciar atendimento"}
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
