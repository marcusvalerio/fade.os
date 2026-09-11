import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { Surface } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { ContextoDaTela } from "@/components/ui/formulario";
import NewWalkInForm from "./NewWalkInForm";
import { rotularHomonimos } from "@/lib/pessoas";

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
    supabase
      .from("client")
      .select("id, name, phone, email")
      .eq("company_id", current!.company.id)
      .order("name"),
  ]);

  if (!unit) {
    return (
      <Surface>
        <Vazio
          titulo="Cadastre uma unidade primeiro"
          descricao="Atendimentos precisam de uma unidade para acontecer."
        />
      </Surface>
    );
  }

  return (
    <div className="max-w-md">
      <ContextoDaTela
        titulo="Novo atendimento"
        descricao="Para quem chegou sem agendamento — o walk-in."
      />
      <NewWalkInForm companyId={current!.company.id} unitId={unit.id} clients={rotularHomonimos(clients ?? [])} />
    </div>
  );
}
