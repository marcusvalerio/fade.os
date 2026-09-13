"use client";

import { useRouter } from "next/navigation";
import { approveBetaRequest, rejectBetaRequest, revokeBetaRequest } from "@/actions/platform-admin";
import { ConfirmActionButton } from "../ConfirmActionButton";

export function BetaRequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  function afterAction() {
    router.refresh();
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2 shrink-0">
        <ConfirmActionButton
          label="Aprovar"
          modalTitle="Aprovar solicitação de Beta"
          confirmLabel="Aprovar"
          pendingLabel="Aprovando…"
          successMessage="Solicitação aprovada."
          variant="primary"
          action={async (reason) => {
            const result = await approveBetaRequest(id, reason);
            if (result.ok) afterAction();
            return result;
          }}
        />
        <ConfirmActionButton
          label="Rejeitar"
          modalTitle="Rejeitar solicitação de Beta"
          confirmLabel="Rejeitar"
          pendingLabel="Rejeitando…"
          successMessage="Solicitação rejeitada."
          variant="danger"
          requireReason
          action={async (reason) => {
            const result = await rejectBetaRequest(id, reason);
            if (result.ok) afterAction();
            return result;
          }}
        />
      </div>
    );
  }

  if (status === "approved") {
    return (
      <ConfirmActionButton
        label="Revogar"
        modalTitle="Revogar acesso aprovado"
        warning="A solicitação volta a ficar sem acesso liberado. Isso não desativa nenhuma conta já criada — é um controle sobre esta solicitação."
        confirmLabel="Revogar"
        pendingLabel="Revogando…"
        successMessage="Acesso revogado."
        variant="danger"
        requireReason
        action={async (reason) => {
          const result = await revokeBetaRequest(id, reason);
          if (result.ok) afterAction();
          return result;
        }}
      />
    );
  }

  return null;
}
