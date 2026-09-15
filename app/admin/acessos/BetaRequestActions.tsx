"use client";

import { useRouter } from "next/navigation";
import { rejectBetaRequest, revokeBetaRequest } from "@/actions/platform-admin";
import { ConfirmActionButton } from "../ConfirmActionButton";
import { ApproveBetaButton } from "./ApproveBetaButton";
import { RegenerateBetaPasswordButton } from "./RegenerateBetaPasswordButton";

export function BetaRequestActions({
  id,
  status,
  name,
  phone,
}: {
  id: string;
  status: string;
  name: string;
  phone: string | null;
}) {
  const router = useRouter();

  function afterAction() {
    router.refresh();
  }

  if (status === "pending") {
    return (
      <div className="flex gap-2 shrink-0">
        <ApproveBetaButton id={id} name={name} phone={phone} />
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
      <div className="flex gap-2 shrink-0">
        <RegenerateBetaPasswordButton id={id} name={name} phone={phone} />
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
      </div>
    );
  }

  return null;
}
