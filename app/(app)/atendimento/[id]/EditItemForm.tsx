"use client";

import { useState } from "react";
import { updateAttendanceItem, removeAttendanceItem } from "@/actions/atendimento";
import { useAttendanceSync } from "./AttendanceSync";
import { Input, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";

export default function EditItemForm({
  itemId,
  attendanceId,
  originalPrice,
  currentDiscount,
  currentType,
  currentCourtesyReason,
  requiresAuthorization,
}: {
  itemId: string;
  attendanceId: string;
  originalPrice: number;
  currentDiscount: number;
  currentType: "normal" | "courtesy";
  currentCourtesyReason: string | null;
  requiresAuthorization: boolean;
}) {
  const { refreshItems } = useAttendanceSync();
  const [open, setOpen] = useState(false);
  const [discount, setDiscount] = useState(currentDiscount.toString());
  const [isCourtesy, setIsCourtesy] = useState(currentType === "courtesy");
  const [reason, setReason] = useState(currentCourtesyReason ?? "");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);

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
      authorization_code: authorizationCode.trim() || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    refreshItems();
  }

  async function handleRemove() {
    setError(null);
    setRemoving(true);
    const result = await removeAttendanceItem(itemId, attendanceId);
    setRemoving(false);
    if (!result.ok) return setError(result.error);
    refreshItems();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full basis-full text-body-sm bg-surface-muted rounded-sm p-3 space-y-2.5 mt-2 animate-fade-in"
    >
      <p className="text-caption text-muted">Preço original: {formatCurrency(originalPrice)}</p>
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
      <AuthorizationCodeField
        value={authorizationCode}
        onChange={setAuthorizationCode}
        visible={requiresAuthorization && (isCourtesy || Number(discount) > 0)}
        operation={isCourtesy ? "courtesy" : "discount"}
      />
      {error && <p className="text-danger-ink">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" pending={pending}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
      <div className="pt-2 border-t border-shell-border/40">
        {confirmingRemoval ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-caption text-danger-ink">Remover este item? Não pode ser desfeito.</span>
            <Button type="button" variant="danger" size="sm" pending={removing} onClick={handleRemove}>
              Confirmar remoção
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingRemoval(false)}>
              Voltar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-caption text-danger-ink hover:underline"
            onClick={() => setConfirmingRemoval(true)}
          >
            Remover item
          </button>
        )}
      </div>
    </form>
  );
}
