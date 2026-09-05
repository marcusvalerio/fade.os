import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateClientRecord } from "@/actions/clientes";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { InsightNote } from "@/components/ui/insight-note";
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

  const insight = returnInsight((attendances ?? []) as Attendance[]);
  const updateAction = updateClientRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-page-title text-foreground mb-1">{(client as Client).name}</h1>
        {insight && (
          <div className="mb-5">
            <InsightNote label="Retorno previsto">{insight}</InsightNote>
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
          {(attendances as Attendance[] | null)?.length ? (
            (attendances as Attendance[]).map((a) => (
              <SurfaceRow key={a.id} className="flex justify-between text-body-sm">
                <span className="text-foreground">Atendimento</span>
                <span className="text-muted">{STATUS_LABEL[a.status] ?? a.status}</span>
              </SurfaceRow>
            ))
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
