import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
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
      <p className="text-sm text-[var(--color-otan-red)]">
        Cadastre uma unidade antes de criar agendamentos.
      </p>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl mb-6">Novo agendamento</h1>
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
