import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager, getOwnProfessionalId } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { rotularHomonimos } from "@/lib/pessoas";
import { MarkPaidButton } from "./MarkPaidButton";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  predicted: "prevista",
  due: "devida",
  paid: "paga",
  reversed: "revertida",
};

const STATUS_TONE: Record<string, "warning" | "success" | "neutral" | "danger"> = {
  predicted: "neutral",
  due: "warning",
  paid: "success",
  reversed: "danger",
};

export default async function ComissoesPage() {
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const manager = await isCompanyManager(companyId);
  const ownProfessionalId = manager ? null : await getOwnProfessionalId(companyId, user.id);

  let query = supabase
    .from("commission")
    .select(
      // id/phone/role_title do profissional entram só para desempatar
      // homônimos abaixo — a linha carrega o botão "marcar como paga".
      "id, base_amount, percent, amount, status, created_at, professional:professional_id(id, name, phone, role_title), sale_item:sale_item_id(service:service_id(name))"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!manager) {
    if (!ownProfessionalId) {
      return (
        <div className="max-w-2xl">
          <PageHeader title="Comissões" />
          <EmptyState
            title="Nenhum perfil de profissional vinculado"
            description="Sua conta ainda não está ligada a um profissional desta empresa."
          />
        </div>
      );
    }
    query = query.eq("professional_id", ownProfessionalId);
  }

  const { data: commissions } = await query;

  const totalDue = (commissions ?? [])
    .filter((c) => c.status === "due")
    .reduce((sum, c) => sum + Number(c.amount), 0);

  // Pagar a comissão do homônimo errado é erro de dinheiro, e a lista mostrava
  // só o nome. Desdobra-se a lista de comissões nos profissionais distintos
  // que aparecem nela, e o rótulo sai desse conjunto — quem não tem xará
  // continua aparecendo só com o nome.
  const profissionais = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...new Map((commissions ?? []).map((c: any) => [c.professional?.id, c.professional]))
      .values(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ].filter((p: any) => p?.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomes = new Map(rotularHomonimos(profissionais as any[]).map((p) => [p.id, p.name]));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={manager ? "Comissões" : "Minhas comissões"}
        description={`Devido no momento: ${formatCurrency(totalDue)}`}
        action={
          manager ? (
            <Link href="/profissionais" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Ver equipe
            </Link>
          ) : undefined
        }
      />

      <Surface>
        {commissions && commissions.length > 0 ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (commissions as any[]).map((c) => (
            <SurfaceRow key={c.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body-sm font-medium text-foreground">
                  {manager
                    ? nomes.get(c.professional?.id) ?? c.professional?.name
                    : c.sale_item?.service?.name ?? "Serviço"}
                </p>
                <p className="text-caption text-muted mt-0.5">
                  {c.percent}% de {formatCurrency(c.base_amount)} ·{" "}
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-body-sm tabular-nums text-foreground">{formatCurrency(c.amount)}</span>
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                {manager && c.status === "due" && <MarkPaidButton commissionId={c.id} />}
              </div>
            </SurfaceRow>
          ))
        ) : (
          <EmptyState
            title="Nenhuma comissão ainda"
            description="Comissões são geradas automaticamente quando um atendimento é fechado."
          />
        )}
      </Surface>
    </div>
  );
}
