import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { BetaRequestActions } from "./BetaRequestActions";
import { ProvedorDeResultado } from "./ResultadoDaAcao";

type BetaRequest = {
  id: string;
  email: string;
  name: string;
  barbershop_name: string;
  phone: string | null;
  region: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  created_at: string;
  beta_expires_at: string | null;
  provisioned_user_id: string | null;
  provisioned_company_id: string | null;
};

const STATUS_LABEL: Record<BetaRequest["status"], string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  revoked: "Revogada",
};

const STATUS_TONE: Record<BetaRequest["status"], "neutral" | "success" | "danger" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  revoked: "neutral",
};

export default async function AdminBetaAccessPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("beta_access_requests")
    .select("id, email, name, barbershop_name, phone, region, status, created_at, beta_expires_at, provisioned_user_id, provisioned_company_id")
    .order("created_at", { ascending: false });

  // Pendentes primeiro: é o que pede decisão, e é para onde a faixa
  // "IMPORTANTE" do Admin leva (#pendentes). Dentro de cada grupo, o mais
  // recente em cima, como antes.
  const requests = ((data ?? []) as BetaRequest[]).sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending")
  );
  const pendentes = requests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Acessos Beta"
        description="Solicitações vindas de /beta. Aprovar cria (ou reaproveita) a conta e a barbearia, e mostra a credencial provisória para você repassar."
      />

      {error ? (
        <Vazio titulo="Não foi possível carregar as solicitações" descricao={error.message} />
      ) : requests.length === 0 ? (
        <Vazio
          titulo="Nenhuma solicitação de Beta ainda"
          descricao="Quando alguém preencher o formulário público, a solicitação aparece aqui."
        />
      ) : (
        <ProvedorDeResultado>
        <Surface>
          {requests.map((request, i) => (
            <SurfaceRow
              key={request.id}
              id={i === 0 && pendentes > 0 ? "pendentes" : undefined}
              className="scroll-mt-24 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-body font-medium text-foreground truncate">{request.barbershop_name}</p>
                  <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                </div>
                <p className="text-caption text-muted truncate">
                  {request.name} · {request.email}
                  {request.region ? ` · ${request.region}` : ""}
                  {request.phone ? ` · ${request.phone}` : ""}
                </p>
                <p className="text-caption text-muted">
                  {new Date(request.created_at).toLocaleString("pt-BR")}
                  {request.status === "approved" && request.beta_expires_at
                    ? ` · Beta até ${new Date(request.beta_expires_at).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <BetaRequestActions
                id={request.id}
                status={request.status}
                name={request.name}
                phone={request.phone}
                provisionedUserId={request.provisioned_user_id}
                provisionedCompanyId={request.provisioned_company_id}
              />
            </SurfaceRow>
          ))}
        </Surface>
        </ProvedorDeResultado>
      )}
    </div>
  );
}
