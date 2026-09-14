"use client";

import { useState } from "react";
import { setSelfProfessionalContext } from "@/actions/profissionais";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * P0.3 — habilita/desabilita o contexto profissional da própria conta
 * (owner/admin que também atende). Nunca cria uma segunda conta nem muda
 * o papel real: só cria/desativa o registro em `professional` vinculado a
 * auth.uid(), o mesmo sinal que já decide quem tem "Trocar modo" no menu.
 */
export function SelfProfessionalToggle({ enabled }: { enabled: boolean }) {
  const { show } = useToast();
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState(enabled);

  async function handleToggle() {
    setPending(true);
    const result = await setSelfProfessionalContext(!current);
    setPending(false);
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    setCurrent(!current);
    show(
      !current
        ? "Contexto de atendimento ativado — use \"Trocar modo\" no menu para entrar nele."
        : "Contexto de atendimento desativado. Seu histórico de comissões e atendimentos continua intacto.",
      "success"
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-body-sm text-foreground">
        {current
          ? "Você também atende clientes nesta empresa."
          : "Você só administra esta empresa — sem contexto de atendimento."}
      </p>
      <Button type="button" variant={current ? "secondary" : "primary"} onClick={handleToggle} pending={pending}>
        {current ? "Desativar atendimento" : "Também atendo clientes"}
      </Button>
    </div>
  );
}
