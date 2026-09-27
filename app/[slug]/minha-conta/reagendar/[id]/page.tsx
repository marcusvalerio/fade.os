import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/tenancy";
import { meusAgendamentos } from "@/actions/cliente";
import { addCalendarDays, businessDate, businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { Aviso } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { ReagendarMeuHorario } from "./ReagendarMeuHorario";

export const metadata: Metadata = { title: "Mudar horário" };
export const dynamic = "force-dynamic";

/** Mudar o próprio horário: só Agendado ou Confirmado, só na conta de quem marcou. */
export default async function ReagendarMeuHorarioPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!(await getSessionUser())) redirect(`/${slug}/entrar`);

  const lista = await meusAgendamentos(slug);
  const horario = lista.ok ? lista.data.find((a) => a.appointment_id === id) : undefined;
  const hoje = businessToday();

  if (!horario || !["scheduled", "confirmed"].includes(horario.status) || new Date(horario.starts_at).getTime() <= Date.now()) {
    return (
      <div className="shell py-12 sm:py-16">
        <div className="mx-auto max-w-lg space-y-5">
          <Aviso tom="atencao" titulo="Este horário não pode ser mudado por aqui">
            Só dá para mudar um horário agendado ou confirmado que ainda não começou. Para outros casos, fale com a barbearia.
          </Aviso>
          <Link href={`/${slug}/minha-conta`} className={buttonClasses({ variant: "secondary" })}>
            Voltar para meus horários
          </Link>
        </div>
      </div>
    );
  }

  const diaAtual = businessDate(horario.starts_at);
  const dias = Array.from({ length: 21 }, (_, i) => addCalendarDays(hoje, i));

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Mudar horário</p>
        <h1 className="text-page-title text-foreground mt-3">{horario.services}</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2">
          Hoje marcado para {formatBusinessDayLabel(diaAtual, { weekday: "long", day: "numeric", month: "long" })}, às{" "}
          {formatBusinessTime(horario.starts_at)}, com {horario.professional_name}.
        </p>
        <div className="painel p-5 sm:p-6 mt-8">
          <ReagendarMeuHorario
            slug={slug}
            appointmentId={id}
            diaInicial={diaAtual >= hoje ? diaAtual : hoje}
            hoje={hoje}
            dias={dias}
          />
        </div>
        <Link href={`/${slug}/minha-conta`} className="inline-block mt-6 text-body-sm text-muted hover:text-foreground">
          ← Voltar sem mudar
        </Link>
      </div>
    </div>
  );
}
