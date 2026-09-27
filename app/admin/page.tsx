import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkPlatformHealth } from "@/lib/platform-health";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Aviso } from "@/components/ui/estado";
import { StatusIndicator } from "./StatusIndicator";

const EXPIRING_SOON_DAYS = 7;

/**
 * "Está tudo funcionando?" é a pergunta que esta tela precisa responder
 * primeiro — por isso Status da plataforma vem antes dos números de
 * negócio, não depois.
 */
export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ data: companies }, { data: users }, { data: betaRequests }, health] = await Promise.all([
    supabase.rpc("admin_list_companies"),
    supabase.rpc("admin_list_users"),
    supabase.from("beta_access_requests").select("status, beta_expires_at"),
    checkPlatformHealth(),
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

  const servicosDegradados = health.filter((h) => h.status === "degraded" || h.status === "down");
  const temAtencao =
    pending > 0 || expiringSoon > 0 || expired > 0 || suspendedCompanies > 0 || servicosDegradados.length > 0;

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
        description="Controle da plataforma CORTEX.OS: saúde dos serviços, empresas, usuários e Beta."
      />

      {temAtencao && (
        <section>
          <p className="text-label uppercase tracking-label text-muted mb-3">Atenção</p>
          <Aviso tom="atencao">
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {servicosDegradados.map((s) => (
                <Link key={s.service} href="/admin/sistema" className="underline">
                  {s.service} {s.status === "down" ? "fora do ar" : "degradado"}
                </Link>
              ))}
              {pending > 0 && <Link href="/admin/acessos" className="underline">{pending} solicitação(ões) pendente(s)</Link>}
              {expiringSoon > 0 && <Link href="/admin/acessos" className="underline">{expiringSoon} Beta expirando em até {EXPIRING_SOON_DAYS} dias</Link>}
              {expired > 0 && <Link href="/admin/acessos" className="underline">{expired} Beta expirado(s)</Link>}
              {suspendedCompanies > 0 && <Link href="/admin/empresas" className="underline">{suspendedCompanies} empresa(s) suspensa(s)</Link>}
            </div>
          </Aviso>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <p className="text-label uppercase tracking-label text-muted">Status</p>
            <h2 className="text-section-title font-heading text-foreground mt-1">Saúde da plataforma</h2>
          </div>
          <Link href="/admin/sistema" className="text-caption text-muted hover:text-foreground underline">Ver System Health</Link>
        </div>
        <Surface>
          {health.map((s) => (
            <SurfaceRow key={s.service} className="flex items-center justify-between gap-4">
              <span className="text-body-sm text-foreground truncate">{s.service}</span>
              <span className="shrink-0">
                <StatusIndicator status={s.status} />
              </span>
            </SurfaceRow>
          ))}
        </Surface>
      </section>

      <section>
        <p className="text-label uppercase tracking-label text-muted mb-3">Negócio</p>
        <StatGrid>
          <Link href="/admin/empresas" className="block hover:opacity-80 transition-opacity duration-fast ease-standard">
            <StatTile label="Empresas" value={totalCompanies} />
          </Link>
          <Link href="/admin/usuarios" className="block hover:opacity-80 transition-opacity duration-fast ease-standard">
            <StatTile label="Usuários" value={totalUsers} />
          </Link>
          <Link href="/admin/acessos" className="block hover:opacity-80 transition-opacity duration-fast ease-standard">
            <StatTile label="Beta ativos" value={active} tone="success" />
          </Link>
          <Link href="/admin/acessos" className="block hover:opacity-80 transition-opacity duration-fast ease-standard">
            <StatTile label="Beta pendentes" value={pending} tone={pending > 0 ? "warning" : "neutral"} />
          </Link>
        </StatGrid>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <p className="text-label uppercase tracking-label text-muted">Beta</p>
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
            <p className="text-label uppercase tracking-label text-muted">Plataforma</p>
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
              <p className="text-body font-medium text-foreground">Segurança</p>
              <p className="text-caption text-muted mt-1">Ver eventos administrativos registrados.</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
