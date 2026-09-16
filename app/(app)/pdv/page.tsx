import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Vazio } from "@/components/ui/estado";
import { PdvClient } from "./PdvClient";
import { rotularHomonimos } from "@/lib/pessoas";
import type { PaymentMethodKey } from "@/lib/types";
import Link from "next/link";

export default async function PdvPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const unit = current!.unit;
  const supabase = await createClient();

  if (!unit) {
    return <div className="max-w-2xl"><PageHeader title="Nova venda" /><Vazio titulo="Cadastre uma unidade primeiro" descricao="O PDV precisa de uma unidade ativa para registrar a venda." /></div>;
  }

  const [{ data: products }, { data: clients }, { data: paymentMethods }] = await Promise.all([
    supabase.from("product").select("id, name, sale_price, current_stock").eq("company_id", companyId).eq("unit_id", unit.id).eq("active", true).order("name"),
    supabase.from("client").select("id, name, phone, email").eq("company_id", companyId).order("name"),
    supabase.from("payment_method").select("method").eq("company_id", companyId).eq("active", true),
  ]);

  if (!products || products.length === 0) {
    return <div className="max-w-2xl"><PageHeader title="Nova venda" /><Vazio titulo="Nenhum produto cadastrado nesta unidade" descricao="Cadastre ou vincule produtos à unidade ativa para poder vender pelo PDV." /></div>;
  }

  const activeMethods = (paymentMethods ?? []).map((p) => p.method as PaymentMethodKey);
  const { data: openCashSession } = await supabase.rpc("get_open_cash_session", { p_unit_id: unit.id });

  return (
    <div>
      <PageHeader title="Nova venda" description={`Venda na unidade ${unit.name}.`} action={<Link href="/vendas" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">Ver vendas</Link>} />
      <PdvClient companyId={companyId} unitId={unit.id} products={products} clients={rotularHomonimos(clients ?? [])} activeMethods={activeMethods} cashSessionOpen={Boolean(openCashSession)} requiresAuthorization={!(await isCompanyManager(companyId))} />
    </div>
  );
}
