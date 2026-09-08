import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import type { Consumable } from "@/lib/types";

export default async function MateriaisPage() {
  const current = await getCurrentCompany();
  // Catálogo e equipe são administração, não operação. O banco já recusa a
  // escrita para quem não é owner/admin (RLS + trigger assert_admin_write);
  // esta tela deixa de oferecer o que não vai funcionar, no mesmo formato de
  // Financeiro, Relatórios e Configurações.
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div>
        <PageHeader title="Materiais de consumo" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: consumables } = await supabase
    .from("consumable")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  return (
    <div>
      <PageHeader
        title="Materiais de consumo"
        description="O que a operação usa, mas não vende — lâmina, shampoo utilizado, talco, luvas."
        action={
          <div className="flex items-center gap-4">
            <Link href="/estoque" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Ver estoque
            </Link>
            <Link href="/materiais/novo" className={buttonClasses()}>
              Novo material
            </Link>
          </div>
        }
      />

      <Surface>
        {(consumables as Consumable[] | null)?.length ? (
          (consumables as Consumable[]).map((c) => {
            const lowStock = c.current_stock <= c.minimum_stock;
            return (
              <Link key={c.id} href={`/materiais/${c.id}`} className="block">
                <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                  <div>
                    <p className="text-body-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-caption text-muted mt-0.5">
                      {c.current_stock} {c.unit_of_measure} em estoque
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lowStock && <Badge tone="warning">estoque baixo</Badge>}
                    <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </SurfaceRow>
              </Link>
            );
          })
        ) : (
          <EmptyState
            title="Nenhum material cadastrado ainda"
            description="Cadastre o que a operação consome para preparar o controle de estoque de consumo."
            action={
              <Link href="/materiais/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo material
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
