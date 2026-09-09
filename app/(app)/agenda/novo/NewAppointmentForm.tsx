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
  professionalsByService,
  services,
}: {
  companyId: string;
  unitId: string;
  clients: Option[];
  /** Quem realmente executa cada serviço. A lista de profissionais deixa de
   *  ser global: escolher o serviço é que decide quem pode ser oferecido. */
  professionalsByService: Record<string, Option[]>;
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

  // Trocar o serviço limpa o profissional: quem estava escolhido pode não
  // fazer o serviço novo, e deixar o valor antigo seria oferecer de novo
  // uma combinação que o banco recusa.
  function escolherServico(index: number, serviceId: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, service_id: serviceId, professional_id: "" } : l))
    );
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                value={line.service_id}
                onChange={(e) => escolherServico(i, e.target.value)}
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
                disabled={!line.service_id}
              >
                <option value="">
                  {line.service_id ? "Profissional..." : "Escolha o serviço primeiro"}
                </option>
                {(professionalsByService[line.service_id] ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {line.service_id && (professionalsByService[line.service_id] ?? []).length === 0 && (
                <p className="col-span-2 text-body-sm text-danger">
                  Nenhum profissional ativo faz esse serviço. Vincule alguém em Equipe →
                  Profissionais.
                </p>
              )}
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
