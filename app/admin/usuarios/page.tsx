import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { usuariosDetalhados, haQuanto, ROTULO_DO_METODO } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { PlatformAdminAction } from "./PlatformAdminAction";

const PAPEL: Record<string, string> = { owner: "Responsável", admin: "Gerente", staff: "Equipe" };

const FILTROS = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "equipe", rotulo: "Equipe de barbearia" },
  { chave: "clientes", rotulo: "Só cliente" },
  { chave: "admins", rotulo: "Admin de plataforma" },
  { chave: "inativos", rotulo: "Sem acesso em 30 dias" },
] as const;

/**
 * Usuários — cada conta com o que ela é (equipe de quais barbearias, com
 * qual papel; cliente final; admin de plataforma), como entra (provedores
 * vinculados e o método da última sessão) e quando entrou pela última vez.
 * Nunca senha, token ou metadado bruto: admin_list_users_detailed devolve
 * só isto. A única ação aqui é a de plataforma (conceder/revogar admin).
 */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro = "todos" } = await searchParams;
  const [eu, usuarios] = await Promise.all([requireAuthenticatedUser(), usuariosDetalhados()]);

  if (!usuarios) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar os usuários.</p>
      </div>
    );
  }

  const trintaDias = Date.now() - 30 * 86400000;
  const passa = (u: (typeof usuarios)[number]) => {
    if (filtro === "equipe") return u.empresas.length > 0;
    if (filtro === "clientes") return u.empresas.length === 0 && u.cliente_em > 0;
    if (filtro === "admins") return u.is_platform_admin;
    if (filtro === "inativos") return !u.last_sign_in_at || new Date(u.last_sign_in_at).getTime() < trintaDias;
    return true;
  };
  const lista = usuarios.filter(passa);

  return (
    <div className="space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">Barbearias</p>
        <h1 className="text-page-title text-foreground mt-2.5">Usuários.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Equipe, clientes e administradores — cada um só vê o próprio contexto. Conceder admin de plataforma aqui não
          muda nada dentro das barbearias.
        </p>
      </header>

      <nav aria-label="Filtrar usuários" className="flex flex-wrap gap-1">
        {FILTROS.map((f) => (
          <Link
            key={f.chave}
            href={`/admin/usuarios?filtro=${f.chave}`}
            aria-current={filtro === f.chave ? "page" : undefined}
            className={cn(
              "rounded-sm px-2.5 py-1.5 text-caption transition-colors duration-micro",
              filtro === f.chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground hover:bg-surface"
            )}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <div className="painel p-8 text-center">
          <p className="text-body-sm text-foreground font-medium">Nenhum usuário neste filtro.</p>
        </div>
      ) : (
        <ul className="painel divide-y divide-border">
          {lista.map((u) => (
            <li key={u.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1 basis-72">
                <p className="flex items-center gap-2 flex-wrap text-body-sm text-foreground">
                  <span className="truncate font-medium">{u.email}</span>
                  {u.is_platform_admin && <Marca tom="primary">admin de plataforma</Marca>}
                  {!u.email_confirmed && <Marca tom="warning">e-mail não confirmado</Marca>}
                  {u.banido && <Marca tom="danger">bloqueado</Marca>}
                </p>
                <p className="text-caption text-muted mt-1">
                  {u.empresas.length > 0
                    ? u.empresas.map((e) => `${e.nome} (${PAPEL[e.papel] ?? e.papel})`).join(" · ")
                    : u.cliente_em > 0
                      ? `Cliente em ${u.cliente_em} barbearia(s)`
                      : "Sem vínculo com barbearia"}
                  {u.empresas.length > 0 && u.cliente_em > 0 && ` · também cliente em ${u.cliente_em}`}
                </p>
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-caption">
                <div>
                  <dt className="sr-only">Formas de entrar</dt>
                  <dd className="mono text-muted">{u.providers.length ? u.providers.join(" + ") : "—"}</dd>
                </div>
                <div>
                  <dt className="sr-only">Método da última sessão</dt>
                  <dd className="text-muted">{u.ultimo_metodo ? `última: ${ROTULO_DO_METODO[u.ultimo_metodo] ?? u.ultimo_metodo}` : "sem sessão"}</dd>
                </div>
                <div>
                  <dt className="sr-only">Último acesso</dt>
                  <dd className="mono text-foreground">{haQuanto(u.last_sign_in_at)}</dd>
                </div>
              </dl>
              <div className="shrink-0">
                <PlatformAdminAction userId={u.id} isAdmin={u.is_platform_admin} isSelf={u.id === eu.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Marca({ tom, children }: { tom: "primary" | "warning" | "danger"; children: React.ReactNode }) {
  const cor = tom === "primary" ? "bg-primary" : tom === "warning" ? "bg-warning" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5 text-micro font-subtitle uppercase tracking-label text-muted">
      <span aria-hidden className={cn("size-1.5", cor)} />
      {children}
    </span>
  );
}
