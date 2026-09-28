import { createConsumableAndRedirect } from "@/actions/materiais";
import { getCurrentCompany } from "@/lib/current-company";
import { createClient } from "@/lib/supabase/server";
import { MaterialForm } from "../MaterialForm";

export default async function NovoMaterialPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("unit")
    .select("id, name")
    .eq("company_id", current!.company.id)
    .order("created_at");

  return (
    <div className="max-w-md">
      <h1 className="text-page-title text-foreground mb-6">Novo material de consumo</h1>
      <MaterialForm
        modo="novo"
        action={createConsumableAndRedirect}
        companyId={current!.company.id}
        unidades={units ?? []}
      />
    </div>
  );
}
