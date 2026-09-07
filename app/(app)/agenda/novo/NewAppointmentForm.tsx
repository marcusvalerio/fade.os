"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/agenda";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

type Line = {
  service_id: string;
  professional_id: string;
  starts_at: string;
};

// Sem campo de fim: a duração é a do serviço, aplicada pelo servidor.
const emptyLine: Line = { service_id: "", professional_id: "", starts_at: "" };

export default function NewAppointmentForm({
  companyId,
  unitId,
  clients,
  professionals,
  services,
}: {
  companyId: string;
  unitId: string;
  clients: Option[];
  professionals: Option[];
  services: Option[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await createAppointment({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId,
      lines,
    });

    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push("/agenda");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-6 space-y-6">
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

      <div className="space-y-4">
        {lines.map((line, i) => (
          <div key={i} className="border border-border rounded-md p-4 space-y-3">
            <p className="text-label uppercase text-muted">Serviço {i + 1}</p>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={line.service_id}
                onChange={(e) => updateLine(i, "service_id", e.target.value)}
                required
              >
                <option value="">Serviço...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                value={line.professional_id}
                onChange={(e) => updateLine(i, "professional_id", e.target.value)}
                required
              >
                <option value="">Profissional...</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Input
                type="datetime-local"
                value={line.starts_at}
                onChange={(e) => updateLine(i, "starts_at", e.target.value)}
                required
                className="col-span-2"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
          className="text-body-sm text-primary hover:underline"
        >
          + adicionar outro serviço
        </button>
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Salvando…" : "Criar agendamento"}
      </Button>
    </form>
  );
}
