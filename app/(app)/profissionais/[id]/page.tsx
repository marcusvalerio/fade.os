import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfessionalRecord } from "@/actions/profissionais";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import type { Professional, Service } from "@/lib/types";

export default async function ProfissionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from("professional")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!professional) notFound();

  const { data: services } = await supabase
    .from("service")
    .select("*, professional_service!inner(professional_id)")
    .eq("company_id", (professional as Professional).company_id)
    .eq("professional_service.professional_id", id);

  const updateAction = updateProfessionalRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-page-title text-foreground mb-6">{(professional as Professional).name}</h1>
        <form
          action={updateAction}
          className="rounded-md border border-border bg-surface p-6 space-y-4"
        >
          <Field name="name" label="Nome" required>
            <Input id="name" name="name" defaultValue={professional.name} required />
          </Field>
          <Field name="email" label="E-mail">
            <Input id="email" name="email" type="email" defaultValue={professional.email ?? ""} />
          </Field>
          <Field name="phone" label="Telefone">
            <Input id="phone" name="phone" defaultValue={professional.phone ?? ""} />
          </Field>
          <Field name="default_commission_percent" label="Comissão padrão (%)">
            <Input
              id="default_commission_percent"
              name="default_commission_percent"
              type="number"
              step="0.01"
              defaultValue={professional.default_commission_percent?.toString() ?? ""}
            />
          </Field>
          <Button type="submit" className="w-full">
            Salvar alterações
          </Button>
        </form>
      </div>

      <div>
        <h2 className="text-section-title text-foreground mb-1">Serviços que realiza</h2>
        <p className="text-body-sm text-muted mb-3">
          Para associar ou remover serviços, use a tela do serviço correspondente.
        </p>
        <Surface>
          {(services as Service[] | null)?.length ? (
            (services as Service[]).map((s) => (
              <SurfaceRow key={s.id} className="text-body-sm text-foreground">
                {s.name}
              </SurfaceRow>
            ))
          ) : (
            <EmptyState
              title="Nenhum serviço associado ainda"
              description="Associe este profissional a um serviço na tela do serviço correspondente."
            />
          )}
        </Surface>
      </div>
    </div>
  );
}
