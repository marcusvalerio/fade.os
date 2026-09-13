import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { getOwnProfessionalId } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
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

  // Endereço da unidade (R23.4): a referência da sidebar mostra empresa +
  // localização no header. Só a primeira unidade, e só o que existir de
  // verdade — sem endereço cadastrado, a segunda linha simplesmente some,
  // nunca um placeholder inventado.
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("unit")
    .select("address")
    .eq("company_id", current.company.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const displayName = (user.user_metadata?.name as string | undefined)?.trim() || user.email || "Usuário";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  const roleText = roleLabel[current.roleKey ?? ""] ?? (scope === "barber" ? "Profissional" : "Equipe");

  // Avatar + nome + função + controle da unidade — mesmo bloco no rodapé da
  // sidebar (desktop) e no rodapé do drawer (mobile).
  const identidade = (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 min-w-0" title={displayName}>
        <span
          aria-hidden
          className="size-8 rounded-full border flex items-center justify-center text-caption font-medium text-shell-foreground shrink-0"
          style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--neutral-graphite)" }}
        >
          {initials}
        </span>
        <span className="text-caption text-shell-muted flex flex-col leading-tight min-w-0">
          <span className="text-shell-foreground truncate">{displayName}</span>
          <span className="truncate">{roleText}</span>
        </span>
      </div>
      <CompanySwitcher current={current.company} companies={current.availableCompanies} />
    </div>
  );

  // Empresa + usuário no topo da coluna de conteúdo — a parte de
  // usuário/sair some no mobile porque já vive em `identidade`, dentro do
  // drawer; duplicá-la ali também só apertaria uma barra que já carrega o
  // botão de abrir o menu.
  const header = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        {current.company.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.company.logo_url}
            alt=""
            className="size-7 rounded-sm object-cover shrink-0 border"
            style={{ borderColor: "var(--shell-border)" }}
          />
        )}
        <span className="flex flex-col min-w-0 leading-none gap-0.5">
          <span className="text-body-sm font-medium text-shell-foreground truncate">{current.company.name}</span>
          {unit?.address && (
            <span className="text-[0.6875rem] leading-none text-shell-muted truncate">{unit.address}</span>
          )}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0" title={displayName}>
          <span
            aria-hidden
            className="size-7 rounded-full border flex items-center justify-center text-[0.6875rem] font-medium text-shell-foreground shrink-0"
            style={{ borderColor: "var(--shell-border)", backgroundColor: "var(--neutral-graphite)" }}
          >
            {initials}
          </span>
          <span className="text-[0.6875rem] leading-tight text-shell-muted hidden lg:flex lg:flex-col">
            <span className="text-shell-foreground truncate max-w-32">{displayName}</span>
            <span>{roleText}</span>
          </span>
        </div>
        <form action={signOut}>
          <button className="text-caption text-shell-muted hover:text-shell-foreground transition-colors duration-fast ease-standard">
            Sair
          </button>
        </form>
      </div>
    </>
  );

  return (
    <ToastProvider>
      <AppNav scope={scope} identidade={identidade} header={header}>
        {children}
      </AppNav>
    </ToastProvider>
  );
}
