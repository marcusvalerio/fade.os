"use client";

import { useRouter } from "next/navigation";
import { capturarPiloto, encerrarPiloto } from "@/actions/pilotos";
import { ConfirmActionButton } from "../ConfirmActionButton";

/** Atualizar o retrato de hoje e encerrar/cancelar — ambos auditados no banco. */
export function AcoesDoPiloto({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmActionButton
        label="Atualizar agora"
        modalTitle="Atualizar o retrato de hoje"
        warning="Recalcula os números de hoje com os dados atuais. Só lê a operação da barbearia; nada nela muda."
        confirmLabel="Atualizar"
        pendingLabel="Atualizando…"
        successMessage="Retrato de hoje atualizado."
        variant="primary"
        triggerVariant="secondary"
        action={async () => {
          const r = await capturarPiloto(id);
          if (r.ok) router.refresh();
          return r;
        }}
      />
      <ConfirmActionButton
        label="Encerrar piloto"
        modalTitle="Encerrar piloto"
        warning="Fecha o retrato de hoje e para a coleta. Os dias registrados continuam disponíveis. Não dá para reabrir."
        confirmLabel="Encerrar"
        pendingLabel="Encerrando…"
        successMessage="Piloto encerrado."
        variant="danger"
        triggerVariant="ghost"
        requireReason
        action={async (motivo) => {
          const r = await encerrarPiloto(id, motivo ?? "", false);
          if (r.ok) router.refresh();
          return r;
        }}
      />
    </div>
  );
}
