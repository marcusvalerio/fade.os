"use client";

import { useState } from "react";
import { adjustStockAction } from "@/actions/estoque";
import { Field, Select, Textarea, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type ItemOption = { id: string; name: string; kind: "product" | "consumable" };

const MOVEMENT_LABEL: Record<string, string> = {
  entry: "Entrada",
  consumption: "Consumo",
  adjustment: "Ajuste",
  loss: "Perda",
  inventory: "Inventário (contagem)",
};

export function AdjustStockForm({
  companyId,
  unitId,
  items,
}: {
  companyId: string;
  unitId: string;
  items: ItemOption[];
}) {
  const { show } = useToast();
  const [itemKey, setItemKey] = useState("");
  const [movementType, setMovementType] = useState("entry");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const item = items.find((i) => `${i.kind}:${i.id}` === itemKey);
    if (!item) return;

    setError(null);
    setPending(true);
    const result = await adjustStockAction({
      company_id: companyId,
      unit_id: unitId,
      item_type: item.kind,
      item_id: item.id,
      movement_type: movementType as "entry" | "consumption" | "adjustment" | "loss" | "inventory",
      quantity: Number(quantity),
      reason: reason || undefined,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      show(result.error, "danger");
      return;
    }
    show("Movimentação registrada.", "success");
    setQuantity("1");
    setReason("");
  }

  return (
    <form onSubmit={handleSubmit} className="material-solid rounded-md p-5 space-y-4">
      <p className="text-section-title text-foreground">Registrar movimentação</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select value={itemKey} onChange={(e) => setItemKey(e.target.value)} required className="col-span-2">
          <option value="">Item...</option>
          {items.map((i) => (
            <option key={`${i.kind}:${i.id}`} value={`${i.kind}:${i.id}`}>
              {i.name} {i.kind === "consumable" ? "(material)" : ""}
            </option>
          ))}
        </Select>
        <Select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
          {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          step="0.01"
          min={movementType === "inventory" ? "0" : undefined}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={movementType === "inventory" ? "Saldo contado" : "Quantidade"}
          required
        />
      </div>
      {/* Inventário não soma: ele diz qual é o saldo. Quem digitava 8 num
          saldo de 8 esperava confirmar a contagem e acabava com 16 — a
          palavra "quantidade" sozinha não deixava isso claro. */}
      {movementType === "inventory" && (
        <p className="text-body-sm text-muted">
          Informe o saldo <strong className="text-foreground">contado na prateleira</strong>, não a
          diferença. O sistema calcula o ajuste necessário.
        </p>
      )}
      <Field name="reason" label="Motivo / observação">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </Field>
      {error && <p className="text-body-sm text-danger-ink">{error}</p>}
      <Button type="submit" pending={pending} disabled={!itemKey} className="w-full">
        Registrar
      </Button>
    </form>
  );
}
