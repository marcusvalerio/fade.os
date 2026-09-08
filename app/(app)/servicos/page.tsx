import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatMinutes } from "@/lib/format";
import type { Service } from "@/lib/types";

export default async function ServicosPage() {
  const current = await getCurrentCompany();
  // Catálogo e equipe são administração, não operação. O banco já recusa a
  // escrita para quem não é owner/admin (RLS + trigger assert_admin_write);
  // esta tela deixa de oferecer o que não vai funcionar, no mesmo formato de
  // Financeiro, Relatórios e Configurações.
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div>
        <PageHeader title="Serviços" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: services } = await supabase
    .from("service")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  return (
    <div>
      <PageHeader
        title="Serviços"
        description="O que sua barbearia vende como atendimento profissional — corte, barba, combo."
        action={
          <Link href="/servicos/novo" className={buttonClasses()}>
            Novo serviço
          </Link>
        }
      />

      <Surface>
        {(services as Service[] | null)?.length ? (
          (services as Service[]).map((s) => (
            <Link key={s.id} href={`/servicos/${s.id}`} className="block">
              <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                <div>
                  <p className="text-body-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-caption text-muted mt-0.5">
                    {formatCurrency(s.default_price)} · {formatMinutes(s.planned_duration_minutes)}
                  </p>
                </div>
                <Badge tone={s.status === "active" ? "success" : "neutral"}>
                  {s.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </SurfaceRow>
            </Link>
          ))
        ) : (
          <EmptyState
            title="Nenhum serviço cadastrado ainda"
            description="Cadastre o que sua empresa oferece para poder agendar e atender."
            action={
              <Link href="/servicos/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo serviço
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
