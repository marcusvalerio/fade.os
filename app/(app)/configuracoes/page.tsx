import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { hasAuthorizationCode } from "@/actions/configuracoes";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Vazio } from "@/components/ui/estado";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { PublicPageSettingsPanel } from "./PublicPageSettingsPanel";
import { UnitSettingsForm } from "./UnitSettingsForm";
import { UnitBusinessHoursEditor } from "./UnitBusinessHoursEditor";
import { PaymentMethodsPanel } from "./PaymentMethodsPanel";
import { AuthorizationCodePanel } from "./AuthorizationCodePanel";
import type { Company, Unit, PaymentMethodKey, UnitBusinessHours } from "@/lib/types";

export default async function ConfiguracoesPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const user = await requireAuthenticatedUser();
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Configurações" />
        <Vazio
          titulo="Acesso restrito"
          descricao="Esta área é visível apenas para o responsável e gerentes da empresa."
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
    <div className="max-w-2xl">
      <PageHeader
        title="Configurações"
        description="Os dados que sustentam a sua operação. Cada grupo abaixo muda uma coisa diferente."
      />

      {/*
        Configurações é a tela que vira lista infinita de campo em todo SaaS.
        O que segura aqui é o agrupamento por CONSEQUÊNCIA: cada grupo diz o
        que muda quando você mexe nele, e o que muda é sempre uma coisa só —
        quem você é, onde atende, como recebe, quem autoriza, o que o cliente
        vê. Nada foi movido de lugar no comportamento; o que mudou é saber
        onde se está.
      */}
      <div className="divide-y divide-border border-t border-border">
        <Grupo
          titulo="Empresa"
          descricao="O nome e os dados que identificam a barbearia dentro e fora do sistema."
        >
          <CompanySettingsForm company={company as Company} />
        </Grupo>

        <Grupo
          titulo="Unidade"
          descricao="Endereço e horário de funcionamento. É o horário daqui que define o que a agenda oferece."
        >
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
        </Grupo>

        <Grupo
          titulo="Pagamentos"
          descricao="O que a barbearia aceita receber. Só o que estiver ativo aqui aparece no fechamento."
        >
          <PaymentMethodsPanel companyId={current!.company.id} activeMethods={activeMethods} />
        </Grupo>

        <Grupo
          titulo="Autorização"
          descricao="O código pedido para desconto e cortesia quando quem opera não é responsável nem gerente."
        >
          <AuthorizationCodePanel
            companyId={current!.company.id}
            configured={await hasAuthorizationCode(current!.company.id)}
          />
        </Grupo>

        <Grupo
          titulo="Página pública"
          descricao="O endereço onde seus clientes agendam sozinhos."
        >
          <PublicPageSettingsPanel companyId={current!.company.id} slug={(company as Company).slug} />
        </Grupo>

        <Grupo titulo="Aparência" descricao="Vale só neste aparelho — não muda nada para o resto da equipe.">
          <ThemeToggle />
        </Grupo>
      </div>
    </div>
  );
}

/**
 * Um grupo de configuração.
 *
 * Título, uma linha de consequência, e o painel. A linha de consequência é o
 * que impede a tela de virar um monte de campo sem dono: ela responde "o que
 * acontece se eu mexer aqui" antes de a pessoa mexer.
 */
function Grupo({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-7 first:pt-6">
      <h2 className="text-section-title text-foreground">{titulo}</h2>
      <p className="text-body-sm text-muted mt-1 mb-4 max-w-prose">{descricao}</p>
      {children}
    </section>
  );
}
