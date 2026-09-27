import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { CompanyActions } from "./CompanyActions";
import { atividadeDasEmpresas, haQuanto, ROTULO_DA_ACAO } from "@/lib/admin";

type CompanyDetail = {
  company: {
    id: string;
    name: string;
    trade_name: string | null;
    slug: string;
    city: string | null;
    state: string | null;
    address: string | null;
    email: string | null;
    status: "active" | "suspended";
    suspension_reason: string | null;
    suspended_at: string | null;
    created_at: string;
    onboarding_completed_at: string | null;
  };
  unit_address: string | null;
  counts: {
    users: number;
    professionals: number;
    clients: number;
    services: number;
    products: number;
    appointments: number;
    sales: number;
    sales_total: number;
  };
  access: Array<{
    user_id: string;
    email: string;
    role: string;
    linked_at: string;
    last_sign_in_at: string | null;
  }>;
  last_activity_at: string | null;
  beta: {
    status: string;
    created_at: string;
    approved_at: string | null;
    beta_period_months: number | null;
    beta_expires_at: string | null;
    region: string | null;
  } | null;
  audit: Array<{ id: string; action: string; entity_type: string; reason: string | null; created_at: string; user_id: string | null }>;
  platform_audit: Array<{ id: string; action: string; reason: string | null; created_at: string }>;
};

const ROLE_LABEL: Record<string, string> = { owner: "Responsável", admin: "Gerente", staff: "Equipe" };

