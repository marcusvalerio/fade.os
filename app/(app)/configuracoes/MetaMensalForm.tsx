"use client";

import { useState, useTransition } from "react";
import { salvarMetaMensal } from "@/actions/configuracoes";
import { MoneyInput } from "@/components/ui/money-input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Aviso } from "@/components/ui/estado";

/** A meta de faturamento do mês — o Início acompanha o ritmo até ela. */
export function MetaMensalForm({ companyId, metaAtual }: { companyId: string; metaAtual: number }) {
  const [valor, setValor] = useState(metaAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const { show } = useToast();

  return (
    <form
      className="space-y-3 max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await salvarMetaMensal(companyId, valor);
          if (!r.ok) return setErro(r.error);
          show(valor > 0 ? "Meta do mês salva. O Início já acompanha o ritmo." : "Meta removida.", "success");
        });
      }}
    >
      <Field name="meta_faturamento_mensal" label="Meta de faturamento do mês" helper="Zero remove a meta.">
        <MoneyInput value={valor} onValueChange={setValor} />
      </Field>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Button type="submit" variant="secondary" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar meta"}
      </Button>
    </form>
  );
}
