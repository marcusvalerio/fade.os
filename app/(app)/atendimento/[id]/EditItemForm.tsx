"use client";

import { useState } from "react";
import { updateAttendanceItem } from "@/actions/atendimento";
import { Input, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function EditItemForm({
  itemId,
  attendanceId,
  originalPrice,
  currentDiscount,
  currentType,
  currentCourtesyReason,
}: {
  itemId: string;
  attendanceId: string;
  originalPrice: number;
  currentDiscount: number;
  currentType: "normal" | "courtesy";
  currentCourtesyReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [discount, setDiscount] = useState(currentDiscount.toString());
  const [isCourtesy, setIsCourtesy] = useState(currentType === "courtesy");
  const [reason, setReason] = useState(currentCourtesyReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await updateAttendanceItem(itemId, attendanceId, {
      discount: Number(discount),
      type: isCourtesy ? "courtesy" : "normal",
      courtesy_reason: isCourtesy ? reason : undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full basis-full text-body-sm bg-surface-muted rounded-sm p-3 space-y-2.5 mt-2 animate-fade-in"
    >
      <p className="text-caption text-muted">Preço original: R$ {originalPrice.toFixed(2)}</p>
      <label className="flex items-center gap-2">
        <Checkbox checked={isCourtesy} onChange={(e) => setIsCourtesy(e.target.checked)} />
        Cortesia
      </label>
      {!isCourtesy && (
        <Input
          type="number"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="Desconto"
        />
      )}
      {isCourtesy && (
        <Input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da cortesia"
        />
      )}
      {error && <p className="text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" pending={pending}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
