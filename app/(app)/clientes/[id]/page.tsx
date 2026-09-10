import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateClientRecord } from "@/actions/clientes";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { InsightNote } from "@/components/ui/insight-note";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Client, Attendance } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function returnInsight(attendances: Attendance[]) {
  const completed = attendances
    .filter((a) => a.status === "completed")
    .map((a) => new Date((a as unknown as { created_at: string }).created_at).getTime())
    .sort((a, b) => a - b);

  if (completed.length < 2) return null;

  const gaps = completed.slice(1).map((t, i) => (t - completed[i]) / (1000 * 60 * 60 * 24));
  const avg = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  if (avg < 1) return null;

  const low = Math.max(1, Math.round(avg * 0.8));
  const high = Math.round(avg * 1.2);
  return `Costuma retornar em ${low}–${high} dias.`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3.5 bg-surface">
      <p className="text-section-title font-heading tabular-nums text-foreground leading-none">{value}</p>
      <p className="text-label uppercase text-muted mt-1.5">{label}</p>
    </div>
  );
}

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("client")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: attendances } = await supabase
    .from("attendance")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const attendanceList = (attendances ?? []) as Attendance[];
  const completedAttendances = attendanceList.filter((a) => a.status === "completed");
  const attendanceIds = completedAttendances.map((a) => a.id);

  const { data: items } = attendanceIds.length
    ? await supabase
        .from("attendance_item")
        .select("attendance_id, final_price, service:service_id(name), professional:professional_id(name)")
        .in("attendance_id", attendanceIds)
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemRows = (items ?? []) as any[];
  const totalRevenue = itemRows.reduce((sum, i) => sum + Number(i.final_price), 0);
  const avgTicket = completedAttendances.length > 0 ? totalRevenue / completedAttendances.length : null;
  const lastVisit = (attendanceList.find((a) => a.status === "completed") as unknown as
    | { created_at: string }
    | undefined)?.created_at;

  const serviceCounts = new Map<string, number>();
  itemRows.forEach((i) => {
    const name = i.service?.name ?? "Serviço";
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  });
  const topService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const insight = returnInsight(attendanceList);
  const updateAction = updateClientRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-page-title text-foreground mb-4">{(client as Client).name}</h1>

        {completedAttendances.length > 0 && (
          <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden mb-4 animate-rise-in">
            <StatTile
              label="Última visita"
              value={
                lastVisit
                  ? new Date(lastVisit).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                  : "—"
              }
            />
            <StatTile label="Visitas" value={String(completedAttendances.length)} />
            <StatTile label="Ticket médio" value={avgTicket != null ? formatCurrency(avgTicket) : "—"} />
          </div>
        )}

        {(insight || topService) && (
          <div className="mb-5">
            <InsightNote label="Sobre este cliente">
              {[insight, topService && `Serviço mais frequente: ${topService.toLowerCase()}.`]
                .filter(Boolean)
                .join(" ")}
            </InsightNote>
          </div>
        )}

        <form
          action={updateAction}
          className="rounded-md border border-border bg-surface p-6 space-y-4 mt-5"
        >
          <Field name="name" label="Nome" required>
            <Input id="name" name="name" defaultValue={client.name} required />
          </Field>
          <Field name="phone" label="Telefone">
            <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
          </Field>
          <Field name="email" label="E-mail">
            <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
          </Field>
          <Field name="birth_date" label="Data de nascimento">
            <Input id="birth_date" name="birth_date" type="date" defaultValue={client.birth_date ?? ""} />
          </Field>
          <Field name="notes" label="Observações">
            <Textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""} />
          </Field>
          <label className="flex items-center gap-2 text-body-sm text-foreground">
            <Checkbox name="communication_consent" defaultChecked={client.communication_consent} />
            Aceita receber comunicações
          </label>
          <Button type="submit" className="w-full">
            Salvar alterações
          </Button>
        </form>
      </div>

      <div>
        <h2 className="text-section-title text-foreground mb-3">Histórico de atendimentos</h2>
        <Surface>
          {attendanceList.length > 0 ? (
            attendanceList.map((a) => {
              // A linha respondia só "quando" e "em que estado". O que
              // interessa a quem atende é o relacionamento: o que foi feito,
              // por quanto e por quem — os dados já vinham na consulta e
              // simplesmente não chegavam à tela.
              const itens = itemRows.filter((i) => i.attendance_id === a.id);
              const oQueFoiFeito = [...new Set(itens.map((i) => i.service?.name).filter(Boolean))].join(" + ");
              const quemFez = [...new Set(itens.map((i) => i.professional?.name).filter(Boolean))].join(", ");
              const valor = itens.reduce((soma, i) => soma + Number(i.final_price), 0);
              const criadoEm = (a as unknown as { created_at: string }).created_at;

              return (
                <SurfaceRow key={a.id} className="flex items-baseline gap-4">
                  <span className="text-body-sm tabular-nums text-muted shrink-0 w-20">
                    {new Date(criadoEm).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm text-foreground truncate">
                      {oQueFoiFeito || STATUS_LABEL[a.status] || "Atendimento"}
                    </span>
                    {quemFez && <span className="block text-caption text-muted truncate">{quemFez}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    {valor > 0 && (
                      <span className="block text-body-sm tabular-nums text-foreground">
                        {formatCurrency(valor)}
                      </span>
                    )}
                    {a.status !== "completed" && (
                      <span className="block text-caption text-muted">
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    )}
                  </span>
                </SurfaceRow>
              );
            })
          ) : (
            <EmptyState
              title="Nenhum atendimento registrado ainda"
              description="O histórico deste cliente aparece aqui assim que o primeiro atendimento for concluído."
            />
          )}
        </Surface>
      </div>
    </div>
  );
}
