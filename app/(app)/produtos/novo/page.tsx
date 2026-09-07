import { createProductAndRedirect } from "@/actions/produtos";
import { getCurrentCompany } from "@/lib/current-company";
import { createClient } from "@/lib/supabase/server";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default async function NovoProdutoPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("unit")
    .select("id, name")
    .eq("company_id", current!.company.id)
    .order("created_at");

  return (
    <div className="max-w-md">
      <h1 className="text-page-title text-foreground mb-6">Novo produto</h1>
      <form
        action={createProductAndRedirect}
        className="rounded-md border border-border bg-surface p-6 space-y-4"
      >
        <input type="hidden" name="company_id" value={current!.company.id} />
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" required autoFocus />
        </Field>
        <Field name="category" label="Categoria">
          <Input id="category" name="category" placeholder="Ex.: cabelo, barba, bebidas" />
        </Field>
        {units && units.length > 1 && (
          <Field name="unit_id" label="Unidade" required>
            <Select id="unit_id" name="unit_id" required>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {units && units.length === 1 && <input type="hidden" name="unit_id" value={units[0].id} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field name="cost_price" label="Custo (R$)">
            <Input id="cost_price" name="cost_price" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field name="sale_price" label="Preço de venda (R$)" required>
            <Input id="sale_price" name="sale_price" type="number" step="0.01" required />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field name="current_stock" label="Estoque inicial">
            <Input id="current_stock" name="current_stock" type="number" step="1" defaultValue="0" />
          </Field>
          <Field name="minimum_stock" label="Estoque mínimo">
            <Input id="minimum_stock" name="minimum_stock" type="number" step="1" defaultValue="0" />
          </Field>
        </div>
        <Button type="submit" className="w-full">
          Salvar
        </Button>
      </form>
    </div>
  );
}
