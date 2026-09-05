import { createClientRecord } from "@/actions/clientes";
import { getCurrentCompany } from "@/lib/current-company";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default async function NovoClientePage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-md">
      <h1 className="text-page-title text-foreground mb-6">Novo cliente</h1>
      <form
        action={createClientRecord}
        className="rounded-md border border-border bg-surface p-6 space-y-4"
      >
        <input type="hidden" name="company_id" value={current!.company.id} />
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" required autoFocus />
        </Field>
        <Field name="phone" label="Telefone">
          <Input id="phone" name="phone" />
        </Field>
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field name="birth_date" label="Data de nascimento">
          <Input id="birth_date" name="birth_date" type="date" />
        </Field>
        <Field name="notes" label="Observações">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>
        <label className="flex items-center gap-2 text-body-sm text-foreground">
          <Checkbox name="communication_consent" defaultChecked />
          Aceita receber comunicações
        </label>
        <Button type="submit" className="w-full">
          Salvar
        </Button>
      </form>
    </div>
  );
}
