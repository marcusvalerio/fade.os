import { createServiceRecord } from "@/actions/servicos";
import { getCurrentCompany } from "@/lib/current-company";
import { ServiceForm } from "../ServiceForm";

export default async function NovoServicoPage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-md">
      <h1 className="text-page-title text-foreground mb-6">Novo serviço</h1>
      <ServiceForm modo="novo" action={createServiceRecord} companyId={current!.company.id} />
    </div>
  );
}
