import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCompany } from "@/lib/current-company";
import { signOut } from "@/actions/auth";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda" },
  { href: "/atendimento", label: "Atendimento" },
  { href: "/clientes", label: "Clientes" },
  { href: "/profissionais", label: "Profissionais" },
  { href: "/servicos", label: "Serviços" },
];

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
    <div className="min-h-screen bg-[var(--color-dusty-cotton)]">
      <header className="bg-[var(--color-cobblestone)] text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold">FADE OS</span>
            <span className="text-xs text-white/60 hidden sm:inline">
              {current.company.name}
            </span>
          </div>
          <form action={signOut}>
            <button className="text-xs text-white/70 hover:text-white">
              Sair
            </button>
          </form>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-4 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm py-2 border-b-2 border-transparent hover:border-[var(--color-otan-red)] whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
