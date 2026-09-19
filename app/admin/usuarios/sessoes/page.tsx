import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso, Vazio } from "@/components/ui/estado";

type UserRow = { id: string; email: string; last_sign_in_at: string | null };

/**
 * "Sessões" no sentido de lista de sessões ativas (dispositivo, IP,
 * revogar uma sessão específica) não existe — Supabase Auth não expõe
 * isso via `admin_list_users()`, e não há tabela própria de sessões no
 * schema. O que É real é `auth.users.last_sign_in_at`, já devolvido por
 * essa RPC: o último acesso de cada conta. Mostrado aqui como o que
 * genuinamente existe, não como uma lista de sessões inventada.
 */
export default async function AdminSessionsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  const users = ((data ?? []) as UserRow[])
    .filter((u) => u.last_sign_in_at)
    .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime())
    .slice(0, 50);

  return (
    <div className="space-y-6">
      <PageHeader title="Sessões" description="Último acesso conhecido de cada conta." />

      <Aviso tom="atencao">
        Não existe hoje uma lista de sessões ativas (dispositivo, IP, expiração, revogação
        individual) — o Supabase Auth não expõe isso pela API administrativa em uso, e não há
        tabela própria de sessões no banco. O que aparece abaixo é o único dado real disponível:
        o último login de cada conta.
      </Aviso>

      {error ? (
        <Vazio titulo="Não foi possível carregar os acessos" descricao={error.message} />
      ) : users.length === 0 ? (
        <Vazio titulo="Nenhum acesso registrado ainda" />
      ) : (
        <Surface>
          {users.map((u) => (
            <SurfaceRow key={u.id} className="flex items-center justify-between gap-4">
              <span className="text-body-sm text-foreground truncate">{u.email}</span>
              <span className="text-caption text-muted shrink-0">
                {new Date(u.last_sign_in_at!).toLocaleString("pt-BR")}
              </span>
            </SurfaceRow>
          ))}
        </Surface>
      )}
    </div>
  );
}
