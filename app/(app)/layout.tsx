import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { getOwnProfessionalId } from "@/lib/permissions";
import { signOut } from "@/actions/auth";
import { AppNav, type NavScope } from "@/components/app-nav";
import { CompanySwitcher } from "@/components/company-switcher";
import { ToastProvider } from "@/components/ui/toast";
import { AssinaturaProduto } from "@/components/ui/wordmark";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentCompany();

  if (!current) {
    redirect("/onboarding");
  }

  const user = await requireAuthenticatedUser();
  const isManager = current.roleKey === "owner" || current.roleKey === "admin";
  const ownProfessionalId = isManager ? null : await getOwnProfessionalId(current.company.id, user.id);
  const scope: NavScope = isManager ? "manager" : ownProfessionalId ? "barber" : "reception";

  const roleLabel: Record<string, string> = {
    owner: "Responsável",
    admin: "Gerente",
  };

  const displayName = (user.user_metadata?.name as string | undefined)?.trim() || user.email || "Usuário";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  // A barbearia é a protagonista. O nome da casa vai em primeiro plano, a
  // marca do produto como assinatura embaixo, menor — isso não mudou. O que
  // mudou no R22 é onde essa faixa mora: dentro do mesmo shell escuro da
  // navegação (via `topBar`), não numa faixa própria no tema da página logo
  // acima dela. Duas faixas de cor diferente empilhadas liam como "duas
  // interfaces"; uma peça de material só lê como "o produto".
  const topBar = (
    <div
      className="shell flex items-center justify-between py-4 border-b"
      style={{ borderColor: "var(--shell-border)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {current.company.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.company.logo_url}
            alt=""
            className="size-9 rounded-sm object-cover shrink-0 border"
            style={{ borderColor: "var(--shell-border)" }}
          />
        )}
        <span className="flex flex-col min-w-0 leading-none gap-1">
          <span className="font-brand text-[0.9375rem] sm:text-[1.0625rem] tracking-[-0.005em] text-shell-foreground truncate">
            {current.company.name}
          </span>
          <AssinaturaProduto className="text-shell-muted" />
        </span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <CompanySwitcher current={current.company} companies={current.availableCompanies} />
        <div className="flex items-center gap-2 min-w-0" title={displayName}>
          <span
            aria-hidden
            className="size-8 rounded-full border flex items-center justify-center text-caption font-medium text-shell-foreground shrink-0"
            style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--neutral-graphite)" }}
          >
            {initials}
          </span>
          <span className="text-caption text-shell-muted hidden sm:flex sm:flex-col sm:leading-tight">
            <span className="text-shell-foreground truncate max-w-32">{displayName}</span>
            <span>{roleLabel[current.roleKey ?? ""] ?? (scope === "barber" ? "Profissional" : "Equipe")}</span>
          </span>
        </div>
        <form action={signOut}>
          <button className="text-body-sm text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard">
            Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <header>
          <AppNav scope={scope} topBar={topBar} />
        </header>
        <main className="shell py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
