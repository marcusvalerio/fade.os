import { createServiceRecord } from "@/actions/servicos";
import { getCurrentCompany } from "@/lib/current-company";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default async function NovoServicoPage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-md">
      <h1 className="text-page-title text-foreground mb-6">Novo serviço</h1>
      <form
        action={createServiceRecord}
        className="rounded-md border border-border bg-surface p-6 space-y-4"
      >
        <input type="hidden" name="company_id" value={current!.company.id} />
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" required autoFocus />
        </Field>
        <Field name="category" label="Categoria">
          <Input id="category" name="category" />
        </Field>
        <Field name="default_price" label="Preço (R$)" required>
          <Input id="default_price" name="default_price" type="number" step="0.01" required />
        </Field>
        <Field name="planned_duration_minutes" label="Duração planejada (minutos)" required>
          <Input id="planned_duration_minutes" name="planned_duration_minutes" type="number" required />
        </Field>
        <Field name="default_commission_percent" label="Comissão padrão (%)">
          <Input id="default_commission_percent" name="default_commission_percent" type="number" step="0.01" />
        </Field>
        <Button type="submit" className="w-full">
          Salvar
        </Button>
      </form>
    </div>
  );
}
