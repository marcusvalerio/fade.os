import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso } from "@/components/ui/estado";

const EXPIRING_SOON_DAYS = 7;

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: users }, { data: betaRequests }] = await Promise.all([
    supabase.rpc("admin_list_companies"),
    supabase.rpc("admin_list_users"),
    supabase
      .from("beta_access_requests")
      .select("status, beta_expires_at"),
  ]);

  const totalCompanies = companies?.length ?? 0;
  const suspendedCompanies = (companies ?? []).filter((c: { status: string }) => c.status === "suspended").length;
  const totalUsers = users?.length ?? 0;
  const requests = betaRequests ?? [];
  const now = Date.now();
  const soonThreshold = now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const active = requests.filter(
    (r) => r.status === "approved" && (!r.beta_expires_at || new Date(r.beta_expires_at).getTime() > now)
  ).length;
  const expiringSoon = requests.filter(
    (r) =>
      r.status === "approved" &&
      r.beta_expires_at &&
      new Date(r.beta_expires_at).getTime() > now &&
      new Date(r.beta_expires_at).getTime() <= soonThreshold
  ).length;
  const expired = requests.filter(
    (r) => r.status === "approved" && r.beta_expires_at && new Date(r.beta_expires_at).getTime() <= now
  ).length;
  const rejected = requests.filter((r) => r.status === "rejected").length;
  const revoked = requests.filter((r) => r.status === "revoked").length;

  const temAtencao = pending > 0 || expiringSoon > 0 || expired > 0 || suspendedCompanies > 0;

  const indicadores = [
    { label: "Empresas", valor: totalCompanies, href: "/admin/empresas" },
    { label: "Usuários", valor: totalUsers, href: "/admin/usuarios" },
    { label: "Beta ativos", valor: active, href: "/admin/acessos" },
    { label: "Beta pendentes", valor: pending, href: "/admin/acessos" },
  ];

  const statusBeta = [
    ["Aprovadas", approved],
    ["Pendentes", pending],
    ["Rejeitadas", rejected],
    ["Revogadas", revoked],
  ] as const;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Visão geral"
        description="Controle da plataforma CORTEX.OS: empresas, usuários, Beta e eventos que precisam de atenção."
      />

      {temAtencao && (
        <section>
          <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Atenção</p>
          <Aviso tom="atencao">
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {pending > 0 && <Link href="/admin/acessos" className="underline">{pending} solicitação(ões) pendente(s)</Link>}
              {expiringSoon > 0 && <Link href="/admin/acessos" className="underline">{expiringSoon} Beta expirando em até {EXPIRING_SOON_DAYS} dias</Link>}
              {expired > 0 && <Link href="/admin/acessos" className="underline">{expired} Beta expirado(s)</Link>}
              {suspendedCompanies > 0 && <Link href="/admin/empresas" className="underline">{suspendedCompanies} empresa(s) suspensa(s)</Link>}
            </div>
          </Aviso>
        </section>
      )}

      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded border border-border bg-border">
          {indicadores.map((item) => (
            <Link key={item.label} href={item.href} className="bg-surface px-4 py-5 sm:px-5 hover:bg-surface-muted transition-colors">
              <p className="text-label uppercase text-muted">{item.label}</p>
              <p className="text-metric font-heading text-foreground tabular-nums mt-2">{item.valor}</p>
              <p className="text-caption text-muted mt-1">Abrir detalhes →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-label uppercase tracking-[0.1em] text-muted">Beta</p>
              <h2 className="text-section-title font-heading text-foreground mt-1">Distribuição das solicitações</h2>
            </div>
            <Link href="/admin/acessos" className="text-caption text-muted hover:text-foreground underline">Ver acessos</Link>
          </div>
          <Surface>
            {statusBeta.map(([label, value]) => (
              <SurfaceRow key={label} className="flex items-center justify-between gap-4 py-4">
                <span className="text-body-sm text-foreground">{label}</span>
                <span className="font-heading text-xl tabular-nums text-foreground">{value}</span>
              </SurfaceRow>
            ))}
          </Surface>
        </div>

        <div>
          <div className="mb-3">
            <p className="text-label uppercase tracking-[0.1em] text-muted">Plataforma</p>
            <h2 className="text-section-title font-heading text-foreground mt-1">Ações rápidas</h2>
          </div>
          <div className="grid gap-2">
            <Link href="/admin/acessos" className="rounded border border-border bg-surface p-4 hover:bg-surface-muted transition-colors">
              <p className="text-body font-medium text-foreground">Acessos Beta</p>
              <p className="text-caption text-muted mt-1">Analisar, aprovar, revogar e acompanhar acessos.</p>
            </Link>
            <Link href="/admin/empresas" className="rounded border border-border bg-surface p-4 hover:bg-surface-muted transition-colors">
              <p className="text-body font-medium text-foreground">Empresas</p>
              <p className="text-caption text-muted mt-1">Consultar empresas e situação da operação.</p>
            </Link>
            <Link href="/admin/usuarios" className="rounded border border-border bg-surface p-4 hover:bg-surface-muted transition-colors">
              <p className="text-body font-medium text-foreground">Usuários</p>
              <p className="text-caption text-muted mt-1">Consultar contas e vínculos da plataforma.</p>
            </Link>
            <Link href="/admin/auditoria" className="rounded border border-border bg-surface p-4 hover:bg-surface-muted transition-colors">
              <p className="text-body font-medium text-foreground">Auditoria</p>
              <p className="text-caption text-muted mt-1">Ver eventos administrativos registrados.</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
