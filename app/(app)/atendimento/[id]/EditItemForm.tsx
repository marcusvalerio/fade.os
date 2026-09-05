"use client";

import { useState } from "react";
import { updateAttendanceItem } from "@/actions/atendimento";

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
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1 rounded-full bg-gray-100"
      >
        Editar
      </button>
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
    <form onSubmit={handleSubmit} className="text-xs bg-gray-50 rounded-md p-2 space-y-2 mt-2">
      <p>Preço original: R$ {originalPrice.toFixed(2)}</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isCourtesy} onChange={(e) => setIsCourtesy(e.target.checked)} />
        Cortesia
      </label>
      {!isCourtesy && (
        <input
          type="number"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="Desconto"
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-2 py-1 w-full"
        />
      )}
      {isCourtesy && (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da cortesia"
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-2 py-1 w-full"
        />
      )}
      {error && <p className="text-[var(--color-otan-red)]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1 rounded-full bg-[var(--color-cobblestone)] text-white disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 rounded-full bg-gray-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}
