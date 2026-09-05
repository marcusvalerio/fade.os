import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import NewWalkInForm from "./NewWalkInForm";

export default async function NovoAtendimentoPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const [{ data: unit }, { data: clients }] = await Promise.all([
    supabase
      .from("unit")
      .select("id")
      .eq("company_id", current!.company.id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("client").select("id, name").eq("company_id", current!.company.id).order("name"),
  ]);

  if (!unit) {
    return (
      <p className="text-sm text-[var(--color-otan-red)]">
        Cadastre uma unidade antes de registrar atendimentos.
      </p>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl mb-6">Novo atendimento (walk-in)</h1>
      <NewWalkInForm companyId={current!.company.id} unitId={unit.id} clients={clients ?? []} />
    </div>
  );
}
