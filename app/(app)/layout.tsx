import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { getOwnProfessionalId } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/actions/auth";
import { setActiveMode } from "@/actions/modo";
import { getActiveMode } from "@/lib/active-mode";
import { AppNav, type NavScope } from "@/components/app-nav";
import { CompanySwitcher } from "@/components/company-switcher";
import { ToastProvider } from "@/components/ui/toast";
import { Wordmark } from "@/components/ui/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Apresentacao, BotaoReverApresentacao } from "@/components/apresentacao";
import { Vazio } from "@/components/ui/estado";
import { EntradaCortex } from "@/components/entrada-cortex";
import { COOKIE_ENTRADA } from "@/lib/entrada";
import { destinoDoClienteSemEquipe } from "@/lib/cliente-conta";
import { definirContexto } from "@/lib/observabilidade";
import { ContextoObservabilidade } from "@/components/contexto-observabilidade";
import { PesquisaDiscreta } from "@/components/pesquisa-discreta";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentCompany();

  if (!current) {
    redirect((await destinoDoClienteSemEquipe()) ?? "/onboarding");
  }

  // P0.5 — empresa suspensa não opera: nenhuma tela abaixo deste layout
  // chega a renderizar. Os dados continuam intactos (venda, caixa,
  // comissão, cliente) — só o acesso operacional para.
  if (current.company.status === "suspended") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <Wordmark tamanho="lg" />
          </div>
          <Vazio
            titulo="Acesso suspenso"
            descricao="O acesso operacional desta empresa foi suspenso pela administração do CORTEX.OS. Nenhum dado foi perdido — fale com o suporte para reativar."
          />
        </div>
      </main>
    );
  }

  const user = await requireAuthenticatedUser();
  const contexto = { usuarioId: user.id, empresaId: current.company.id, papel: current.roleKey, area: "produto" as const };
  definirContexto(contexto);
  const isManager = current.roleKey === "owner" || current.roleKey === "admin";
  // P0.3: antes só era checado para quem NÃO era manager — um owner/admin
  // que também atende (professional.user_id = auth.uid() nesta empresa)
  // nunca era reconhecido nesse segundo contexto. "Modo" só decide QUAL
  // scope de navegação aparece quando os dois existem; nenhuma autorização
  // muda — quem pode fazer o quê continua vindo de user_company_role/RLS.
  // A unidade (contexto da sidebar) não depende do vínculo de profissional:
  // as duas consultas saem juntas — este layout roda em toda tela.
  const supabase = await createClient();
  const [ownProfessionalId, { data: unit }] = await Promise.all([
    getOwnProfessionalId(current.company.id, user.id),
    supabase.from("unit").select("name, address").eq("company_id", current.company.id).order("created_at").limit(1).maybeSingle(),
  ]);
  const hasBothContexts = isManager && !!ownProfessionalId;
  const activeMode = hasBothContexts ? await getActiveMode() : null;
  const scope: NavScope =
    activeMode === "atendimento" && ownProfessionalId
      ? "barber"
      : isManager
        ? "manager"
        : ownProfessionalId
          ? "barber"
          : "reception";

  const roleLabel: Record<string, string> = {
    owner: "Responsável",
    admin: "Gerente",
  };

  // A unidade aparece como contexto na sidebar — só o que existe de verdade:
  // sem nome/endereço cadastrado, a linha some, nunca um placeholder.

  const displayName = user.name || user.email || "Usuário";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  const roleText = roleLabel[current.roleKey ?? ""] ?? (scope === "barber" ? "Profissional" : "Equipe");

  // O menu da conta: tema, apresentação, modo, barbearia e sair. Os
  // formulários ficam aqui (Server Actions); o shell só abre e fecha.
  const menuConta = (
    <div className="space-y-4 text-on-ink">
      <div>
        <p className="font-subtitle text-micro uppercase tracking-label text-on-ink-muted mb-1.5">Tema</p>
        <ThemeToggle tom="tinta" />
      </div>
      <BotaoReverApresentacao className="w-full min-h-9 text-left text-body-sm text-on-ink-soft hover:text-on-ink" />
      {hasBothContexts && (
        <form action={setActiveMode.bind(null, activeMode === "atendimento" ? "admin" : "atendimento")}>
          <button type="submit" className="w-full min-h-9 text-left text-body-sm text-on-ink-soft hover:text-on-ink">
            Trocar para {activeMode === "atendimento" ? "gestão" : "modo atendimento"}
          </button>
        </form>
      )}
      <CompanySwitcher current={current.company} companies={current.availableCompanies} />
      <form action={signOut} className="pt-3 border-t border-rule-on-ink">
        <button type="submit" className="w-full min-h-9 text-left text-body-sm text-on-ink-soft hover:text-on-ink">
          Sair
        </button>
      </form>
    </div>
  );

  // Acabou de entrar (login, OAuth ou fim do onboarding marcam o cookie):
  // a sequência da marca vem no HTML e o produto sobe por baixo dela.
  const acabouDeEntrar = (await cookies()).get(COOKIE_ENTRADA)?.value === "1";

  return (
    <ToastProvider>
      <ContextoObservabilidade {...contexto} />
      <PesquisaDiscreta area="equipe" empresaId={current.company.id} />
      {acabouDeEntrar && <EntradaCortex />}
      <AppNav
        scope={scope}
        contexto={{
          empresa: current.company.name,
          unidade: unit?.address || unit?.name || null,
          logoUrl: current.company.logo_url ?? null,
        }}
        usuario={{ nome: displayName, papel: roleText, iniciais: initials }}
        menuConta={menuConta}
        entrada={acabouDeEntrar}
      >
        {children}
      </AppNav>
      <Apresentacao abrirAoEntrar={!user.apresentacaoVistaEm} scope={scope} />
    </ToastProvider>
  );
}
