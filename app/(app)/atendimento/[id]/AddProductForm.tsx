"use client";

import { useState } from "react";
import { addAttendanceProductItem } from "@/actions/atendimento";
import { Select, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";

type ProductOption = { id: string; name: string; sale_price: number };

export default function AddProductForm({
  attendanceId,
  products,
}: {
  attendanceId: string;
  products: ProductOption[];
}) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleProductChange(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setPrice(product.sale_price);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await addAttendanceProductItem({
      attendance_id: attendanceId,
      product_id: productId,
      quantity: Number(quantity),
      discount: 0,
    });

    setPending(false);
    if (!result.ok) return setError(result.error);

    setProductId("");
    setQuantity("1");
    setPrice(0);
  }

  if (products.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-5 space-y-4">
      <p className="text-section-title text-foreground">Adicionar produto</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
          required
          className="col-span-3"
        >
          <option value="">Produto...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qtd."
        />
        <MoneyInput value={price} onValueChange={setPrice} className="col-span-2" />
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      <Button type="submit" pending={pending} disabled={!productId} variant="secondary" className="w-full">
        {pending ? "Adicionando…" : "Adicionar produto"}
      </Button>
    </form>
  );
}
