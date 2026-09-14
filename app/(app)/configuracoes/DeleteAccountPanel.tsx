"use client";

import { useState } from "react";
import { deleteOwnAccount } from "@/actions/conta";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const PALAVRA_CONFIRMACAO = "EXCLUIR";

/**
 * Destrutiva por definição, então exige digitar a palavra de confirmação
 * — não basta clicar duas vezes. O texto explica antes de perguntar: o
 * histórico comercial da empresa nunca é apagado por esta ação, só o
 * vínculo desta conta com ele.
 */
export function DeleteAccountPanel() {
  const { show } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setPending(true);
    const result = await deleteOwnAccount();
    setPending(false);
    if (result && !result.ok) {
      setError(result.error);
      show(result.error, "danger");
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-muted">
          Remove o acesso desta conta a todas as empresas vinculadas. Vendas, comissões e
          atendimentos já registrados continuam pertencendo à empresa — nada disso é apagado.
        </p>
        <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
          Excluir minha conta
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-sm border border-danger/40 bg-surface-muted p-4">
      <p className="text-body-sm text-danger-ink font-medium">
        Esta ação não pode ser desfeita. Você perde o acesso a todas as empresas vinculadas a
        esta conta agora mesmo.
      </p>
      <p className="text-body-sm text-muted">
        Se você for o único responsável por alguma empresa, primeiro adicione outro responsável
        em Equipe — do contrário a exclusão será bloqueada.
      </p>
      <Field name="confirmacao" label={`Digite ${PALAVRA_CONFIRMACAO} para confirmar`}>
        <Input
          id="confirmacao"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </Field>
      {error && <p className="text-body-sm text-danger-ink">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          pending={pending}
          disabled={word.trim().toUpperCase() !== PALAVRA_CONFIRMACAO}
          onClick={handleDelete}
        >
          {pending ? "Excluindo…" : "Confirmar exclusão"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setConfirming(false); setWord(""); setError(null); }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
