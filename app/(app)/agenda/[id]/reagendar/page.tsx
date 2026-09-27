import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { ContextoDaTela } from "@/components/ui/formulario";
import { Surface } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { businessDate, businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { rotularHomonimos } from "@/lib/pessoas";
import { FormularioReagendar } from "./FormularioReagendar";

/**
 * Mover um horário sem desmarcar e marcar de novo.
 *
 * Só agendado ou confirmado: depois que o cliente chega, o horário já está em
 * uso. O agendamento inteiro anda junto — todos os serviços, na mesma ordem e
 * duração — e o banco (reschedule_appointment) valida como numa criação.
 */
export default async function ReagendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointment")
    .select(
      "id, status, unit_id, company_id, client:client_id(name), lines:appointment_service(id, starts_at, ends_at, service_id, professional_id, service:service_id(name), professional:professional_id(name))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!appointment || appointment.company_id !== current!.company.id) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = ((appointment.lines ?? []) as any[]).sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientName = (appointment.client as any)?.name ?? "Cliente";

  if (!["scheduled", "confirmed"].includes(appointment.status) || lines.length === 0) {
    return (
      <div>
        <ContextoDaTela titulo="Reagendar" />
        <Surface>
          <Vazio
            titulo="Este horário não pode mais ser movido"
            descricao="Só dá para reagendar um horário agendado ou confirmado. Depois que o cliente chega, o horário já está em uso."
          />
        </Surface>
        <Link href="/agenda" className={buttonClasses({ variant: "secondary", className: "mt-4" })}>
          Voltar para a agenda
        </Link>
      </div>
    );
  }

  const serviceIds = lines.map((l) => l.service_id as string);
  const profissionaisDasLinhas = Array.from(new Set(lines.map((l) => l.professional_id as string)));
  const mesmoProfissional = profissionaisDasLinhas.length === 1;

  // Quem faz TODOS os serviços do agendamento — só essas pessoas podem
  // receber o horário inteiro.
  const { data: vinculos } = await supabase
    .from("professional_service")
    .select("service_id, professional:professional_id!inner(id, name, active, company_id, role_title, phone:phone_last4)")
    .in("service_id", serviceIds)
    .eq("professional.company_id", current!.company.id)
    .eq("professional.active", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porProfissional = new Map<string, { prof: any; servicos: Set<string> }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (vinculos ?? []).forEach((v: any) => {
    const entry = porProfissional.get(v.professional.id) ?? { prof: v.professional, servicos: new Set<string>() };
    entry.servicos.add(v.service_id);
    porProfissional.set(v.professional.id, entry);
  });
  const aptos = rotularHomonimos(
    Array.from(porProfissional.values())
      .filter((e) => serviceIds.every((s) => e.servicos.has(s)))
      .map((e) => e.prof)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  ).map((p) => ({ id: p.id as string, name: p.name as string }));

  const inicio = lines[0].starts_at as string;
  const fim = lines[lines.length - 1].ends_at as string;
  const dataAtual = businessDate(inicio);

  return (
    <div>
      <ContextoDaTela
        titulo="Reagendar"
        descricao={`${clientName} · ${lines.map((l) => l.service?.name).join(" + ")}`}
      />
      <div className="grid gap-8 lg:grid-cols-(--grade-trabalho)">
        <FormularioReagendar
          appointmentId={appointment.id}
          companyId={current!.company.id}
          unitId={appointment.unit_id}
          serviceIds={serviceIds}
          profissionais={aptos}
          profissionalAtual={profissionaisDasLinhas[0]}
          mesmoProfissional={mesmoProfissional}
          dataAtual={dataAtual < businessToday() ? businessToday() : dataAtual}
          today={businessToday()}
        />
        <aside className="material-solid rounded-lg p-5 h-fit">
          <p className="text-label uppercase text-muted">Horário atual</p>
          <p className="text-section-title text-foreground mt-1 tabular-nums">
            {formatBusinessTime(inicio)}–{formatBusinessTime(fim)}
          </p>
          <p className="text-body-sm text-muted mt-0.5">
            {formatBusinessDayLabel(dataAtual, { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <ul className="mt-4 space-y-1.5 text-body-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="text-foreground">{l.service?.name}</span>
                <span className="text-muted">{l.professional?.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted mt-4">
            O cliente não é avisado automaticamente. Combine o novo horário com ele — pelo WhatsApp da agenda,
            por exemplo.
          </p>
        </aside>
      </div>
    </div>
  );
}
