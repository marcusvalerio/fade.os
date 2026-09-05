"use client";

import { useState } from "react";
import { addAttendanceItem } from "@/actions/atendimento";
import { Field, Input, Select, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border bg-surface p-5 space-y-4"
    >
      <p className="text-section-title text-foreground">Adicionar serviço</p>
      <div className="grid grid-cols-2 gap-3">
        <Select value={serviceId} onChange={(e) => handleServiceChange(e.target.value)} required>
          <option value="">Serviço...</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
          required
          disabled={!serviceId}
        >
          <option value="">Profissional...</option>
          {availableProfessionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço"
          required
        />
        <Input
          type="number"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="Desconto"
          disabled={isCourtesy}
        />
        <Input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duração planejada (min)"
          required
          className="col-span-2"
        />
      </div>

      <label className="flex items-center gap-2 text-body-sm text-foreground">
        <Checkbox checked={isCourtesy} onChange={(e) => setIsCourtesy(e.target.checked)} />
        Cortesia (sem cobrança)
      </label>

      {isCourtesy && (
        <Field name="courtesy_reason" label="Motivo da cortesia">
          <Input
            id="courtesy_reason"
            value={courtesyReason}
            onChange={(e) => setCourtesyReason(e.target.value)}
          />
        </Field>
      )}

      {error && <p className="text-body-sm text-danger">{error}</p>}

      <Button type="submit" pending={pending} disabled={!serviceId || !professionalId} className="w-full">
        {pending ? "Adicionando…" : "Adicionar"}
      </Button>
    </form>
  );
}
