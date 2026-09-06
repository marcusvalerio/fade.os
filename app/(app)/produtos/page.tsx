import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

export default async function ProdutosPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("product")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="O que sua barbearia vende ao cliente — pomada, shampoo, bebidas, acessórios."
        action={
          <Link href="/produtos/novo" className={buttonClasses()}>
            Novo produto
          </Link>
        }
      />

      <Surface>
        {(products as Product[] | null)?.length ? (
          (products as Product[]).map((p) => {
            const lowStock = p.current_stock <= p.minimum_stock;
            return (
              <Link key={p.id} href={`/produtos/${p.id}`} className="block">
                <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                  <div>
                    <p className="text-body-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-caption text-muted mt-0.5">
                      {formatCurrency(p.sale_price)} · estoque: {p.current_stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lowStock && <Badge tone="warning">estoque baixo</Badge>}
                    <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </SurfaceRow>
              </Link>
            );
          })
        ) : (
          <EmptyState
            title="Nenhum produto cadastrado ainda"
            description="Cadastre o que sua barbearia vende para começar a controlar o estoque de venda."
            action={
              <Link href="/produtos/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo produto
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
