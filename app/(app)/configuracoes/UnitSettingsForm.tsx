"use client";

import { useState, useTransition } from "react";
import { updateUnitSettings } from "@/actions/configuracoes";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Unit } from "@/lib/types";

export function UnitSettingsForm({ unit }: { unit: Unit }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateUnitSettings(unit.id, formData);
      if (!result.ok) {
        setError(result.error);
        show(result.error, "danger");
        return;
      }
      show("Unidade salva.", "success");
    });
  }

  return (
    <form action={handleSubmit} className="rounded-md border border-border bg-surface p-6 space-y-4">
      <Field name="name" label="Nome da unidade" required>
        <Input id="name" name="name" defaultValue={unit.name} required />
      </Field>
      <Field name="address" label="Endereço">
        <Input id="address" name="address" defaultValue={unit.address ?? ""} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="phone" label="Telefone">
          <Input id="phone" name="phone" defaultValue={unit.phone ?? ""} />
        </Field>
        <Field name="status" label="Status">
          <Select id="status" name="status" defaultValue={unit.status}>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </Select>
        </Field>
      </div>
      <Field
        name="business_hours_note"
        label="Funcionamento"
        helper="Um texto livre por enquanto — ex.: Seg a Sáb, 9h às 19h."
      >
        <Textarea
          id="business_hours_note"
          name="business_hours_note"
          rows={2}
          defaultValue={unit.business_hours_note ?? ""}
        />
      </Field>
      {error && <p className="text-body-sm text-danger">{error}</p>}
      <Button type="submit" pending={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
