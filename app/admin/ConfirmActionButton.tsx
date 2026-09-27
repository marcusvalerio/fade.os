"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Field, Textarea } from "@/components/ui/field";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/actions/onboarding";

/**
 * Toda ação administrativa relevante (aprovar/rejeitar/revogar Beta,
 * conceder/revogar platform admin) passa por confirmação explícita com
 * motivo — o mesmo padrão de CancelSaleButton, um componente só em vez de
 * cinco modais quase idênticos.
 */
export function ConfirmActionButton({
  label,
  modalTitle,
  warning,
  confirmLabel,
  pendingLabel,
  successMessage,
  variant = "secondary",
  triggerVariant,
  requireReason = false,
  action,
}: {
  label: string;
  modalTitle: string;
  warning?: string;
  confirmLabel: string;
  pendingLabel: string;
  successMessage: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Estilo do botão na lista; sem isto, igual ao da confirmação. */
  triggerVariant?: "primary" | "secondary" | "ghost" | "danger";
  requireReason?: boolean;
  action: (reason: string | undefined) => Promise<ActionResult<null>>;
}) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (requireReason && trimmed.length < 3) {
      setError("Informe o motivo.");
      return;
    }
    setError(null);
    setPending(true);
    const result = await action(trimmed || undefined);
    setPending(false);
    if (!result.ok) return setError(result.error);
    show(successMessage, "success");
    setOpen(false);
    setReason("");
  }

  return (
    <>
      <Button type="button" variant={triggerVariant ?? variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={modalTitle}>
        <div className="space-y-4">
          {warning && <Aviso tom="atencao">{warning}</Aviso>}
          <Field
            name="reason"
            label={requireReason ? "Motivo" : "Motivo (opcional)"}
            helper="Fica registrado na auditoria da plataforma."
          >
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
          {error && <Aviso tom="erro">{error}</Aviso>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <BotaoDeAcaoClique
              variant={variant}
              size="sm"
              pending={pending}
              rotuloPendente={pendingLabel}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </BotaoDeAcaoClique>
          </div>
        </div>
      </Modal>
    </>
  );
}
