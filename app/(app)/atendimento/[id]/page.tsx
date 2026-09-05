import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markItemStarted, markItemEnded, completeAttendance } from "@/actions/atendimento";
import AddItemForm from "./AddItemForm";
import type { AttendanceItem } from "@/lib/types";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl">{(attendance as { client: { name: string } }).client?.name}</h1>
          <p className="text-sm text-[var(--color-midnight-smoke)]">
            {attendance.origin === "walk_in" ? "Walk-in" : "Originado de agendamento"} ·{" "}
            {attendance.status === "in_progress"
              ? "Em andamento"
              : attendance.status === "completed"
              ? "Concluído"
              : "Cancelado"}
          </p>
        </div>
        {isOpen && (
          <form
            action={async () => {
              "use server";
              await completeAttendance(id);
            }}
          >
            <button
              disabled={!items || items.length === 0}
              className="bg-[var(--color-red-gravy)] text-white text-sm px-4 py-2 rounded-md disabled:opacity-40"
            >
              Concluir atendimento
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(items as AttendanceItem[] | null)?.length ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (items as any[]).map((item) => (
            <div key={item.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {item.service?.name} — {item.professional?.name}
                  </p>
                  <p className="text-xs text-[var(--color-midnight-smoke)]">
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
                  <div className="flex gap-2">
                    {!item.started_at && (
                      <form
                        action={async () => {
                          "use server";
                          await markItemStarted(item.id, id);
                        }}
                      >
                        <button className="text-xs px-3 py-1 rounded-full bg-gray-100">
                          Iniciar
                        </button>
                      </form>
                    )}
                    {item.started_at && !item.ended_at && (
                      <form
                        action={async () => {
                          "use server";
                          await markItemEnded(item.id, id);
                        }}
                      >
                        <button className="text-xs px-3 py-1 rounded-full bg-gray-100">
                          Finalizar
                        </button>
                      </form>
                    )}
                    {item.ended_at && (
                      <span className="text-xs text-green-700">concluído</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
            Nenhum serviço adicionado ainda.
          </p>
        )}
        {items && items.length > 0 && (
          <div className="px-4 py-3 flex justify-between text-sm font-medium">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        )}
      </div>

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
