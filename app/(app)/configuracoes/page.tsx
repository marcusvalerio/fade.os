import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { PublicPageSettingsPanel } from "./PublicPageSettingsPanel";
import { UnitSettingsForm } from "./UnitSettingsForm";
import { UnitBusinessHoursEditor } from "./UnitBusinessHoursEditor";
import { PaymentMethodsPanel } from "./PaymentMethodsPanel";
import type { Company, Unit, PaymentMethodKey, UnitBusinessHours } from "@/lib/types";

export default async function ConfiguracoesPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Configurações" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

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

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: businessHours } = unitIds.length
    ? await supabase.from("unit_business_hours").select("*").in("unit_id", unitIds)
    : { data: [] };

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
        <PublicPageSettingsPanel companyId={current!.company.id} slug={(company as Company).slug} />
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-3">Unidades</h2>
        <div className="space-y-6">
          {(units as Unit[] | null)?.map((unit) => (
            <div key={unit.id} className="space-y-3">
              <UnitSettingsForm unit={unit} />
              <div>
                <p className="text-label uppercase text-muted mb-2">Horário de funcionamento</p>
                <UnitBusinessHoursEditor
                  unitId={unit.id}
                  hours={(businessHours as UnitBusinessHours[] | null)?.filter((h) => h.unit_id === unit.id) ?? []}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-1">Formas de pagamento</h2>
        <p className="text-body-sm text-muted mb-3">O que sua barbearia aceita receber.</p>
        <PaymentMethodsPanel companyId={current!.company.id} activeMethods={activeMethods} />
      </section>

      <section>
        <h2 className="text-section-title text-foreground mb-1">Aparência</h2>
        <p className="text-body-sm text-muted mb-3">Como o FADE OS aparece neste dispositivo.</p>
        <ThemeToggle />
      </section>
    </div>
  );
}
