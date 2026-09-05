"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/agenda";

type Option = { id: string; name: string };

type Line = {
  service_id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
};

const emptyLine: Line = { service_id: "", professional_id: "", starts_at: "", ends_at: "" };

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
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
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
    <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl shadow-sm p-6">
      <div>
        <label className="block text-sm mb-1">Cliente</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Selecione...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {lines.map((line, i) => (
          <div key={i} className="border border-[var(--color-midnight-smoke)]/10 rounded-lg p-4 space-y-3">
            <p className="text-xs text-[var(--color-midnight-smoke)]">Serviço {i + 1}</p>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={line.service_id}
                onChange={(e) => updateLine(i, "service_id", e.target.value)}
                required
                className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Serviço...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={line.professional_id}
                onChange={(e) => updateLine(i, "professional_id", e.target.value)}
                required
                className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Profissional...</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={line.starts_at}
                onChange={(e) => updateLine(i, "starts_at", e.target.value)}
                required
                className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={line.ends_at}
                onChange={(e) => updateLine(i, "ends_at", e.target.value)}
                required
                className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
          className="text-sm text-[var(--color-red-gravy)] underline"
        >
          + adicionar outro serviço
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-otan-red)]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Criar agendamento"}
      </button>
    </form>
  );
}
