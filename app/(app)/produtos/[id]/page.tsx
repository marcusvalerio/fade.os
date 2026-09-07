import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProductRecord, toggleProductActive } from "@/actions/produtos";
import Link from "next/link";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
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

      <form action={updateAction} className="rounded-md border border-border bg-surface p-6 space-y-4">
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" defaultValue={p.name} required />
        </Field>
        <Field name="category" label="Categoria">
          <Input id="category" name="category" defaultValue={p.category ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field name="cost_price" label="Custo (R$)">
            <Input id="cost_price" name="cost_price" type="number" step="0.01" defaultValue={p.cost_price} />
          </Field>
          <Field name="sale_price" label="Preço de venda (R$)" required>
            <Input id="sale_price" name="sale_price" type="number" step="0.01" defaultValue={p.sale_price} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Saldo é só leitura aqui: estoque se move por movimentação
              registrada (Catálogo › Estoque), nunca por edição de cadastro —
              senão some o rastro de quem tirou o quê e por quê. */}
          <div>
            <p className="text-label uppercase text-muted">Estoque atual</p>
            <p className="text-body text-foreground tabular-nums">{p.current_stock}</p>
            <Link href="/estoque" className="text-caption text-signal hover:underline">
              Movimentar estoque
            </Link>
          </div>
          <Field name="minimum_stock" label="Estoque mínimo">
            <Input id="minimum_stock" name="minimum_stock" type="number" step="1" defaultValue={p.minimum_stock} />
          </Field>
        </div>
        <Button type="submit" className="w-full">
          Salvar alterações
        </Button>
      </form>

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
