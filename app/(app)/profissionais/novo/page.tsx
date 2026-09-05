import { createProfessionalRecord } from "@/actions/profissionais";
import { getCurrentCompany } from "@/lib/current-company";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default async function NovoProfissionalPage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-md">
      <h1 className="text-page-title text-foreground mb-6">Novo profissional</h1>
      <form
        action={createProfessionalRecord}
        className="rounded-md border border-border bg-surface p-6 space-y-4"
      >
        <input type="hidden" name="company_id" value={current!.company.id} />
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" required autoFocus />
        </Field>
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field name="phone" label="Telefone">
          <Input id="phone" name="phone" />
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
