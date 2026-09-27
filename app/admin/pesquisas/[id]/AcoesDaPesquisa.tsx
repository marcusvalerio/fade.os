"use client";

import { useRouter } from "next/navigation";
import { mudarStatusDaPesquisa, excluirRascunhoDePesquisa } from "@/actions/pesquisas";
import { ConfirmActionButton } from "../../ConfirmActionButton";
import type { StatusDaPesquisa } from "@/lib/pesquisas";

export function AcoesDaPesquisa({ id, status }: { id: string; status: StatusDaPesquisa }) {
  const router = useRouter();

  if (status === "rascunho") {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfirmActionButton
          label="Publicar"
          modalTitle="Publicar pesquisa"
          warning="Depois de publicada, a pergunta, o tipo, as opções e o público não mudam mais. Ela começa a aparecer para o público escolhido a partir da data de publicação."
          confirmLabel="Publicar"
          pendingLabel="Publicando…"
          successMessage="Pesquisa publicada."
          variant="primary"
          action={async () => {
            const r = await mudarStatusDaPesquisa(id, "publicada");
            if (r.ok) router.refresh();
            return r;
          }}
        />
        <ConfirmActionButton
          label="Excluir rascunho"
          modalTitle="Excluir rascunho"
          warning="O rascunho some. Nenhuma pessoa viu esta pesquisa ainda."
          confirmLabel="Excluir"
          pendingLabel="Excluindo…"
          successMessage="Rascunho excluído."
          variant="danger"
          triggerVariant="ghost"
          action={async () => {
            const r = await excluirRascunhoDePesquisa(id);
            if (r.ok) router.push("/admin/pesquisas");
            return r;
          }}
        />
      </div>
    );
  }

  if (status === "publicada") {
    return (
      <ConfirmActionButton
        label="Encerrar agora"
        modalTitle="Encerrar pesquisa"
        warning="Ela para de aparecer imediatamente. As respostas já dadas continuam aqui."
        confirmLabel="Encerrar"
        pendingLabel="Encerrando…"
        successMessage="Pesquisa encerrada."
        variant="danger"
        action={async () => {
          const r = await mudarStatusDaPesquisa(id, "encerrada");
          if (r.ok) router.refresh();
          return r;
        }}
      />
    );
  }

  return null;
}
