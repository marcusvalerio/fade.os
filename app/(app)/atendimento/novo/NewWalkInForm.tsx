"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWalkInAttendance } from "@/actions/atendimento";
import { Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

export default function NewWalkInForm({
  companyId,
  unitId,
  clients,
}: {
  companyId: string;
  unitId: string;
  clients: Option[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await createWalkInAttendance({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push(`/atendimento/${result.data.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border bg-surface p-6 space-y-4"
    >
      <Field name="client_id" label="Cliente" required>
        <Select id="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          <option value="">Selecione...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="text-body-sm text-danger">{error}</p>}
      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Criando…" : "Iniciar atendimento"}
      </Button>
    </form>
  );
}
