import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso, Vazio } from "@/components/ui/estado";

type AuditEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  platform_admin_granted: "Platform admin concedido",
  platform_admin_revoked: "Platform admin revogado",
  beta_request_created: "Solicitação de Beta criada",
  beta_request_approved: "Solicitação de Beta aprovada",
  beta_request_rejected: "Solicitação de Beta rejeitada",
  beta_request_revoked: "Acesso de Beta revogado",
};

/**
 * Segurança da plataforma: o que existe hoje é a auditoria de decisões
 * administrativas (platform_audit_log, gravada por write_platform_audit_
 * log — nunca senha, token ou service role key). O que NÃO existe —
 * tentativas de login falhas, lista de sessões, IP/dispositivo — é dito
 * explicitamente, não simulado.
 */
export default async function AdminSecurityPage() {
  const supabase = await createClient();
  const [{ data, error }, { count: platformAdminCount }] = await Promise.all([
    supabase
      .from("platform_audit_log")
      .select("id, actor_id, action, entity_type, entity_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("platform_admin").select("user_id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const entries = (data ?? []) as AuditEntry[];

  return (
    <div className="space-y-6">
      <PageHeader title="Segurança" description="Auditoria de ações administrativas da plataforma." />

      <StatGrid columns={2}>
        <StatTile label="Platform admins ativos" value={platformAdminCount ?? 0} />
        <StatTile label="Eventos de auditoria (200 mais recentes)" value={entries.length} />
      </StatGrid>

      <Aviso tom="atencao">
        Não registrado hoje: tentativas de login malsucedidas, lista de sessões ativas,
        IP/dispositivo de acesso. O que existe é o registro de toda decisão administrativa —
        conceder/revogar platform admin, aprovar/rejeitar/revogar Beta — abaixo.
      </Aviso>

      {error ? (
        <Vazio titulo="Não foi possível carregar a auditoria" descricao={error.message} />
      ) : entries.length === 0 ? (
        <Vazio titulo="Nenhum evento registrado ainda" />
      ) : (
        <Surface>
          {entries.map((entry) => (
            <SurfaceRow key={entry.id}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-body-sm font-medium text-foreground">
                  {ACTION_LABEL[entry.action] ?? entry.action}
                </p>
                <p className="text-caption text-muted shrink-0">
                  {new Date(entry.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="text-caption text-muted mt-0.5">
                {entry.actor_id ? `por ${entry.actor_id}` : "por visitante anônimo"} · {entry.entity_type}
                {entry.reason ? ` · "${entry.reason}"` : ""}
              </p>
            </SurfaceRow>
          ))}
        </Surface>
      )}
    </div>
  );
}
