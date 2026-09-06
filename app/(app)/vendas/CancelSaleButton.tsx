"use client";

import { useState } from "react";
import { cancelSale } from "@/actions/vendas";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export function CancelSaleButton({ saleId }: { saleId: string }) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const result = await cancelSale(saleId, reason);
    setPending(false);
    if (!result.ok) return setError(result.error);
    show("Venda cancelada e estornada.", "success");
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        Cancelar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cancelar venda">
        <div className="space-y-4">
          <p className="text-body-sm text-muted">
            Estoque, comissão e pagamentos vinculados serão estornados. Essa ação não pode ser desfeita.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo do cancelamento"
            rows={2}
          />
          {error && <p className="text-body-sm text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="button" variant="danger" size="sm" pending={pending} onClick={handleConfirm}>
              Cancelar venda
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
