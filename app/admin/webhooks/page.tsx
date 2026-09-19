import { PageHeader } from "@/components/ui/page-header";
import { UnavailableTable } from "../UnavailableTable";

/** Nenhum endpoint de webhook inbound existe no código (nenhum provider externo os envia hoje). */
export default function AdminWebhooksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description="Recebidos, processados, falhos e retries." />
      <UnavailableTable
        columns={["Provider", "Evento", "Recebido em", "Status", "Tentativas", "Motivo da falha"]}
        note="Não conectado. Não existe endpoint de webhook inbound no código hoje (nenhum provider externo, como um gateway de pagamento, está integrado)."
      />
    </div>
  );
}
