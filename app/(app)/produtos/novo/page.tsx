import { createProductAndRedirect } from "@/actions/produtos";
import { getCurrentCompany } from "@/lib/current-company";
import { createClient } from "@/lib/supabase/server";
import { ContextoDaTela } from "@/components/ui/formulario";
import { ProductForm } from "../ProductForm";

export default async function NovoProdutoPage() {
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
        titulo="Novo produto"
        descricao="O que a barbearia revende. Depois de salvo, aparece no PDV e passa a ter estoque controlado."
      />
      <ProductForm
        action={createProductAndRedirect}
        companyId={current!.company.id}
        unidades={units ?? []}
        modo="novo"
      />
    </div>
  );
}
