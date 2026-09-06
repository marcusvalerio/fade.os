import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { BlocksPanel } from "./BlocksPanel";
import { AbsencesPanel } from "./AbsencesPanel";
import type {
  Professional,
  ProfessionalSchedule,
  ProfessionalScheduleBreak,
  ProfessionalBlock,
  ProfessionalAbsence,
} from "@/lib/types";

export default async function JornadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from("professional")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!professional) notFound();

  const { data: schedules } = await supabase
    .from("professional_schedule")
    .select("*")
    .eq("professional_id", id)
    .order("weekday");

  const scheduleIds = (schedules ?? []).map((s) => s.id);

  const { data: breaks } = scheduleIds.length
    ? await supabase.from("professional_schedule_break").select("*").in("schedule_id", scheduleIds)
    : { data: [] };

  const { data: blocks } = await supabase
    .from("professional_block")
    .select("*")
    .eq("professional_id", id)
    .order("starts_at", { ascending: false });

  const { data: absences } = await supabase
    .from("professional_absence")
    .select("*")
    .eq("professional_id", id)
    .order("starts_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-10">
      <PageHeader
        title={`Jornada · ${(professional as Professional).name}`}
        description="Isso alimenta diretamente o motor de disponibilidade — o que estiver aqui é exatamente o que decide quais horários existem."
        action={
          <Link href={`/profissionais/${id}`} className="text-body-sm text-primary hover:underline">
            Voltar ao profissional
          </Link>
        }
      />

      <section>
        <h2 className="text-section-title text-foreground mb-1">Jornada semanal</h2>
        <p className="text-body-sm text-muted mb-3">Dias e horários em que atende, com intervalos.</p>
        <WeeklyScheduleEditor
          professionalId={id}
          schedules={(schedules ?? []) as ProfessionalSchedule[]}
          breaks={(breaks ?? []) as ProfessionalScheduleBreak[]}
        />
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-1">Bloqueios</h2>
        <p className="text-body-sm text-muted mb-3">Compromissos pontuais que tiram um horário da agenda.</p>
        <BlocksPanel professionalId={id} blocks={(blocks ?? []) as ProfessionalBlock[]} />
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-1">Ausências</h2>
        <p className="text-body-sm text-muted mb-3">Férias, folgas e afastamentos.</p>
        <AbsencesPanel professionalId={id} absences={(absences ?? []) as ProfessionalAbsence[]} />
      </section>
    </div>
  );
}
