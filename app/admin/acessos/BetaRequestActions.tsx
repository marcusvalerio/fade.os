"use client";

import { useRouter } from "next/navigation";
import { rejectBetaRequest, revokeBetaRequest, undoBetaApproval } from "@/actions/platform-admin";
import { ConfirmActionButton } from "../ConfirmActionButton";
import { ApproveBetaButton } from "./ApproveBetaButton";
import { RegenerateBetaPasswordButton } from "./RegenerateBetaPasswordButton";
import { useResultadoDaAcao } from "./ResultadoDaAcao";

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
  const mostrarResultado = useResultadoDaAcao();

  function afterAction() {
    router.refresh();
  }

  // A linha troca de estado depois de cada ação e leva o botão junto: a
  // confirmação fica no provedor da página, até alguém clicar em Entendi.
  const confirmar = (titulo: string, mensagem: string, tom: "sucesso" | "atencao" = "sucesso") => () =>
    mostrarResultado({ tipo: "confirmacao", titulo, mensagem, tom });

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
          aoConcluir={confirmar("Solicitação rejeitada", `O pedido de ${name} foi rejeitado e saiu da lista de pendentes. O motivo ficou na auditoria da plataforma.`, "atencao")}
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
            aoConcluir={confirmar("Aprovação desfeita", `O pedido de ${name} voltou a pendente e pode ser aprovado de novo pelo fluxo atual.`)}
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
          aoConcluir={confirmar("Acesso revogado", `O acesso liberado para ${name} foi revogado. Contas já criadas não foram desativadas.`, "atencao")}
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
