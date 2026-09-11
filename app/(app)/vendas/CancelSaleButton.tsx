"use client";

import { useState } from "react";
import { cancelSale } from "@/actions/vendas";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Field, Textarea } from "@/components/ui/field";
import { Aviso } from "@/components/ui/estado";
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
    setReason("");
  }

  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
        Cancelar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Cancelar venda">
        <div className="space-y-4">
          {/*
            "Tem certeza?" sozinho não diz o que vai acontecer. Aqui: o que é
            revertido (estoque, comissão, pagamento) e que é definitivo — as
            duas coisas que decidem se a pessoa deve mesmo confirmar.
          */}
          <Aviso tom="atencao">
            O estoque volta, a comissão é revertida e o pagamento vira estorno. Essa ação não pode
            ser desfeita.
          </Aviso>
          <Field name="reason" label="Motivo" helper="Fica registrado junto do cancelamento.">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente desistiu, item errado…"
              rows={2}
            />
          </Field>
          {error && <Aviso tom="erro">{error}</Aviso>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <BotaoDeAcaoClique
              variant="danger"
              size="sm"
              pending={pending}
              rotuloPendente="Cancelando…"
              onClick={handleConfirm}
            >
              Cancelar venda
            </BotaoDeAcaoClique>
          </div>
        </div>
      </Modal>
    </>
  );
}