export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, atividades] = await Promise.all([
    supabase.rpc("admin_get_company_detail", { p_company_id: id }),
    atividadeDasEmpresas(30),
  ]);

  if (error || !data) notFound();
  const atividade = atividades?.find((a) => a.id === id) ?? null;
  const detail = data as CompanyDetail;
  const { company, counts, access, beta, audit, platform_audit: platformAudit } = detail;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={company.name}
          description={`/${company.slug}${company.city ? ` · ${company.city}${company.state ? `/${company.state}` : ""}` : ""}`}
        />
        <div className="flex items-center gap-3">
          {company.status === "suspended" ? (
            <Badge tone="danger">Suspensa</Badge>
          ) : (
            <Badge tone={company.onboarding_completed_at ? "success" : "neutral"}>
              {company.onboarding_completed_at ? "Operacional" : "Em configuração"}
            </Badge>
          )}
          <CompanyActions companyId={company.id} status={company.status} />
        </div>
      </div>

      {company.status === "suspended" && company.suspension_reason && (
        <Surface>
          <SurfaceRow>
            <p className="text-body-sm text-foreground">
              <span className="font-medium">Motivo da suspensão:</span> {company.suspension_reason}
            </p>
            {company.suspended_at && (
              <p className="text-caption text-muted mt-0.5">
                desde {new Date(company.suspended_at).toLocaleString("pt-BR")}
              </p>
            )}
          </SurfaceRow>
        </Surface>
      )}

      {atividade && (
        <Secao titulo="Movimento nos últimos 30 dias">
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border border border-border rounded-md overflow-hidden">
            {[
              ["Agendamentos", String(atividade.agendamentos_periodo)],
              ["Atendimentos", String(atividade.atendimentos_periodo)],
              ["Receita", formatCurrency(atividade.receita_periodo)],
              ["Módulos em uso", `${atividade.modulos_usados} de 7`],
              ["Última atividade", haQuanto(atividade.ultima_atividade)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="bg-surface p-4 min-w-0">
                <dt className="font-subtitle text-caption text-muted truncate">{rotulo}</dt>
                <dd className="numero text-body text-foreground mt-1.5 truncate">{valor}</dd>
              </div>
            ))}
          </dl>
        </Secao>
      )}

      <Secao titulo="Identidade">
        <Campo label="Nome" valor={company.name} />
        {company.trade_name && company.trade_name !== company.name && <Campo label="Nome fantasia" valor={company.trade_name} />}
        <Campo label="Endereço" valor={detail.unit_address ?? company.address ?? "Não informado"} />
        <Campo label="Criada em" valor={new Date(company.created_at).toLocaleDateString("pt-BR")} />
        <Campo
          label="Onboarding"
          valor={company.onboarding_completed_at ? `Concluído em ${new Date(company.onboarding_completed_at).toLocaleDateString("pt-BR")}` : "Não concluído"}
        />
      </Secao>

      <Secao titulo="Beta">
        {beta ? (
          <>
            <Campo label="Status da solicitação" valor={beta.status} />
            <Campo label="Solicitado em" valor={new Date(beta.created_at).toLocaleDateString("pt-BR")} />
            {beta.approved_at && <Campo label="Aprovado em" valor={new Date(beta.approved_at).toLocaleDateString("pt-BR")} />}
            {beta.beta_period_months && <Campo label="Período concedido" valor={`${beta.beta_period_months} mês(es)`} />}
            {beta.beta_expires_at && (
              <Campo label="Expira em" valor={new Date(beta.beta_expires_at).toLocaleDateString("pt-BR")} />
            )}
          </>
        ) : (
          <p className="text-body-sm text-muted">
            Nenhuma solicitação de Beta encontrada para o e-mail cadastrado desta empresa.
          </p>
        )}
      </Secao>

      <Secao titulo="Tamanho da operação (total)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
          <Metrica label="Usuários" valor={counts.users} />
          <Metrica label="Profissionais" valor={counts.professionals} />
          <Metrica label="Clientes" valor={counts.clients} />
          <Metrica label="Serviços" valor={counts.services} />
          <Metrica label="Produtos" valor={counts.products} />
          <Metrica label="Agendamentos" valor={counts.appointments} />
          <Metrica label="Vendas concluídas" valor={counts.sales} />
          <Metrica label="Volume financeiro" valor={formatCurrency(counts.sales_total)} />
        </div>
      </Secao>

      <Secao titulo="Acesso">
        {access.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum usuário vinculado.</p>
        ) : (
          <Surface>
            {access.map((a) => (
              <SurfaceRow key={a.user_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-body-sm text-foreground truncate">{a.email}</p>
                  <p className="text-caption text-muted">
                    {ROLE_LABEL[a.role] ?? a.role} · vinculado em {new Date(a.linked_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className="text-caption text-muted shrink-0">
                  {a.last_sign_in_at ? `último acesso em ${new Date(a.last_sign_in_at).toLocaleDateString("pt-BR")}` : "nunca acessou"}
                </p>
              </SurfaceRow>
            ))}
          </Surface>
        )}
      </Secao>

      <Secao titulo="Atividade">
        <Campo
          label="Última atividade registrada"
          valor={detail.last_activity_at ? new Date(detail.last_activity_at).toLocaleString("pt-BR") : "Nenhuma atividade ainda"}
        />
      </Secao>

      <Secao titulo="Auditoria">
        {audit.length === 0 && platformAudit.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <Surface>
            {platformAudit.map((entry) => (
              <SurfaceRow key={`p-${entry.id}`}>
                <p className="text-body-sm text-foreground">{ROTULO_DA_ACAO[entry.action] ?? entry.action}</p>
                <p className="text-caption text-muted">
                  {new Date(entry.created_at).toLocaleString("pt-BR")}
                  {entry.reason ? ` · "${entry.reason}"` : ""}
                </p>
              </SurfaceRow>
            ))}
            {audit.map((entry) => (
              <SurfaceRow key={entry.id}>
                <p className="text-body-sm text-foreground">
                  {ROTULO_DA_ACAO[entry.action] ?? entry.action} <span className="text-muted">· {entry.entity_type}</span>
                </p>
                <p className="text-caption text-muted">{new Date(entry.created_at).toLocaleString("pt-BR")}</p>
              </SurfaceRow>
            ))}
          </Surface>
        )}
      </Secao>

      <Link href="/admin/empresas" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
        ← Voltar para Empresas
      </Link>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-section-title text-foreground mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-body-sm text-foreground">
      <span className="text-muted">{label}:</span> {valor}
    </p>
  );
}

function Metrica({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="bg-surface px-4 py-3.5 min-w-0">
      <p className="font-subtitle text-caption text-muted truncate">{label}</p>
      <p className="numero text-body text-foreground mt-1 truncate">{valor}</p>
    </div>
  );
}
