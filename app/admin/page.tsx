import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso } from "@/components/ui/estado";

const EXPIRING_SOON_DAYS = 7;

/**
 * Visão geral — só números que o banco realmente calcula. Nada de métrica
 * inventada: se não dá para calcular com segurança (ex.: "empresas ativas"
 * exigiria uma definição de "ativa" que ainda não existe no schema), o
 * indicador simplesmente não entra aqui.
 */
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

  const indicadores = [
    { label: "Empresas cadastradas", valor: totalCompanies },
    { label: "Usuários na plataforma", valor: totalUsers },
    { label: "Beta ativos", valor: active },
    { label: "Beta aguardando análise", valor: pending },
  ];

  const temAtencao = pending > 0 || expiringSoon > 0 || expired > 0 || suspendedCompanies > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Números reais do banco — nada aqui é estimado."
      />

      {temAtencao && (
        <section>
          <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Atenção</p>
          <Aviso tom="atencao">
            {[
              pending > 0 && `${pending} solicitaç${pending === 1 ? "ão" : "ões"} de Beta aguardando análise`,
              expiringSoon > 0 && `${expiringSoon} Beta expirando em até ${EXPIRING_SOON_DAYS} dias`,
              expired > 0 && `${expired} Beta expirado(s)`,
              suspendedCompanies > 0 && `${suspendedCompanies} empresa(s) suspensa(s)`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {" — "}
            <Link href="/admin/acessos" className="underline">
              ver Acessos Beta
            </Link>
          </Aviso>
        </section>
      )}

      <Surface className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y-0 sm:divide-y-0 divide-border">
        {indicadores.map((item) => (
          <SurfaceRow key={item.label} className="py-5">
            <p className="text-label uppercase text-muted truncate">{item.label}</p>
            <p className="text-metric font-heading text-foreground tabular-nums mt-2">{item.valor}</p>
          </SurfaceRow>
        ))}
      </Surface>
    </div>
  );
}
