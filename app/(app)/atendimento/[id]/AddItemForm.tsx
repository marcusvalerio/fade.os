"use client";

import { useMemo, useState } from "react";
import { addAttendanceItem } from "@/actions/atendimento";

type ServiceOption = {
  id: string;
  name: string;
  default_price: number;
  planned_duration_minutes: number;
};

type ProfessionalOption = { id: string; name: string };

export default function AddItemForm({
  attendanceId,
  services,
  professionalsByService,
}: {
  attendanceId: string;
  services: ServiceOption[];
  professionalsByService: Record<string, ProfessionalOption[]>;
}) {
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [duration, setDuration] = useState("");
  const [isCourtesy, setIsCourtesy] = useState(false);
  const [courtesyReason, setCourtesyReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [serviceId, services]
  );
  const availableProfessionals = professionalsByService[serviceId] ?? [];

  function handleServiceChange(id: string) {
    setServiceId(id);
    setProfessionalId("");
    const service = services.find((s) => s.id === id);
    if (service) {
      setPrice(service.default_price.toString());
      setDuration(service.planned_duration_minutes.toString());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await addAttendanceItem({
      attendance_id: attendanceId,
      service_id: serviceId,
      professional_id: professionalId,
      original_price: Number(price),
      discount: Number(discount),
      planned_duration_minutes: Number(duration),
      type: isCourtesy ? "courtesy" : "normal",
      courtesy_reason: isCourtesy ? courtesyReason : undefined,
    });

    setPending(false);
    if (!result.ok) return setError(result.error);

    setServiceId("");
    setProfessionalId("");
    setPrice("");
    setDiscount("0");
    setDuration("");
    setIsCourtesy(false);
    setCourtesyReason("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-xl shadow-sm p-4">
      <p className="text-sm font-medium">Adicionar serviço ao atendimento</p>
      <div className="grid grid-cols-2 gap-3">
        <select
          value={serviceId}
          onChange={(e) => handleServiceChange(e.target.value)}
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
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          required
          disabled={!serviceId}
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Profissional...</option>
          {availableProfessionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço"
          required
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="Desconto"
          disabled={isCourtesy}
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm disabled:opacity-50"
        />
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duração planejada (min)"
          required
          className="border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm col-span-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isCourtesy}
          onChange={(e) => setIsCourtesy(e.target.checked)}
        />
        Cortesia (sem cobrança)
      </label>

      {isCourtesy && (
        <input
          type="text"
          value={courtesyReason}
          onChange={(e) => setCourtesyReason(e.target.value)}
          placeholder="Motivo da cortesia"
          className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
        />
      )}

      {error && <p className="text-sm text-[var(--color-otan-red)]">{error}</p>}

      <button
        type="submit"
        disabled={pending || !serviceId || !professionalId}
        className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Adicionando..." : "Adicionar"}
      </button>
    </form>
  );
}
