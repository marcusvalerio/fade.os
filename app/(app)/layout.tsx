import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { getOwnProfessionalId } from "@/lib/permissions";
import { signOut } from "@/actions/auth";
import { AppNav, type NavScope } from "@/components/app-nav";
import { CompanySwitcher } from "@/components/company-switcher";
import { ToastProvider } from "@/components/ui/toast";

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

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="shell flex items-center justify-between py-4">
            <div className="flex items-center gap-3 min-w-0">
              {current.company.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.company.logo_url}
                  alt=""
                  className="size-7 rounded-sm object-cover shrink-0 border border-border"
                />
              ) : (
                <span className="font-logo font-[777] text-lg tracking-tight text-foreground shrink-0">
                  FADE OS
                </span>
              )}
              <span className="text-body-sm text-muted truncate hidden sm:inline">
                {current.company.name}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <CompanySwitcher current={current.company} companies={current.availableCompanies} />
              <span className="text-caption text-muted hidden sm:inline">
                {roleLabel[current.roleKey ?? ""] ?? (scope === "barber" ? "Profissional" : "Equipe")}
              </span>
              <form action={signOut}>
                <button className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
                  Sair
                </button>
              </form>
            </div>
          </div>
          <AppNav scope={scope} />
        </header>
        <main className="shell py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
