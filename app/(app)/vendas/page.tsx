import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { CancelSaleButton } from "./CancelSaleButton";
import Link from "next/link";

export default async function VendasPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div>
        <PageHeader title="Vendas" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const { data: sales } = await supabase
    .from("sale")
    .select("id, status, total, discount_amount, created_at, client:client_id(name)")
    .eq("company_id", current!.company.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Vendas"
        description="Histórico comercial — atendimentos fechados e vendas avulsas. Cancelamento gera estorno auditável."
        action={
          <Link href="/pdv" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
            Nova venda
          </Link>
        }
      />

      <Surface>
        {sales && sales.length > 0 ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sales as any[]).map((sale) => (
            <SurfaceRow key={sale.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body-sm font-medium text-foreground">{sale.client?.name ?? "Cliente"}</p>
                <p className="text-caption text-muted mt-0.5">
                  {new Date(sale.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(sale.total)}</span>
                <Badge tone={sale.status === "completed" ? "success" : "neutral"}>
                  {sale.status === "completed" ? "concluída" : "cancelada"}
                </Badge>
                {sale.status === "completed" && <CancelSaleButton saleId={sale.id} />}
              </div>
            </SurfaceRow>
          ))
        ) : (
          <EmptyState
            title="Nenhuma venda ainda"
            description="Vendas aparecem aqui quando você fecha um atendimento ou registra uma venda avulsa em Nova venda."
          />
        )}
      </Surface>
    </div>
  );
}
