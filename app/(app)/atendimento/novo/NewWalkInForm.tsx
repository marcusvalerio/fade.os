"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWalkInAttendance } from "@/actions/atendimento";

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
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow-sm p-6">
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
      {error && <p className="text-sm text-[var(--color-otan-red)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Criando..." : "Iniciar atendimento"}
      </button>
    </form>
  );
}
