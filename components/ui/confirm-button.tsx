"use client";

import { useState, useTransition } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

export function ConfirmButton({
  label,
  confirmTitle,
  confirmDescription,
  confirmLabel = "Confirmar",
  size = "sm",
  onConfirm,
}: {
  label: string;
  confirmTitle: string;
  confirmDescription?: string;
  confirmLabel?: string;
  size?: "sm" | "md";
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="secondary" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={confirmTitle}>
        {confirmDescription && (
          <p className="text-body-sm text-muted mb-4">{confirmDescription}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            pending={pending}
            onClick={() => {
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
              });
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
