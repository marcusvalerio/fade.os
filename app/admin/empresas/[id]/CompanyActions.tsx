"use client";

import { useRouter } from "next/navigation";
import { suspendCompany, reactivateCompany } from "@/actions/platform-admin";
import { ConfirmActionButton } from "../../ConfirmActionButton";

export function CompanyActions({ companyId, status }: { companyId: string; status: "active" | "suspended" }) {
  const router = useRouter();

  if (status === "suspended") {
    return (
      <ConfirmActionButton
        label="Reativar empresa"
        modalTitle="Reativar empresa"
        warning="A empresa volta a operar normalmente — agenda, atendimento, venda e caixa liberados de novo."
        confirmLabel="Reativar"
        pendingLabel="Reativando…"
        successMessage="Empresa reativada."
        variant="primary"
        action={async (reason) => {
          const result = await reactivateCompany(companyId, reason);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    );
  }

  return (
    <ConfirmActionButton
      label="Suspender empresa"
      modalTitle="Suspender empresa"
      warning="A empresa para de operar imediatamente — ninguém consegue acessar agenda, atendimento, venda, caixa ou a página pública de agendamento. Nenhum dado é apagado, e a reativação desfaz isso a qualquer momento."
      confirmLabel="Suspender"
      pendingLabel="Suspendendo…"
      successMessage="Empresa suspensa."
      variant="danger"
      requireReason
      action={async (reason) => {
        const result = await suspendCompany(companyId, reason ?? "");
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}
