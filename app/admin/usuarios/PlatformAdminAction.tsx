"use client";

import { useRouter } from "next/navigation";
import { grantPlatformAdminAccess, revokePlatformAdminAccess } from "@/actions/platform-admin";
import { ConfirmActionButton } from "../ConfirmActionButton";

export function PlatformAdminAction({
  userId,
  isAdmin,
  isSelf,
}: {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();

  // Ninguém revoga o próprio acesso por aqui — o banco já recusa
  // (NAO_PODE_REVOGAR_A_SI_MESMO); a ação nem aparece para não convidar a
  // tentativa.
  if (isAdmin && isSelf) {
    return <span className="text-caption text-muted">Você</span>;
  }

  if (isAdmin) {
    return (
      <ConfirmActionButton
        label="Revogar admin"
        modalTitle="Revogar platform admin"
        warning="Esta pessoa perde acesso ao CORTEX ADMIN imediatamente."
        confirmLabel="Revogar"
        pendingLabel="Revogando…"
        successMessage="Platform admin revogado."
        variant="danger"
        triggerVariant="ghost"
        requireReason
        action={async (reason) => {
          const result = await revokePlatformAdminAccess(userId, reason);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    );
  }

  return (
    <ConfirmActionButton
      label="Tornar admin"
      modalTitle="Conceder acesso de platform admin"
      warning="Esta pessoa passa a administrar a plataforma inteira — todas as empresas, todos os acessos Beta. Não é o mesmo que ser gerente de uma barbearia."
      confirmLabel="Conceder"
      pendingLabel="Concedendo…"
      successMessage="Platform admin concedido."
      variant="primary"
      triggerVariant="ghost"
      requireReason
      action={async (reason) => {
        const result = await grantPlatformAdminAccess(userId, reason);
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}
