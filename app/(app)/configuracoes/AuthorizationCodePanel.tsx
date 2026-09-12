"use client";

import { useState } from "react";
import { regenerateAuthorizationCode } from "@/actions/configuracoes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Painel do código de autorização.
 *
 * O código aparece uma única vez, aqui, logo depois de gerado — o banco guarda
 * só o hash e não há como recuperá-lo depois. Por isso a tela avisa antes de
 * trocar: quem estiver com o código antigo perde a autorização na hora.
 */
export function AuthorizationCodePanel({
  companyId,
  configured,
}: {
  companyId: string;
  configured: boolean;
}) {
  const { show } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleGenerate() {
    setPending(true);
    const result = await regenerateAuthorizationCode(companyId);
    setPending(false);
    setConfirming(false);

    if (!result.ok) {
      show(result.error, "danger");
      return;
    }

    setCode(result.data.code);
    show("Código gerado. Anote agora — ele não aparece de novo.", "success");
  }

  return (
    <section className="material-solid rounded-md p-5 space-y-4">
      <div>
        <h2 className="text-section-title text-foreground">Código de autorização</h2>
        <p className="text-body-sm text-muted mt-1">
          Libera desconto e cortesia para quem não é responsável nem gerente. Não dá acesso
          administrativo: autoriza só a operação em que for usado, e cada uso fica registrado.
        </p>
      </div>

      {code ? (
        <div className="rounded-sm border border-signal/40 bg-surface-muted p-4">
          <p className="text-label uppercase text-muted">Anote agora</p>
          <p className="text-metric text-foreground tracking-[0.2em] tabular-nums mt-1">{code}</p>
          <p className="text-caption text-muted mt-2">
            Este código não será exibido novamente. Se perder, gere outro.
          </p>
        </div>
      ) : (
        <p className="text-body-sm text-muted">
          {configured
            ? "Já existe um código ativo para esta empresa."
            : "Nenhum código configurado ainda — a equipe não consegue aplicar desconto nem cortesia."}
        </p>
      )}

      {confirming ? (
        <div className="space-y-3">
          <p className="text-body-sm text-warning-ink">
            Gerar um código novo invalida o atual imediatamente. Quem estiver usando o código
            antigo deixa de conseguir autorizar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleGenerate} pending={pending}>
              {pending ? "Gerando…" : "Confirmar e gerar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant={configured ? "secondary" : "primary"}
          onClick={() => (configured ? setConfirming(true) : handleGenerate())}
          pending={pending}
        >
          {configured ? "Gerar novo código" : "Gerar código"}
        </Button>
      )}
    </section>
  );
}
