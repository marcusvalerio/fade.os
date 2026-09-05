import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import NewAppointmentForm from "./NewAppointmentForm";

export default async function NovoAgendamentoPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const [{ data: unit }, { data: clients }, { data: professionals }, { data: services }] =
    await Promise.all([
      supabase
        .from("unit")
        .select("id")
        .eq("company_id", current!.company.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase.from("client").select("id, name").eq("company_id", current!.company.id).order("name"),
      supabase
        .from("professional")
        .select("id, name")
        .eq("company_id", current!.company.id)
        .eq("active", true)
        .order("name"),
      supabase.from("service").select("id, name").eq("company_id", current!.company.id).order("name"),
    ]);

  if (!unit) {
    return (
      <Surface>
        <EmptyState
          title="Cadastre uma unidade primeiro"
          description="Agendamentos precisam de uma unidade para acontecer."
        />
      </Surface>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-page-title text-foreground mb-6">Novo agendamento</h1>
      <NewAppointmentForm
        companyId={current!.company.id}
        unitId={unit.id}
        clients={clients ?? []}
        professionals={professionals ?? []}
        services={services ?? []}
      />
    </div>
  );
}
