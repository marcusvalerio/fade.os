import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { AcessoRestrito } from "@/components/ui/acesso-restrito";

export default async function ProdutosPage() {
  const current = await getCurrentCompany();
  // Catálogo e equipe são administração, não operação. O banco já recusa a
  // escrita para quem não é owner/admin (RLS + trigger assert_admin_write);
  // esta tela deixa de oferecer o que não vai funcionar, no mesmo formato de
  // Financeiro, Relatórios e Configurações.
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div>
        <PageHeader eyebrow="Cadastros" title="Produtos" />
        <AcessoRestrito />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("product")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  return (
    <div>
      <PageHeader
        eyebrow="Cadastros"
        title="Produtos"
        description="O que sua barbearia vende ao cliente — pomada, shampoo, bebidas, acessórios."
        action={
          <div className="flex items-center gap-4">
            <Link href="/estoque" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Ver estoque
            </Link>
            <Link href="/produtos/novo" className={buttonClasses()}>
              Novo produto
            </Link>
          </div>
        }
      />

      <Surface>
        {(products as Product[] | null)?.length ? (
          (products as Product[]).map((p) => {
            const lowStock = p.current_stock <= p.minimum_stock;
            return (
              <Link key={p.id} href={`/produtos/${p.id}`} className="block">
                <SurfaceRow className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 hover:bg-surface-muted">
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-caption text-muted mt-0.5">
                      {formatCurrency(p.sale_price)} · estoque: {p.current_stock}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lowStock && <Badge tone="warning">estoque baixo</Badge>}
                    <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </SurfaceRow>
              </Link>
            );
          })
        ) : (
          <Vazio
            titulo="Nenhum produto cadastrado ainda"
            descricao="Cadastre o que sua barbearia vende para começar a controlar o estoque de venda."
            acao={
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
