import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { signOut } from "@/actions/auth";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
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

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="shell flex items-center justify-between py-4">
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-logo font-[777] text-lg tracking-tight text-foreground shrink-0">
                FADE OS
              </span>
              <span className="text-body-sm text-muted truncate hidden sm:inline">
                {current.company.name}
              </span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <ThemeToggle />
              <form action={signOut}>
                <button className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
                  Sair
                </button>
              </form>
            </div>
          </div>
          <AppNav />
        </header>
        <main className="shell py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
