import { PageHeader } from "@/components/ui/page-header";
import { UnavailableTable } from "../UnavailableTable";

/** Sem fila/cron/Edge Functions agendadas no projeto — não há job em background para observar. */
export default function AdminJobsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Jobs / Workers" description="Execuções, pendências, falhas e duração." />
      <UnavailableTable
        columns={["Job", "Status", "Início", "Fim", "Duração", "Tentativas"]}
        note="Não conectado. Não existe fila, cron ou função agendada no projeto hoje — todo processamento roda de forma síncrona dentro das Server Actions do próprio pedido do usuário."
      />
    </div>
  );
}
