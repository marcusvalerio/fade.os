import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateServiceRecord, toggleProfessionalOnService } from "@/actions/servicos";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Service, Professional } from "@/lib/types";

export default async function ServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("service")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!service) notFound();

  const { data: allProfessionals } = await supabase
    .from("professional")
    .select("*")
    .eq("company_id", (service as Service).company_id)
    .order("name");

  const { data: links } = await supabase
    .from("professional_service")
    .select("professional_id")
    .eq("service_id", id);

  const linkedIds = new Set((links ?? []).map((l) => l.professional_id));
  const updateAction = updateServiceRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-page-title text-foreground mb-6">{(service as Service).name}</h1>
        <form
          action={updateAction}
          className="rounded-md border border-border bg-surface p-6 space-y-4"
        >
          <Field name="name" label="Nome" required>
            <Input id="name" name="name" defaultValue={service.name} required />
          </Field>
          <Field name="description" label="Descrição">
            <Textarea id="description" name="description" rows={2} defaultValue={service.description ?? ""} />
          </Field>
          <Field name="category" label="Categoria">
            <Input id="category" name="category" defaultValue={service.category ?? ""} />
          </Field>
          <Field name="default_price" label="Preço (R$)" required>
            <Input
              id="default_price"
              name="default_price"
              type="number"
              step="0.01"
              defaultValue={service.default_price.toString()}
              required
            />
          </Field>
          <Field name="planned_duration_minutes" label="Duração planejada (minutos)" required>
            <Input
              id="planned_duration_minutes"
              name="planned_duration_minutes"
              type="number"
              defaultValue={service.planned_duration_minutes.toString()}
              required
            />
          </Field>
          <Field name="default_commission_percent" label="Comissão padrão (%)">
            <Input
              id="default_commission_percent"
              name="default_commission_percent"
              type="number"
              step="0.01"
              defaultValue={service.default_commission_percent?.toString() ?? ""}
            />
          </Field>
          <Field name="status" label="Status">
            <Select id="status" name="status" defaultValue={service.status}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
          </Field>
          <p className="text-helper text-muted">
            Alterar preço ou comissão aqui não afeta atendimentos já registrados — eles guardam o
            valor congelado no momento em que foram feitos.
          </p>
          <Button type="submit" className="w-full">
            Salvar alterações
          </Button>
        </form>
      </div>

      <div>
        <h2 className="text-section-title text-foreground mb-3">Profissionais que realizam este serviço</h2>
        <Surface>
          {(allProfessionals as Professional[] | null)?.length ? (
            (allProfessionals as Professional[]).map((p) => {
              const isLinked = linkedIds.has(p.id);
              return (
                <SurfaceRow key={p.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-foreground">{p.name}</span>
                  <form
                    action={async () => {
                      "use server";
                      await toggleProfessionalOnService(id, p.id, !isLinked);
                    }}
                  >
                    <button type="submit">
                      <Badge tone={isLinked ? "success" : "neutral"}>
                        {isLinked ? "Associado" : "Associar"}
                      </Badge>
                    </button>
                  </form>
                </SurfaceRow>
              );
            })
          ) : (
            <EmptyState
              title="Nenhum profissional cadastrado ainda"
              description="Cadastre profissionais para poder associá-los a este serviço."
            />
          )}
        </Surface>
      </div>
    </div>
  );
}
