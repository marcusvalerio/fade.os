import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  onboarding_completed: boolean;
  user_count: number;
  professional_count: number;
};

/**
 * Leitura, de propósito — sem CRUD destrutivo nesta rodada. A consulta
 * cross-company passa por admin_list_companies() (SECURITY DEFINER, checa
 * is_platform_admin por dentro): a RLS de `company` continua escopada por
 * empresa como sempre foi, um platform admin não vira membro de nenhuma.
 */
export default async function AdminCompaniesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_companies");
  const companies = (data ?? []) as CompanyRow[];

  return (
    <div>
      <PageHeader title="Empresas" description="Leitura das barbearias cadastradas na plataforma." />

      {error ? (
        <Vazio titulo="Não foi possível carregar as empresas" descricao={error.message} />
      ) : companies.length === 0 ? (
        <Vazio titulo="Nenhuma empresa cadastrada ainda" />
      ) : (
        <Surface>
          {companies.map((company) => (
            <SurfaceRow key={company.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-body font-medium text-foreground truncate">{company.name}</p>
                <p className="text-caption text-muted truncate">
                  /{company.slug} · criada em {new Date(company.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-body-sm text-muted tabular-nums">{company.user_count} usuário(s)</span>
                <span className="text-body-sm text-muted tabular-nums">{company.professional_count} profissional(is)</span>
                <Badge tone={company.onboarding_completed ? "success" : "neutral"}>
                  {company.onboarding_completed ? "Operacional" : "Em configuração"}
                </Badge>
              </div>
            </SurfaceRow>
          ))}
        </Surface>
      )}
    </div>
  );
}
