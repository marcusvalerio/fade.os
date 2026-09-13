import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { PlatformAdminAction } from "./PlatformAdminAction";

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
};

/**
 * Só o mínimo de auth.users que uma visão administrativa precisa — nunca
 * senha, token ou metadata bruto (admin_list_users já garante isso no
 * banco; aqui não seleciona nem exibe nada além do que a função devolve).
 * Não edita permissão operacional de empresa nesta tela — só a autorização
 * de plataforma (platform admin), que é o assunto desta rodada.
 */
export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { userId: currentUserId } = await requireAuthenticatedUser().then((u) => ({ userId: u.id }));

  const [{ data: usersData, error: usersError }, { data: adminsData }] = await Promise.all([
    supabase.rpc("admin_list_users"),
    supabase.from("platform_admin").select("user_id").eq("status", "active"),
  ]);

  const users = (usersData ?? []) as UserRow[];
  const adminIds = new Set((adminsData ?? []).map((a) => a.user_id as string));

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Todas as contas da plataforma. Conceder platform admin aqui não altera papel/permissão em nenhuma empresa."
      />

      {usersError ? (
        <Vazio titulo="Não foi possível carregar os usuários" descricao={usersError.message} />
      ) : users.length === 0 ? (
        <Vazio titulo="Nenhum usuário ainda" />
      ) : (
        <Surface>
          {users.map((user) => {
            const isAdmin = adminIds.has(user.id);
            return (
              <SurfaceRow key={user.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-body text-foreground truncate">{user.email}</p>
                    {isAdmin && <Badge tone="info">Platform admin</Badge>}
                    {!user.email_confirmed && <Badge tone="warning">E-mail não confirmado</Badge>}
                  </div>
                  <p className="text-caption text-muted">
                    Cadastrado em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    {user.last_sign_in_at
                      ? ` · último acesso em ${new Date(user.last_sign_in_at).toLocaleDateString("pt-BR")}`
                      : " · nunca acessou"}
                  </p>
                </div>
                <div className="shrink-0">
                  <PlatformAdminAction userId={user.id} isAdmin={isAdmin} isSelf={user.id === currentUserId} />
                </div>
              </SurfaceRow>
            );
          })}
        </Surface>
      )}
    </div>
  );
}
