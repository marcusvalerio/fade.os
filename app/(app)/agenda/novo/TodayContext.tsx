import { createClient } from "@/lib/supabase/server";
import { businessDayBounds, businessToday, formatBusinessTime, formatBusinessDayLabel } from "@/lib/time";
import { Vazio } from "@/components/ui/estado";

/**
 * O contexto real ao lado do formulário (R22).
 *
 * Um formulário de agendamento sozinho numa tela de 1280px vira "campo,
 * campo, campo, muito vazio" — mas inventar um card para preencher espaço é
 * pior: informação fictícia mina confiança na primeira vez que alguém nota.
 * O que existe de real e relevante enquanto se agenda é a própria agenda:
 * o que já está marcado hoje, para não dobrar um horário de vista. Mesma
 * query da tela de Agenda, sem as ações — aqui é leitura, não operação.
 */
export async function TodayContext({ companyId }: { companyId: string }) {
  const supabase = await createClient();
  const today = businessToday();
  const { start, end } = businessDayBounds(today);

  const { data: unit } = await supabase
    .from("unit")
    .select("id")
    .eq("company_id", companyId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: lines } = unit
    ? await supabase
        .from("appointment_service")
        .select("id, starts_at, service:service_id(name), professional:professional_id(name), appointment:appointment_id(status, client:client_id(name))")
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at")
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (lines ?? []) as any[];
  const ativos = rows.filter((r) => !["cancelled_by_client", "cancelled_by_company", "no_show"].includes(r.appointment?.status));

  return (
    <div>
      <p className="text-label uppercase text-muted mb-1">Hoje</p>
      <p className="text-body-sm text-foreground mb-4">
        {formatBusinessDayLabel(today, { weekday: "long", day: "2-digit", month: "long" })}
      </p>

      {ativos.length === 0 ? (
        <Vazio
          titulo="Nada agendado ainda"
          descricao="O primeiro horário do dia aparece aqui assim que for criado."
        />
      ) : (
        <ul className="space-y-3">
          {ativos.map((r) => (
            <li key={r.id} className="flex items-baseline gap-3">
              <span className="text-body-sm tabular-nums text-muted shrink-0 w-11">
                {formatBusinessTime(r.starts_at)}
              </span>
              <div className="min-w-0">
                <p className="text-body-sm text-foreground truncate">{r.appointment?.client?.name ?? "Cliente"}</p>
                <p className="text-caption text-muted truncate">
                  {r.service?.name} · {r.professional?.name}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
