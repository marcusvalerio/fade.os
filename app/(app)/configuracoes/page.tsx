import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { UnitSettingsForm } from "./UnitSettingsForm";
import { PaymentMethodsPanel } from "./PaymentMethodsPanel";
import type { Company, Unit, PaymentMethodKey } from "@/lib/types";

export default async function ConfiguracoesPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("company")
    .select("*")
    .eq("id", current!.company.id)
    .single();

  const { data: units } = await supabase
    .from("unit")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("created_at");

  const { data: paymentMethods } = await supabase
    .from("payment_method")
    .select("method, active")
    .eq("company_id", current!.company.id)
    .eq("active", true);

  const activeMethods = (paymentMethods ?? []).map((p) => p.method as PaymentMethodKey);

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Configurações" description="Os dados que sustentam a sua operação." />

      <section>
        <h2 className="text-section-title text-foreground mb-3">Sua barbearia</h2>
        <CompanySettingsForm company={company as Company} />
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-3">Unidades</h2>
        <div className="space-y-4">
          {(units as Unit[] | null)?.map((unit) => <UnitSettingsForm key={unit.id} unit={unit} />)}
        </div>
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-1">Formas de pagamento</h2>
        <p className="text-body-sm text-muted mb-3">O que sua barbearia aceita receber.</p>
        <PaymentMethodsPanel companyId={current!.company.id} activeMethods={activeMethods} />
      </section>
    </div>
  );
}
