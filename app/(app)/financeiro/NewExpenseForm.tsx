"use client";

import { useState } from "react";
import { createFinancialEntry } from "@/actions/financeiro";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { useToast } from "@/components/ui/toast";

export function NewExpenseForm({ companyId }: { companyId: string }) {
  const { show } = useToast();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-5 space-y-4">
      <p className="text-section-title text-foreground">Nova despesa</p>
      <div className="grid grid-cols-2 gap-3">
        <Field name="category" label="Categoria" required>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} required />
        </Field>
        <Field name="amount" label="Valor" required>
          <MoneyInput value={amount} onValueChange={setAmount} />
        </Field>
        <Field name="supplier" label="Fornecedor">
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field name="entry_date" label="Data">
          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </Field>
        <Field name="description" label="Descrição" helper="Opcional">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-2" />
        </Field>
      </div>
      {error && <p className="text-body-sm text-danger">{error}</p>}
      <Button type="submit" pending={pending} disabled={!category || amount <= 0} className="w-full">
        Lançar despesa
      </Button>
    </form>
  );
}
