"use client";

import { useState } from "react";
import { addAttendanceProductItem } from "@/actions/atendimento";
import { useAttendanceSync } from "./AttendanceSync";
import { Select, Input, Field, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";

type ProductOption = { id: string; name: string; sale_price: number };

export default function AddProductForm({
  attendanceId,
  products,
  requiresAuthorization,
}: {
  attendanceId: string;
  products: ProductOption[];
  requiresAuthorization: boolean;
}) {
  const { refreshItems } = useAttendanceSync();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isCourtesy, setIsCourtesy] = useState(false);
  const [courtesyReason, setCourtesyReason] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // O preço é exibido como referência do catálogo. Quem o define é o servidor,
  // lendo product.sale_price — mandar o valor daqui deixaria o preço nas mãos
  // do cliente.
  const selectedProduct = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await addAttendanceProductItem({
      attendance_id: attendanceId,
      product_id: productId,
      quantity: Number(quantity),
      discount: 0,
      type: isCourtesy ? "courtesy" : "normal",
      courtesy_reason: isCourtesy ? courtesyReason : undefined,
      authorization_code: authorizationCode.trim() || undefined,
    });

    setPending(false);
    if (!result.ok) return setError(result.error);

    setProductId("");
    setQuantity("1");
    setIsCourtesy(false);
    setCourtesyReason("");
    setAuthorizationCode("");
    refreshItems();
  }

  if (products.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-5 space-y-4">
      <p className="text-section-title text-foreground">Adicionar produto</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          className="sm:col-span-3"
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
      </div>

      {selectedProduct && (
        <p className="text-body-sm text-muted tabular-nums">
          {formatCurrency(selectedProduct.sale_price)} × {quantity || 1} ={" "}
          {formatCurrency(selectedProduct.sale_price * (Number(quantity) || 1))}
        </p>
      )}

      <label className="flex items-center gap-2 text-body-sm text-foreground">
        <Checkbox checked={isCourtesy} onChange={(e) => setIsCourtesy(e.target.checked)} />
        Cortesia (sem cobrança)
      </label>

      {isCourtesy && (
        <Field name="product_courtesy_reason" label="Motivo da cortesia" required>
          <Input
            id="product_courtesy_reason"
            value={courtesyReason}
            onChange={(e) => setCourtesyReason(e.target.value)}
          />
        </Field>
      )}

      <AuthorizationCodeField
        value={authorizationCode}
        onChange={setAuthorizationCode}
        visible={requiresAuthorization && isCourtesy}
        operation="courtesy"
      />

      {error && <p className="text-body-sm text-danger">{error}</p>}

      <Button type="submit" pending={pending} disabled={!productId} variant="secondary" className="w-full">
        {pending ? "Adicionando…" : "Adicionar produto"}
      </Button>
    </form>
  );
}
