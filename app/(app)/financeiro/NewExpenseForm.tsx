"use client";

import { useState } from "react";
import { createFinancialEntry } from "@/actions/financeiro";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";

const CATEGORIAS_COMUNS = ["Aluguel", "Energia", "Água", "Internet e telefone", "Compra de revenda", "Material de consumo", "Manutenção", "Marketing", "Impostos e taxas", "Outros"];

/**
 * A data padrão é o dia da barbearia, vindo do servidor — `new Date()` em UTC
 * virava "amanhã" depois das 21h no Brasil (e divergia entre servidor e
 * navegador).
 */
export function NewExpenseForm({ companyId, hoje }: { companyId: string; hoje: string }) {
  const { show } = useToast();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [entryDate, setEntryDate] = useState(hoje);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await createFinancialEntry({
      company_id: companyId,
      type: "expense",
      category,
      description: description || undefined,
      amount,
      supplier: supplier || undefined,
      entry_date: entryDate,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      show(result.error, "danger");
      return;
    }
    show("Despesa lançada.", "success");
    setCategory("");
    setDescription("");
    setAmount(0);
    setSupplier("");
  }

  return (
    <details className="group painel">
      <summary className="alvo-toque flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
        <span className="text-body-sm font-medium text-foreground">Lançar despesa</span>
        <span aria-hidden="true" className="text-caption text-muted group-open:hidden">Abrir</span>
        <span aria-hidden="true" className="hidden text-caption text-muted group-open:inline">Fechar</span>
      </summary>
    <form onSubmit={handleSubmit} className="border-t border-border p-5 space-y-4">
      <datalist id="categorias-de-despesa">
        {CATEGORIAS_COMUNS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="category" label="Categoria" required>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} required list="categorias-de-despesa" autoComplete="off" />
        </Field>
        <Field name="amount" label="Valor" required>
          <MoneyInput value={amount} onValueChange={setAmount} />
        </Field>
        <Field name="supplier" label="Fornecedor">
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field name="entry_date" label="Data">
          <Input type="date" value={entryDate} max={hoje} onChange={(e) => setEntryDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field name="description" label="Descrição" helper="Opcional">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>
      {error && <p className="text-body-sm text-danger-ink">{error}</p>}
      <Button type="submit" pending={pending} disabled={!category || amount <= 0} className="w-full">
        Lançar despesa
      </Button>
    </form>
    </details>
  );
}
