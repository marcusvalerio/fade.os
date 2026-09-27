import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso } from "@/components/ui/estado";

/**
 * Descreve o modelo de autorização real, em vez de criar um segundo
 * sistema de RBAC (a tarefa proíbe explicitamente isso). Existem dois
 * níveis, já implementados e não alterados aqui:
 *
 *   1. Plataforma — `platform_admin` (ver Usuários: conceder/revogar).
 *   2. Empresa    — `user_company_role.role` (owner/admin/staff),
 *      escopado por empresa, gerido dentro de cada empresa, nunca por
 *      este painel (ver docs/ADMIN.md).
 */
export default async function AdminPermissionsPage() {
  const supabase = await createClient();
  const { count: platformAdminCount } = await supabase
    .from("platform_admin")
    .select("user_id", { count: "exact", head: true })
    .eq("status", "active");

  return (
    <div className="space-y-8">
      <PageHeader title="Permissões" description="Os dois níveis de autorização da plataforma." />

      <section>
        <p className="text-label uppercase tracking-label text-muted mb-3">Plataforma</p>
        <Surface>
          <SurfaceRow className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-body-sm text-foreground">
              <code>platform_admin</code> — acesso ao CORTEX ADMIN. Independente de qualquer
              vínculo de empresa; concedido/revogado em Usuários.
            </p>
            <span className="text-caption text-muted tabular-nums shrink-0">
              {platformAdminCount ?? 0} ativo(s)
            </span>
          </SurfaceRow>
        </Surface>
      </section>

      <section>
        <p className="text-label uppercase tracking-label text-muted mb-3">Empresa</p>
        <Surface>
          <SurfaceRow>
            <p className="text-body-sm text-foreground">
              <code>user_company_role.role</code> — owner, admin ou staff, escopado por empresa.
              Controla o que cada pessoa vê e faz dentro do produto operacional (agenda, caixa,
              catálogo, equipe).
            </p>
          </SurfaceRow>
        </Surface>
      </section>

      <Aviso tom="atencao">
        O CORTEX ADMIN não edita papel de empresa — essa gestão continua dentro de cada empresa
        (Equipe). Criar aqui um segundo caminho para isso duplicaria a autorização existente, o
        que esta rodada evitou de propósito.
      </Aviso>
    </div>
  );
}
