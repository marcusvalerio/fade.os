import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateConsumableRecord, toggleConsumableActive } from "@/actions/materiais";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Consumable } from "@/lib/types";
import { MaterialForm } from "../MaterialForm";

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

      <MaterialForm
        modo="editar"
        action={updateAction}
        valores={{
          name: c.name,
          category: c.category,
          unit_of_measure: c.unit_of_measure,
          cost_price: c.cost_price,
          minimum_stock: c.minimum_stock,
        }}
        estoqueAtual={c.current_stock}
      />

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
