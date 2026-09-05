import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markItemStarted, markItemEnded, completeAttendance, cancelAttendance } from "@/actions/atendimento";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import AddItemForm from "./AddItemForm";
import EditItemForm from "./EditItemForm";
import type { AttendanceItem } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export default async function AtendimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*, client:client_id(name)")
    .eq("id", id)
    .maybeSingle();

  if (!attendance) notFound();

  const { data: items } = await supabase
    .from("attendance_item")
    .select("*, service:service_id(name), professional:professional_id(name)")
    .eq("attendance_id", id)
    .order("created_at");

  const { data: services } = await supabase
    .from("service")
    .select("id, name, default_price, planned_duration_minutes")
    .eq("company_id", attendance.company_id)
    .eq("status", "active")
    .order("name");

  const { data: links } = await supabase
    .from("professional_service")
    .select("service_id, professional:professional_id(id, name)");

  const professionalsByService: Record<string, { id: string; name: string }[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (links ?? []).forEach((l: any) => {
    if (!professionalsByService[l.service_id]) professionalsByService[l.service_id] = [];
    professionalsByService[l.service_id].push(l.professional);
  });

  const total = (items ?? []).reduce((sum, i) => sum + Number(i.final_price), 0);
  const isOpen = attendance.status === "in_progress";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title={(attendance as { client: { name: string } }).client?.name ?? "Atendimento"}
        description={`${attendance.origin === "walk_in" ? "Walk-in" : "Originado de agendamento"} · ${STATUS_LABEL[attendance.status]}`}
        action={
          isOpen && (
            <div className="flex gap-2">
              <ConfirmButton
                label="Cancelar"
                confirmTitle="Cancelar atendimento?"
                confirmDescription="Os itens já lançados permanecem no histórico, marcados como cancelados. Essa ação não pode ser desfeita."
                confirmLabel="Cancelar atendimento"
                onConfirm={async () => {
                  "use server";
                  await cancelAttendance(id);
                }}
              />
              <form
                action={async () => {
                  "use server";
                  await completeAttendance(id);
                }}
              >
                <Button type="submit" disabled={!items || items.length === 0}>
                  Concluir atendimento
                </Button>
              </form>
            </div>
          )
        }
      />

      <Surface>
        {(items as AttendanceItem[] | null)?.length ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (items as any[]).map((item) => (
            <SurfaceRow key={item.id}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-body-sm font-medium text-foreground">
                    {item.service?.name} — {item.professional?.name}
                  </p>
                  <p className="text-caption text-muted mt-0.5">
                    {item.type === "courtesy"
                      ? `Cortesia (valor original R$ ${Number(item.original_price).toFixed(2)})`
                      : `R$ ${Number(item.final_price).toFixed(2)}${
                          Number(item.discount) > 0
                            ? ` (desconto de R$ ${Number(item.discount).toFixed(2)})`
                            : ""
                        }`}
                    {item.commission_amount != null &&
                      ` · comissão R$ ${Number(item.commission_amount).toFixed(2)}`}
                  </p>
                </div>
                {isOpen && (
                  <div className="flex items-center gap-2">
                    {!item.started_at && (
                      <form
                        action={async () => {
                          "use server";
                          await markItemStarted(item.id, id);
                        }}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          Iniciar
                        </Button>
                      </form>
                    )}
                    {item.started_at && !item.ended_at && (
                      <form
                        action={async () => {
                          "use server";
                          await markItemEnded(item.id, id);
                        }}
                      >
                        <Button type="submit" variant="secondary" size="sm">
                          Finalizar
                        </Button>
                      </form>
                    )}
                    {item.ended_at && <Badge tone="success">concluído</Badge>}
                    <EditItemForm
                      itemId={item.id}
                      attendanceId={id}
                      originalPrice={Number(item.original_price)}
                      currentDiscount={Number(item.discount)}
                      currentType={item.type}
                      currentCourtesyReason={item.courtesy_reason}
                    />
                  </div>
                )}
              </div>
            </SurfaceRow>
          ))
        ) : (
          <EmptyState
            title="Nenhum serviço adicionado ainda"
            description="Adicione o primeiro serviço abaixo para começar a compor este atendimento."
          />
        )}
        {items && items.length > 0 && (
          <SurfaceRow className="flex justify-between text-body-sm font-medium text-foreground">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </SurfaceRow>
        )}
      </Surface>

      {isOpen && (
        <AddItemForm
          attendanceId={id}
          services={services ?? []}
          professionalsByService={professionalsByService}
        />
      )}
    </div>
  );
}
