import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateClientRecord } from "@/actions/clientes";
import { ClientForm } from "../ClientForm";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { formatCurrency } from "@/lib/format";
import { comportamentoDoCliente } from "@/lib/crm";
import { SituacaoCliente } from "../SituacaoCliente";
import type { Client, Attendance } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

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

  // A mesma régua da lista de Clientes (lib/crm.ts), sobre as mesmas
  // visitas concluídas — a ficha não pode dizer "ativo" se a lista diz
  // "atenção".
  const visitasMs = completedAttendances
    .map((a) => new Date((a as unknown as { created_at: string }).created_at).getTime())
    .sort((a, b) => a - b);
  const comportamento = visitasMs.length ? comportamentoDoCliente(id, visitasMs, Date.now()) : null;
  const telefone = (client as Client).phone;
  const updateAction = updateClientRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      {/* 1. Quem é e como está — a resposta de quem abre a ficha no balcão. */}
      <header>
        <h1 className="text-page-title text-foreground">{(client as Client).name}</h1>
        <p className="text-body-sm text-muted mt-1 tabular-nums">{telefone || "sem telefone"}</p>
        {(client as Client).notes && (
          <p className="mt-3 max-w-measure-long border-l-2 border-border-strong pl-3 text-body-sm text-foreground">
            {(client as Client).notes}
          </p>
        )}
        {comportamento && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
            <SituacaoCliente status={comportamento.status} />
            {comportamento.avgGapDays != null && (
              <span>
                · costuma voltar a cada {comportamento.avgGapDays} {comportamento.avgGapDays === 1 ? "dia" : "dias"}
              </span>
            )}
            {comportamento.daysSinceVisit != null && (
              <span>
                ·{" "}
                {comportamento.daysSinceVisit === 0
                  ? "veio hoje"
                  : `última visita há ${comportamento.daysSinceVisit} ${comportamento.daysSinceVisit === 1 ? "dia" : "dias"}`}
              </span>
            )}
          </p>
        )}
      </header>

      {/* 2. O relacionamento em números. */}
      {completedAttendances.length > 0 && (
        <StatGrid columns={4}>
          <StatTile
            label="Última visita"
            value={
              lastVisit
                ? new Date(lastVisit).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                : "—"
            }
          />
          <StatTile label="Visitas" value={completedAttendances.length} />
          <StatTile label="Ticket médio" value={avgTicket != null ? formatCurrency(avgTicket) : "—"} />
          <StatTile label="Mais pedido" value={topService ?? "—"} />
        </StatGrid>
      )}

      {/* 3. O histórico — o que foi feito, por quanto e por quem. */}
      <section>
        <h2 className="text-section-title text-foreground mb-3">Histórico de atendimentos</h2>
        <Surface>
          {attendanceList.length > 0 ? (
            attendanceList.map((a) => {
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
            <Vazio
              titulo="Nenhum atendimento ainda"
              descricao="Assim que o primeiro atendimento for concluído, o que foi feito, por quanto e por quem passa a ficar registrado aqui."
            />
          )}
        </Surface>
      </section>

      {/* 4. Os dados cadastrais — necessários de vez em quando, não a cada
          visita. Ficam recolhidos até alguém precisar editar. */}
      <details className="group rounded-md border border-border">
        <summary className="alvo-toque flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-body-sm font-medium text-foreground">
          Dados e contato
          <span aria-hidden="true" className="text-caption text-muted group-open:hidden">
            Editar
          </span>
          <span aria-hidden="true" className="hidden text-caption text-muted group-open:inline">
            Fechar
          </span>
        </summary>
        <div className="border-t border-border px-4 py-5">
          <ClientForm
            action={updateAction}
            modo="editar"
            valores={{
              name: client.name,
              phone: client.phone,
              email: client.email,
              birth_date: client.birth_date,
              notes: client.notes,
              communication_consent: client.communication_consent,
            }}
          />
        </div>
      </details>
    </div>
  );
}
