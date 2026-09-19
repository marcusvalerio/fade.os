import { PageHeader } from "@/components/ui/page-header";
import { UnavailableTable } from "../UnavailableTable";

/**
 * Não existe uma visão de pagamentos/transações cross-tenant nesta
 * plataforma. `sale`/`payment`/`financial_entry` existem por empresa, no
 * produto operacional (Financeiro/Caixa), mas nenhuma RPC administrativa
 * expõe isso agregado para a plataforma — e nenhuma foi criada aqui (sem
 * alteração de banco nesta rodada).
 */
export default function AdminTransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Transações" description="Pagamentos, reembolsos e falhas — visão de plataforma." />
      <UnavailableTable
        columns={["ID da transação", "Empresa", "Status", "Valor", "Data", "Provedor"]}
        note="Não conectado. Não existe uma leitura administrativa cross-empresa de vendas/pagamentos hoje — cada empresa vê o próprio Financeiro/Caixa, mas nenhuma RPC agrega isso para a plataforma."
      />
    </div>
  );
}
