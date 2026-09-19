import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Aviso, Vazio } from "@/components/ui/estado";

type BetaRow = {
  id: string;
  barbershop_name: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  beta_period_months: number | null;
  beta_expires_at: string | null;
  provisioned_company_id: string | null;
};

/**
 * Não existe billing/assinatura de verdade (sem Stripe, sem tabela
 * `subscription`/`plan` — ver docs/ADMIN.md). O único ciclo de acesso que
 * existe hoje é o período de Beta concedido em cada aprovação
 * (`beta_period_months`/`beta_expires_at`). Mostrado aqui como o que é —
 * um ciclo de Beta, não uma assinatura paga — nunca fabricando um plano
 * ou um valor de cobrança que não existe.
 */
export default async function AdminSubscriptionsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_access_requests")
    .select("id, barbershop_name, status, beta_period_months, beta_expires_at, provisioned_company_id")
    .eq("status", "approved")
    .order("beta_expires_at", { ascending: true });

  const rows = (data ?? []) as BetaRow[];
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader title="Assinaturas" description="Ciclos de acesso concedidos — não existe billing." />

      <Aviso tom="atencao">
        Não há sistema de assinaturas/billing (ex.: Stripe) integrado — nenhum plano pago, preço
        ou cobrança recorrente existe no produto hoje. O que aparece abaixo é o único ciclo real
        de acesso por tempo: o período de Beta concedido a cada aprovação.
      </Aviso>

      {error ? (
        <Vazio titulo="Não foi possível carregar os ciclos de Beta" descricao={error.message} />
      ) : rows.length === 0 ? (
        <Vazio titulo="Nenhum ciclo de Beta ativo" />
      ) : (
        <Surface>
          {rows.map((row) => {
            const expired = row.beta_expires_at ? new Date(row.beta_expires_at).getTime() <= now : false;
            return (
              <SurfaceRow key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-foreground truncate">{row.barbershop_name}</p>
                  <p className="text-caption text-muted">
                    {row.beta_period_months ? `${row.beta_period_months} mês(es) de Beta` : "período não informado"}
                    {row.beta_expires_at ? ` · expira em ${new Date(row.beta_expires_at).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Badge tone={expired ? "danger" : "success"}>{expired ? "Expirado" : "Ativo"}</Badge>
              </SurfaceRow>
            );
          })}
        </Surface>
      )}
    </div>
  );
}
