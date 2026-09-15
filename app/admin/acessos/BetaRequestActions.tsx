"use client";

import { useRouter } from "next/navigation";
import { rejectBetaRequest, revokeBetaRequest, undoBetaApproval } from "@/actions/platform-admin";
import { ConfirmActionButton } from "../ConfirmActionButton";
import { ApproveBetaButton } from "./ApproveBetaButton";
import { RegenerateBetaPasswordButton } from "./RegenerateBetaPasswordButton";

export function BetaRequestActions({
  id,
  status,
  name,
  phone,
  provisionedUserId,
  provisionedCompanyId,
}: {
  id: string;
  status: string;
  name: string;
  phone: string | null;
  provisionedUserId: string | null;
  provisionedCompanyId: string | null;
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
    // "Desfazer aprovação" só existe para o caso de aprovações feitas pelo
    // fluxo antigo, que nunca provisionaram conta/empresa de verdade —
    // exatamente o que provisionedUserId/provisionedCompanyId nulos
    // significam. Uma aprovação já provisionada nunca oferece este botão;
    // a RPC também recusa, isto aqui é só para não oferecer uma ação que
    // vai falhar.
    const canUndo = !provisionedUserId && !provisionedCompanyId;

    return (
      <div className="flex gap-2 shrink-0 flex-wrap justify-end">
        <RegenerateBetaPasswordButton id={id} name={name} phone={phone} />
        {canUndo && (
          <ConfirmActionButton
            label="Desfazer aprovação"
            modalTitle="Desfazer aprovação de Beta"
            warning="Esta solicitação foi aprovada mas nunca chegou a provisionar conta ou empresa. Desfazer volta o status para pendente, zera o período/validade, e permite aprovar de novo pelo fluxo atual."
            confirmLabel="Desfazer"
            pendingLabel="Desfazendo…"
            successMessage="Aprovação desfeita — solicitação voltou a pendente."
            variant="secondary"
            requireReason
            action={async (reason) => {
              const result = await undoBetaApproval(id, reason);
              if (result.ok) afterAction();
              return result;
            }}
          />
        )}
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
