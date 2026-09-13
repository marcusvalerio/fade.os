import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";

/**
 * Visão geral — só números que o banco realmente calcula. Nada de métrica
 * inventada: se não dá para calcular com segurança (ex.: "empresas ativas"
 * exigiria uma definição de "ativa" que ainda não existe no schema), o
 * indicador simplesmente não entra aqui.
 */
export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: users }, { data: betaRequests }] = await Promise.all([
    supabase.rpc("admin_list_companies"),
    supabase.rpc("admin_list_users"),
    supabase.from("beta_access_requests").select("status"),
  ]);

  const totalCompanies = companies?.length ?? 0;
  const totalUsers = users?.length ?? 0;
  const requests = betaRequests ?? [];
  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;

  const indicadores = [
    { label: "Empresas cadastradas", valor: totalCompanies },
    { label: "Usuários na plataforma", valor: totalUsers },
    { label: "Solicitações de Beta pendentes", valor: pending },
    { label: "Solicitações aprovadas", valor: approved },
  ];

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description="Números reais do banco — nada aqui é estimado."
      />
      <Surface className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y-0 sm:divide-y-0 divide-border">
        {indicadores.map((item) => (
          <SurfaceRow key={item.label} className="py-5">
            <p className="text-label uppercase text-muted truncate">{item.label}</p>
            <p className="text-metric font-heading text-foreground tabular-nums mt-2">{item.valor}</p>
          </SurfaceRow>
        ))}
      </Surface>
    </div>
  );
}
