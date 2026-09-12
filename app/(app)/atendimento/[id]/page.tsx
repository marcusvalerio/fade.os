import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCompanyManager } from "@/lib/permissions";
import { markItemStarted, markItemEnded, cancelAttendance } from "@/actions/atendimento";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { InsightNote } from "@/components/ui/insight-note";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TickingRefresh } from "@/components/ticking-refresh";
import { formatCurrency, formatMinutes } from "@/lib/format";
import AddItemForm from "./AddItemForm";
import AddProductForm from "./AddProductForm";
import EditItemForm from "./EditItemForm";
import CloseAttendanceForm from "./CloseAttendanceForm";
import { AttendanceSyncProvider } from "./AttendanceSync";
import { AttendanceTotal } from "./AttendanceTotal";
import { rotularHomonimos } from "@/lib/pessoas";
import type { AttendanceItem, PaymentMethodKey } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label uppercase text-muted">{label}</p>
      <p className="text-body-sm font-medium text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

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
    .select("*, service:service_id(name), professional:professional_id(name), product:product_id(name)")
    .eq("attendance_id", id)
    .order("created_at");

  // A mesma fronteira da Agenda e do motor: ativo E cobrável. Antes aqui era
  // só `status = 'active'`, então um serviço de -R$ 50,00 ainda entrava.
  const { data: services } = await supabase
    .from("service_operational")
    .select("id, name, default_price, planned_duration_minutes")
    .eq("company_id", attendance.company_id)
    .order("name");

  // O vínculo não filtrava `active`: profissional desativado continuava sendo
  // oferecido para novos itens do atendimento.
  const { data: links } = await supabase
    .from("professional_service")
    // phone entra junto porque é o que desempata dois colegas de mesmo nome E
    // mesma função — sem ele a lista mostrava duas opções idênticas.
    .select("service_id, professional:professional_id!inner(id, name, active, role_title, phone, email)")
    .eq("professional.active", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porServico: Record<string, any[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (links ?? []).forEach((l: any) => {
    if (!l.professional) return;
    (porServico[l.service_id] ??= []).push(l.professional);
  });
  // Homônimos ganham um identificador dentro da lista em que colidem.
  const professionalsByService: Record<string, { id: string; name: string }[]> = {};
  Object.entries(porServico).forEach(([serviceId, lista]) => {
    professionalsByService[serviceId] = rotularHomonimos(lista);
  });

  const { data: products } = await supabase
    .from("product")
    .select("id, name, sale_price")
    .eq("company_id", attendance.company_id)
    .eq("active", true)
    .order("name");

  const { data: paymentMethods } = await supabase
    .from("payment_method")
    .select("method")
    .eq("company_id", attendance.company_id)
    .eq("active", true);

  const activeMethods = (paymentMethods ?? []).map((p) => p.method as PaymentMethodKey);

  // Mesma regra do PDV: sem caixa aberto o banco recusa dinheiro, então a
  // tela não oferece.
  const { data: openCashSession } = await supabase.rpc("get_open_cash_session", {
    p_unit_id: attendance.unit_id,
  });

  const total = (items ?? []).reduce((sum, i) => sum + Number(i.final_price), 0);
  const isOpen = attendance.status === "in_progress";

  // owner/admin autorizam desconto e cortesia pelo próprio papel; os demais
  // precisam apresentar o código da empresa. Isto só decide se o campo
  // aparece — quem exige de verdade é o banco.
  const requiresAuthorization = !(await isCompanyManager(attendance.company_id));
  const nowMs = Date.now();
  const hasRunningItem = (items ?? []).some((i) => i.started_at && !i.ended_at);

  return (
    <AttendanceSyncProvider>
    <div className="max-w-2xl space-y-6">
      <RealtimeRefresh tables={["attendance", "attendance_item"]} />
      <TickingRefresh active={hasRunningItem} />
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
              <CloseAttendanceForm
                attendanceId={id}
                subtotal={total}
                itemCount={(items ?? []).length}
                activeMethods={activeMethods}
                cashSessionOpen={Boolean(openCashSession)}
                requiresAuthorization={requiresAuthorization}
              />
            </div>
          )
        }
      />

      <Surface>
        {(items as AttendanceItem[] | null)?.length ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (items as any[]).map((item) => {
            const isProduct = item.kind === "product";
            const elapsedMinutes = item.started_at
              ? Math.round((nowMs - new Date(item.started_at).getTime()) / 60000)
              : null;
            const overtimeMinutes =
              !isProduct && elapsedMinutes != null && !item.ended_at
                ? elapsedMinutes - item.planned_duration_minutes
                : null;

            return (
              <SurfaceRow key={item.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-body font-medium text-foreground">
                      {isProduct ? item.product?.name : item.service?.name}
                      {isProduct && Number(item.quantity) > 1 ? ` × ${item.quantity}` : ""}
                    </p>
                    <p className="text-caption text-muted mt-0.5">
                      {isProduct ? "Produto" : item.professional?.name}
                    </p>
                  </div>
                  {item.type === "courtesy" && <Badge tone="info">cortesia</Badge>}
                  {!isProduct && item.ended_at && <Badge tone="success">concluído</Badge>}
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {!isProduct && (
                    <MetaField label="Duração" value={formatMinutes(item.planned_duration_minutes)} />
                  )}
                  <MetaField
                    label="Preço"
                    value={
                      item.type === "courtesy"
                        ? `${formatCurrency(0)} (era ${formatCurrency(Number(item.original_price))})`
                        : formatCurrency(Number(item.final_price))
                    }
                  />
                  {Number(item.discount) > 0 && item.type !== "courtesy" && (
                    <MetaField label="Desconto" value={formatCurrency(Number(item.discount))} />
                  )}
                  {item.commission_amount != null && (
                    <MetaField label="Comissão" value={formatCurrency(Number(item.commission_amount))} />
                  )}
                </div>

                {overtimeMinutes != null && overtimeMinutes > 5 && (
                  <InsightNote label="A inteligência percebeu">
                    {item.professional?.name} está {overtimeMinutes} min acima do tempo previsto para{" "}
                    {item.service?.name?.toLowerCase()}.
                  </InsightNote>
                )}

                {isOpen && (
                  <div className="flex items-center gap-2 pt-1">
                    {!isProduct && !item.started_at && (
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
                    <EditItemForm
                      itemId={item.id}
                      attendanceId={id}
                      originalPrice={Number(item.original_price)}
                      currentDiscount={Number(item.discount)}
                      currentType={item.type}
                      currentCourtesyReason={item.courtesy_reason}
                      requiresAuthorization={requiresAuthorization}
                    />
                  </div>
                )}
              </SurfaceRow>
            );
          })
        ) : (
          <Vazio
            titulo="Nenhum serviço adicionado ainda"
            descricao="Adicione o primeiro serviço abaixo para começar a compor este atendimento."
          />
        )}
        {items && items.length > 0 && (
          <SurfaceRow>
            <AttendanceTotal total={total} />
          </SurfaceRow>
        )}
      </Surface>

      {isOpen && (
        <>
          <AddItemForm
            attendanceId={id}
            services={services ?? []}
            professionalsByService={professionalsByService}
            requiresAuthorization={requiresAuthorization}
          />
          <AddProductForm
            attendanceId={id}
            products={products ?? []}
            requiresAuthorization={requiresAuthorization}
          />
        </>
      )}
    </div>
    </AttendanceSyncProvider>
  );
}
