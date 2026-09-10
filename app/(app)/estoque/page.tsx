import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdjustStockForm } from "./AdjustStockForm";
import Link from "next/link";

const MOVEMENT_LABEL: Record<string, string> = {
  entry: "Entrada",
  sale: "Venda",
  consumption: "Consumo",
  adjustment: "Ajuste",
  loss: "Perda",
  inventory: "Inventário (contagem)",
};

export default async function EstoquePage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();
  const companyId = current!.company.id;
  // Ver o saldo é operação (o barbeiro precisa saber se tem produto para
  // vender); registrar movimentação é administração, e adjust_stock já recusa
  // quem não é owner/admin. O formulário some para não oferecer o que falharia.
  const isManager = await isCompanyManager(companyId);

  const [{ data: unit }, { data: products }, { data: consumables }, { data: movements }] = await Promise.all([
    supabase.from("unit").select("id").eq("company_id", companyId).order("created_at").limit(1).maybeSingle(),
    supabase
      .from("product")
      .select("id, name, current_stock, minimum_stock")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("consumable")
      .select("id, name, current_stock, minimum_stock, unit_of_measure")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("stock_movement")
      .select("id, item_type, movement_type, quantity, counted_quantity, reason, created_at, product:product_id(name), consumable:consumable_id(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const items = [
    ...(products ?? []).map((p) => ({ id: p.id, name: p.name, kind: "product" as const })),
    ...(consumables ?? []).map((c) => ({ id: c.id, name: c.name, kind: "consumable" as const })),
  ];

  const critical = [
    ...(products ?? [])
      .filter((p) => Number(p.current_stock) <= Number(p.minimum_stock))
      .map((p) => ({ ...p, kind: "Produto" })),
    ...(consumables ?? [])
      .filter((c) => Number(c.current_stock) <= Number(c.minimum_stock))
      .map((c) => ({ ...c, kind: "Material" })),
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Estoque"
        description="Movimentação de produtos de venda e materiais de consumo, sempre com histórico."
        action={
          <Link href="/produtos" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
            Ver produtos
          </Link>
        }
      />

      {critical.length > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4">
          <p className="text-body-sm font-medium text-foreground mb-2">Estoque crítico</p>
          <ul className="space-y-1">
            {critical.map((c) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <li key={(c as any).id} className="text-body-sm text-muted">
                {c.kind}: {c.name} — {String(c.current_stock)} restante(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      {isManager && unit && items.length > 0 && (
        <AdjustStockForm companyId={companyId} unitId={unit.id} items={items} />
      )}

      <section>
        <h2 className="text-section-title text-foreground mb-3">Histórico recente</h2>
        <Surface>
          {movements && movements.length > 0 ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (movements as any[]).map((m) => (
              <SurfaceRow key={m.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body-sm font-medium text-foreground">
                    {m.product?.name ?? m.consumable?.name}
                  </p>
                  <p className="text-caption text-muted mt-0.5">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      m.movement_type === "inventory"
                        ? "info"
                        : Number(m.quantity) > 0
                          ? "success"
                          : "danger"
                    }
                  >
                    {MOVEMENT_LABEL[m.movement_type]}
                  </Badge>
                  <span className="text-body-sm tabular-nums text-foreground">
                    {m.movement_type === "inventory" && m.counted_quantity !== null
                      ? `contado ${m.counted_quantity}`
                      : `${Number(m.quantity) > 0 ? "+" : ""}${m.quantity}`}
                  </span>
                </div>
              </SurfaceRow>
            ))
          ) : (
            <EmptyState
              title="Nenhuma movimentação ainda"
              description="Toda entrada, venda, consumo e contagem fica registrada aqui — com data, motivo e quem fez."
              action={
                <Link href="/produtos" className={buttonClasses({ variant: "secondary" })}>
                  Ver produtos
                </Link>
              }
            />
          )}
        </Surface>
      </section>
    </div>
  );
}
