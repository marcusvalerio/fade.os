import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Aviso } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { ImportarClientes } from "./ImportarClientes";

export const metadata: Metadata = { title: "Importar clientes" };

export default async function ImportarClientesPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const gerente = await isCompanyManager(companyId);

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Clientes"
        title="Importar clientes"
        description="Traga a sua lista de uma planilha do Excel ou do Google Planilhas. Você confere tudo antes de entrar."
      />
      {gerente ? (
        <ImportarClientes companyId={companyId} />
      ) : (
        <div className="space-y-4">
          <Aviso tom="atencao" titulo="Só o responsável ou um gerente pode importar">
            Peça para quem administra a barbearia fazer a importação.
          </Aviso>
          <Link href="/clientes" className={buttonClasses({ variant: "secondary" })}>
            Voltar para clientes
          </Link>
        </div>
      )}
    </div>
  );
}
