import { createProfessionalAndRedirect } from "@/actions/profissionais";
import { getCurrentCompany } from "@/lib/current-company";
import { createClient } from "@/lib/supabase/server";
import { ContextoDaTela } from "@/components/ui/formulario";
import { ProfessionalForm } from "../ProfessionalForm";

export default async function NovoProfissionalPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("unit")
    .select("id, name")
    .eq("company_id", current!.company.id)
    .order("created_at");

  return (
    <div className="max-w-xl">
      <ContextoDaTela
        titulo="Novo profissional"
        descricao="Quem realiza os atendimentos. Depois de salvo, você vincula os serviços que ele executa e a jornada dele."
      />
      <ProfessionalForm
        action={createProfessionalAndRedirect}
        companyId={current!.company.id}
        unidades={units ?? []}
        modo="novo"
      />
    </div>
  );
}
