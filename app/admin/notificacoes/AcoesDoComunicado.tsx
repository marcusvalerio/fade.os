"use client";

import { useRouter } from "next/navigation";
import { enviarComunicado, cancelarComunicado } from "@/actions/notificacoes-admin";
import { ConfirmActionButton } from "../ConfirmActionButton";

export function AcoesDoComunicado({ id, status }: { id: string; status: "rascunho" | "agendado" }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "rascunho" && (
        <ConfirmActionButton
          label="Enviar"
          modalTitle="Enviar comunicado"
          warning="Sai agora (ou na data marcada) para o destino escolhido. Não dá para desfazer."
          confirmLabel="Enviar"
          pendingLabel="Enviando…"
          successMessage="Comunicado enviado."
          variant="primary"
          action={async () => {
            const r = await enviarComunicado(id);
            if (r.ok) router.refresh();
            return r.ok ? { ok: true, data: null } : r;
          }}
        />
      )}
      <ConfirmActionButton
        label="Cancelar"
        modalTitle="Cancelar comunicado"
        warning="Ninguém recebe. O registro continua na lista como cancelado."
        confirmLabel="Cancelar comunicado"
        pendingLabel="Cancelando…"
        successMessage="Comunicado cancelado."
        variant="danger"
        triggerVariant="ghost"
        action={async () => {
          const r = await cancelarComunicado(id);
          if (r.ok) router.refresh();
          return r;
        }}
      />
    </div>
  );
}
