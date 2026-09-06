"use client";

import { useRouter } from "next/navigation";
import { cancelPublicAppointment } from "@/actions/public";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "@/components/ui/toast";

export function CancelAppointmentButton({ token }: { token: string }) {
  const router = useRouter();
  const { show } = useToast();

  return (
    <ConfirmButton
      label="Cancelar agendamento"
      confirmTitle="Cancelar este agendamento?"
      confirmDescription="Essa ação não pode ser desfeita. O horário volta a ficar disponível para outras pessoas."
      confirmLabel="Sim, cancelar"
      size="md"
      onConfirm={async () => {
        const result = await cancelPublicAppointment(token);
        if (!result.ok || !result.data.cancelled) {
          show(!result.ok ? result.error : "Não foi possível cancelar.", "danger");
          return;
        }
        show("Agendamento cancelado.", "success");
        router.refresh();
      }}
    />
  );
}
