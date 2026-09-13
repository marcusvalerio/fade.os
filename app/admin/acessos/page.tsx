import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { BetaRequestActions } from "./BetaRequestActions";

type BetaRequest = {
  id: string;
  email: string;
  name: string;
  barbershop_name: string;
  phone: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  created_at: string;
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
    .select("id, email, name, barbershop_name, phone, status, created_at")
    .order("created_at", { ascending: false });

  const requests = (data ?? []) as BetaRequest[];

  return (
    <div>
      <PageHeader
        title="Acessos Beta"
        description="Solicitações vindas de /beta. Aprovar aqui não cria a conta ainda — é a decisão que vem antes do convite."
      />

      {error ? (
        <Vazio titulo="Não foi possível carregar as solicitações" descricao={error.message} />
      ) : requests.length === 0 ? (
        <Vazio
          titulo="Nenhuma solicitação de Beta ainda"
          descricao="Quando alguém preencher o formulário público, a solicitação aparece aqui."
        />
      ) : (
        <Surface>
          {requests.map((request) => (
            <SurfaceRow key={request.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-body font-medium text-foreground truncate">{request.barbershop_name}</p>
                  <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                </div>
                <p className="text-caption text-muted truncate">
                  {request.name} · {request.email}
                  {request.phone ? ` · ${request.phone}` : ""}
                </p>
                <p className="text-caption text-muted">
                  {new Date(request.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <BetaRequestActions id={request.id} status={request.status} />
            </SurfaceRow>
          ))}
        </Surface>
      )}
    </div>
  );
}
