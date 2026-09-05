import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { updateAppointmentStatus } from "@/actions/agenda";
import { startAttendanceFromAppointment } from "@/actions/atendimento";
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl">Agenda {unit ? `· ${unit.name}` : ""}</h1>
        <Link
          href="/agenda/novo"
          className="bg-[var(--color-cobblestone)] text-white text-sm px-4 py-2 rounded-md"
        >
          Novo agendamento
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="date"
          name="date"
          defaultValue={selectedDate}
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
        />
      </form>

      {!unit && (
        <p className="text-sm text-[var(--color-otan-red)]">
          Nenhuma unidade cadastrada ainda.
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {lines && lines.length > 0 ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lines.map((l: any) => (
            <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="text-sm">
                <p className="font-medium">
                  {new Date(l.starts_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  – {l.service?.name} com {l.professional?.name}
                </p>
                <p className="text-xs text-[var(--color-midnight-smoke)]">
                  {l.appointment?.client?.name} ·{" "}
                  {STATUS_LABEL[l.appointment?.status as AppointmentStatus]}
                </p>
              </div>
              <StatusActions appointmentId={l.appointment?.id} status={l.appointment?.status} />
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
            Nenhum agendamento para este dia.
          </p>
        )}
      </div>
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
          <button className="text-xs px-3 py-1 rounded-full bg-[var(--color-cobblestone)] text-white">
            {nextStatus === "confirmed" ? "Confirmar" : "Iniciar atendimento"}
          </button>
        </form>
      )}
      <form
        action={async () => {
          "use server";
          await updateAppointmentStatus(appointmentId, "cancelled_by_company");
        }}
      >
        <button className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
          Cancelar
        </button>
      </form>
      <form
        action={async () => {
          "use server";
          await updateAppointmentStatus(appointmentId, "no_show");
        }}
      >
        <button className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
          No-show
        </button>
      </form>
    </div>
  );
}
