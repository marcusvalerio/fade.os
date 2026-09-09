import Link from "next/link";
import { getPublicAppointment } from "@/actions/public";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { formatBusinessDate, formatBusinessTime } from "@/lib/time";
import { CancelAppointmentButton } from "./CancelAppointmentButton";
import type { AppointmentStatus } from "@/lib/types";

export const revalidate = 0;

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled_by_client: "Cancelado por você",
  cancelled_by_company: "Cancelado pela barbearia",
  no_show: "Não compareceu",
};

const CANCELLABLE_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed"];

export default async function MeuAgendamentoPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const result = await getPublicAppointment(token);
  const appointment = result.ok ? result.data : null;

  if (!appointment) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="Agendamento não encontrado"
          description="Verifique o link recebido na confirmação, ou volte para a barbearia."
          action={
            <Link href={`/${slug}`} className={buttonClasses({ variant: "secondary" })}>
              Voltar para a barbearia
            </Link>
          }
        />
      </div>
    );
  }

  // Esta página é renderizada no servidor: sem fuso explícito ela mostrava o
  // relógio do servidor (UTC), então o cliente que marcou 15:00 recebia um
  // link dizendo 18:00.
  const startsAt = new Date(appointment.starts_at);
  const dateLabel = formatBusinessDate(startsAt, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeLabel = formatBusinessTime(startsAt);
  const durationMinutes = Math.round(
    (new Date(appointment.ends_at).getTime() - startsAt.getTime()) / 60000
  );
  const canCancel = CANCELLABLE_STATUSES.includes(appointment.status);

  return (
    <div className="shell max-w-xl py-8 sm:py-12 animate-fade-in">
      <p className="text-body-sm text-muted mb-1">{appointment.company_name}</p>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-page-title text-foreground">Seu agendamento</h1>
        <Badge tone={canCancel ? "info" : "neutral"}>{STATUS_LABELS[appointment.status]}</Badge>
      </div>

      <div className="rounded-md border border-border bg-surface p-5 space-y-2.5">
        <SummaryRow label="Serviço" value={appointment.service_name} />
        <SummaryRow label="Profissional" value={appointment.professional_name} />
        <SummaryRow label="Data" value={dateLabel} />
        <SummaryRow label="Horário" value={timeLabel} />
        <SummaryRow label="Duração" value={formatMinutes(durationMinutes)} />
        <SummaryRow label="Preço" value={formatCurrency(appointment.price)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        {canCancel && <CancelAppointmentButton token={token} />}
        <Link href={`/${slug}`} className={buttonClasses({ variant: "secondary" })}>
          Voltar para a barbearia
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-body-sm text-muted">{label}</span>
      <span className="text-body-sm text-foreground font-medium text-right">{value}</span>
    </div>
  );
}
