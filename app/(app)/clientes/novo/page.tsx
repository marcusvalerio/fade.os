import { createClientRecord } from "@/actions/clientes";
import { getCurrentCompany } from "@/lib/current-company";
import { ContextoDaTela } from "@/components/ui/formulario";
import { ClientForm } from "../ClientForm";

export default async function NovoClientePage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-xl">
      <ContextoDaTela
        titulo="Novo cliente"
        descricao="Só o nome é obrigatório. O telefone é o que permite encontrar essa pessoa depois na busca e no agendamento."
      />
      <ClientForm action={createClientRecord} companyId={current!.company.id} modo="novo" />
    </div>
  );
}
