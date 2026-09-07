import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PdvClient } from "./PdvClient";
import type { PaymentMethodKey } from "@/lib/types";
import Link from "next/link";

export default async function PdvPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const supabase = await createClient();

  const [{ data: unit }, { data: products }, { data: clients }, { data: paymentMethods }] = await Promise.all([
    supabase.from("unit").select("id").eq("company_id", companyId).order("created_at").limit(1).maybeSingle(),
    supabase
      .from("product")
      .select("id, name, sale_price, current_stock")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
    supabase.from("client").select("id, name, phone").eq("company_id", companyId).order("name"),
    supabase.from("payment_method").select("method").eq("company_id", companyId).eq("active", true),
  ]);

  if (!unit) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Nova venda" />
        <EmptyState
          title="Cadastre uma unidade primeiro"
          description="O PDV precisa de uma unidade para registrar a venda."
        />
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Nova venda" />
        <EmptyState
          title="Nenhum produto cadastrado ainda"
          description="Cadastre produtos para poder vender pelo PDV."
        />
      </div>
    );
  }

  const activeMethods = (paymentMethods ?? []).map((p) => p.method as PaymentMethodKey);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nova venda"
        description="Registre uma venda de produtos sem agendamento ou atendimento."
        action={
          <Link href="/vendas" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
            Ver vendas
          </Link>
        }
      />
      <PdvClient
        companyId={companyId}
        unitId={unit.id}
        products={products}
        clients={clients ?? []}
        activeMethods={activeMethods}
      />
    </div>
  );
}
