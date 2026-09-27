import { createClient } from "@/lib/supabase/server";
import { formatBusinessDate } from "@/lib/time";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { AdjustStockForm } from "./AdjustStockForm";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { valorDoEstoque } from "@/lib/estoque-valor";

/** De onde veio cada movimento — o estoque não muda sozinho. */
const ORIGEM: Record<string, string> = {
  sale_item: "baixa pela venda",
  sale_cancel: "devolvido pelo cancelamento de uma venda",
};

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
      // Custo é informação de gestão: só vem para quem gerencia.
      .select(isManager ? "id, name, current_stock, minimum_stock, cost_price, sale_price" : "id, name, current_stock, minimum_stock")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("consumable")
      .select(isManager ? "id, name, current_stock, minimum_stock, unit_of_measure, cost_price" : "id, name, current_stock, minimum_stock, unit_of_measure")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("stock_movement")
      .select("id, item_type, movement_type, quantity, counted_quantity, reason, reference_type, created_at, product:product_id(name), consumable:consumable_id(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  type Linha = { id: string; name: string; current_stock: number; minimum_stock: number; cost_price?: number | null; sale_price?: number | null; unit_of_measure?: string | null };
  const produtos = (products ?? []) as unknown as Linha[];
  const materiais = (consumables ?? []) as unknown as Linha[];

  const items = [
    ...produtos.map((p) => ({ id: p.id, name: p.name, kind: "product" as const })),
    ...materiais.map((c) => ({ id: c.id, name: c.name, kind: "consumable" as const })),
  ];

  const valor = valorDoEstoque([...produtos, ...materiais].map((i) => ({ ...i, cost_price: i.cost_price ?? null })));
  const valorProdutos = valorDoEstoque(produtos.map((i) => ({ ...i, cost_price: i.cost_price ?? null })));
  const valorMateriais = valorDoEstoque(materiais.map((i) => ({ ...i, cost_price: i.cost_price ?? null })));
  const semCusto = (n: number) => (n > 0 ? `${n} com saldo e sem custo — fora da conta` : null);

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Negócio"
        title="Estoque"
        description="O que tem na prateleira, quanto vale e de onde veio cada movimento."
        action={
          <Link href="/produtos" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Ver produtos
          </Link>
        }
      />

      {/* 1. A leitura rápida. */}
      <dl className={cn("grid gap-px bg-border border border-border rounded-lg overflow-hidden", isManager ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
        {isManager && (
          <div className="bg-surface p-4 sm:p-5">
            <dt className="font-subtitle text-caption text-muted">Produtos, a custo</dt>
            <dd className="numero text-metric-sm text-foreground mt-1">{formatCurrency(valorProdutos.custoTotal)}</dd>
            <dd className="text-micro text-muted mt-0.5">
              {formatCurrency(valorProdutos.vendaTotal)} pelo preço de venda
              {semCusto(valorProdutos.semCusto) && <span className="block">{semCusto(valorProdutos.semCusto)}</span>}
            </dd>
          </div>
        )}
        {isManager && (
          <div className="bg-surface p-4 sm:p-5">
            <dt className="font-subtitle text-caption text-muted">Materiais, a custo</dt>
            <dd className="numero text-section-title text-foreground mt-1">{formatCurrency(valorMateriais.custoTotal)}</dd>
            <dd className="text-micro text-muted mt-0.5">{semCusto(valorMateriais.semCusto) ?? "o que se consome no atendimento"}</dd>
          </div>
        )}
        <div className="bg-surface p-4 sm:p-5">
          <dt className="font-subtitle text-caption text-muted">Abaixo do mínimo</dt>
          <dd className={cn("numero text-section-title mt-1", valor.abaixoDoMinimo > 0 ? "text-warning-ink" : "text-foreground")}>{valor.abaixoDoMinimo}</dd>
          <dd className="text-micro text-muted mt-0.5">{valor.zerados > 0 ? `${valor.zerados} ${valor.zerados === 1 ? "zerado" : "zerados"}` : "nenhum zerado"}</dd>
        </div>
        <div className="bg-surface p-4 sm:p-5">
          <dt className="font-subtitle text-caption text-muted">Itens cadastrados</dt>
          <dd className="numero text-section-title text-foreground mt-1">{items.length}</dd>
          <dd className="text-micro text-muted mt-0.5">
            {produtos.length} {produtos.length === 1 ? "produto" : "produtos"} · {materiais.length} {materiais.length === 1 ? "material" : "materiais"}
          </dd>
        </div>
      </dl>

      {/* 2. A posição, item a item — quem está abaixo do mínimo sobe. */}
      {[
        { titulo: "Produtos de venda", lista: produtos, material: false },
        { titulo: "Materiais de consumo", lista: materiais, material: true },
      ]
        .filter((g) => g.lista.length > 0)
        .map((g) => {
          const ordenada = [...g.lista].sort(
            (a, b) =>
              Number(Number(b.current_stock) <= Number(b.minimum_stock)) - Number(Number(a.current_stock) <= Number(a.minimum_stock)) ||
              a.name.localeCompare(b.name, "pt-BR")
          );
          return (
            <section key={g.titulo} aria-label={g.titulo}>
              <h2 className="text-section-title text-foreground mb-3">{g.titulo}</h2>
              <div className="painel overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="text-left font-subtitle text-caption text-muted border-b border-border">
                      <th className="px-4 py-2.5 font-normal">Item</th>
                      <th className="px-4 py-2.5 font-normal text-right">Saldo</th>
                      <th className="px-4 py-2.5 font-normal text-right hidden sm:table-cell">Mínimo</th>
                      {isManager && <th className="px-4 py-2.5 font-normal text-right hidden sm:table-cell">Custo un.</th>}
                      {isManager && <th className="px-4 py-2.5 font-normal text-right">Valor</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ordenada.map((i) => {
                      const qtd = Number(i.current_stock);
                      const baixo = qtd <= Number(i.minimum_stock);
                      const custo = i.cost_price != null && Number(i.cost_price) > 0 ? Number(i.cost_price) : null;
                      return (
                        <tr key={i.id}>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-2 text-foreground">
                              <span aria-hidden="true" className={cn("size-1.5 shrink-0", qtd <= 0 ? "bg-danger" : baixo ? "bg-warning" : "bg-success")} />
                              {i.name}
                            </span>
                            {baixo && <span className="block text-micro text-muted pl-3.5">{qtd <= 0 ? "zerado" : "abaixo do mínimo"}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right numero text-foreground whitespace-nowrap">
                            {qtd}
                            {g.material && i.unit_of_measure ? ` ${i.unit_of_measure}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right numero text-muted hidden sm:table-cell">{Number(i.minimum_stock)}</td>
                          {isManager && <td className="px-4 py-2.5 text-right numero text-muted hidden sm:table-cell">{custo != null ? formatCurrency(custo) : "—"}</td>}
                          {isManager && (
                            <td className="px-4 py-2.5 text-right numero text-foreground">{custo != null && qtd > 0 ? formatCurrency(custo * qtd) : "—"}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

      {items.length === 0 && (
        <div className="painel">
          <Vazio
            titulo="Nenhum item no estoque"
            descricao="Cadastre os produtos que você vende (e, se quiser, os materiais que consome) para acompanhar saldo e valor."
            acao={
              <Link href="/produtos" className={buttonClasses({ variant: "secondary" })}>
                Cadastrar produtos
              </Link>
            }
          />
        </div>
      )}

      {isManager && unit && items.length > 0 && (
        <AdjustStockForm companyId={companyId} unitId={unit.id} items={items} />
      )}

      <section>
        <h2 className="text-section-title text-foreground mb-3">Últimas movimentações</h2>
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
                    {formatBusinessDate(m.created_at, { dateStyle: "short", timeStyle: "short" })}
                    {" · "}
                    {ORIGEM[m.reference_type ?? ""] ?? "lançamento manual"}
                    {m.reason && m.reference_type !== "sale_cancel" ? ` · ${m.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-caption font-medium whitespace-nowrap",
                      m.movement_type === "inventory" ? "text-muted" : Number(m.quantity) > 0 ? "text-success-ink" : "text-foreground"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 shrink-0",
                        m.movement_type === "inventory"
                          ? "border border-border-strong"
                          : Number(m.quantity) > 0
                            ? "bg-success"
                            : "bg-foreground"
                      )}
                    />
                    {MOVEMENT_LABEL[m.movement_type]}
                  </span>
                  <span className="text-body-sm tabular-nums text-foreground">
                    {m.movement_type === "inventory" && m.counted_quantity !== null
                      ? `contado ${m.counted_quantity}`
                      : `${Number(m.quantity) > 0 ? "+" : ""}${m.quantity}`}
                  </span>
                </div>
              </SurfaceRow>
            ))
          ) : (
            <Vazio
              titulo="Nenhuma movimentação ainda"
              descricao="Toda entrada, venda, consumo e contagem fica registrada aqui — com data, motivo e quem fez."
              acao={
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
