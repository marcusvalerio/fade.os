import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";

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
  company_suspended: "Empresa suspensa",
  company_reactivated: "Empresa reativada",
};

/**
 * Leitura de platform_audit_log — nunca senha, token, service role key ou
 * o código de autorização (que nem existe neste nível). O que write_
 * platform_audit_log grava já é só metadado de decisão.
 */
export default async function AdminAuditLogPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_audit_log")
    .select("id, actor_id, action, entity_type, entity_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const entries = (data ?? []) as AuditEntry[];

  return (
    <div>
      <PageHeader title="Auditoria" description="Toda ação de nível plataforma, mais recente primeiro." />

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
