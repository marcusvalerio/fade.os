import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProductRecord, toggleProductActive } from "@/actions/produtos";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductForm } from "../ProductForm";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase.from("product").select("*").eq("id", id).maybeSingle();
  if (!product) notFound();

  const p = product as Product;
  const updateAction = updateProductRecord.bind(null, id);

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-page-title text-foreground">{p.name}</h1>
        <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
      </div>

      <ProductForm
        action={updateAction}
        modo="editar"
        valores={{
          name: p.name,
          category: p.category,
          cost_price: p.cost_price,
          sale_price: p.sale_price,
          minimum_stock: p.minimum_stock,
        }}
      />

      <form
        action={async () => {
          "use server";
          await toggleProductActive(id, !p.active);
        }}
      >
        <Button type="submit" variant="secondary" className="w-full">
          {p.active ? "Desativar produto" : "Reativar produto"}
        </Button>
      </form>
    </div>
  );
}
