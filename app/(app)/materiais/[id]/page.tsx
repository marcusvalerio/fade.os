import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateConsumableRecord, toggleConsumableActive } from "@/actions/materiais";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Consumable } from "@/lib/types";

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: consumable } = await supabase.from("consumable").select("*").eq("id", id).maybeSingle();
  if (!consumable) notFound();

  const c = consumable as Consumable;
  const updateAction = updateConsumableRecord.bind(null, id);

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-page-title text-foreground">{c.name}</h1>
        <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Ativo" : "Inativo"}</Badge>
      </div>

      <form action={updateAction} className="rounded-md border border-border bg-surface p-6 space-y-4">
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" defaultValue={c.name} required />
        </Field>
        <Field name="category" label="Categoria">
          <Input id="category" name="category" defaultValue={c.category ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field name="unit_of_measure" label="Unidade de medida">
            <Input id="unit_of_measure" name="unit_of_measure" defaultValue={c.unit_of_measure} />
          </Field>
          <Field name="cost_price" label="Custo (R$)">
            <Input id="cost_price" name="cost_price" type="number" step="0.01" defaultValue={c.cost_price} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="current_stock" label="Estoque atual">
            <Input id="current_stock" name="current_stock" type="number" step="1" defaultValue={c.current_stock} />
          </Field>
          <Field name="minimum_stock" label="Estoque mínimo">
            <Input id="minimum_stock" name="minimum_stock" type="number" step="1" defaultValue={c.minimum_stock} />
          </Field>
        </div>
        <Button type="submit" className="w-full">
          Salvar alterações
        </Button>
      </form>

      <form
        action={async () => {
          "use server";
          await toggleConsumableActive(id, !c.active);
        }}
      >
        <Button type="submit" variant="secondary" className="w-full">
          {c.active ? "Desativar material" : "Reativar material"}
        </Button>
      </form>
    </div>
  );
}
