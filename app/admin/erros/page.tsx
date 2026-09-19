import { PageHeader } from "@/components/ui/page-header";
import { UnavailableTable } from "../UnavailableTable";

/** Sem Sentry (ou qualquer rastreador de exceções) integrado — sem exceção real para listar. */
export default function AdminErrorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Erros" description="Issues, exceções, frequência e impacto." />
      <UnavailableTable
        columns={["Erro", "Origem", "Frequência", "Empresa afetada", "Impacto", "Status"]}
        note="Não conectado. Nenhuma integração de rastreamento de erros (ex.: Sentry) existe no código hoje. Quando integrada, esta área listará exceções por origem, frequência e tenant afetado."
      />
    </div>
  );
}
