"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAttendanceItem } from "@/actions/atendimento";
import { Field, Input, Select, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";

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
  requiresAuthorization,
}: {
  attendanceId: string;
  services: ServiceOption[];
  professionalsByService: Record<string, ProfessionalOption[]>;
  requiresAuthorization: boolean;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [isCourtesy, setIsCourtesy] = useState(false);
  const [courtesyReason, setCourtesyReason] = useState("");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const availableProfessionals = professionalsByService[serviceId] ?? [];

  // Preço e duração são exibidos como referência do catálogo. Quem os define
  // no atendimento é o servidor, lendo o próprio `service` — mandar o valor
  // daqui deixaria o preço nas mãos do cliente.
  const selectedService = services.find((s) => s.id === serviceId);

  function handleServiceChange(id: string) {
    setServiceId(id);
    setProfessionalId("");
    setDiscount("0");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await addAttendanceItem({
      attendance_id: attendanceId,
      service_id: serviceId,
      professional_id: professionalId,
      discount: Number(discount),
      type: isCourtesy ? "courtesy" : "normal",
      courtesy_reason: isCourtesy ? courtesyReason : undefined,
      authorization_code: authorizationCode.trim() || undefined,
    });

    setPending(false);
    if (!result.ok) return setError(result.error);

    setServiceId("");
    setProfessionalId("");
    setDiscount("0");
    setIsCourtesy(false);
    setCourtesyReason("");
    setAuthorizationCode("");
    // revalidatePath sozinho não republica esta página: sem isto, o item
    // fica gravado no banco mas some da lista até um reload manual — a
    // pessoa vê "nenhum serviço adicionado" e pode tentar de novo, cobrando
    // o mesmo serviço duas vezes.
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border bg-surface p-5 space-y-4"
    >
      <p className="text-section-title text-foreground">Adicionar serviço</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          min="0"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="Desconto"
          disabled={isCourtesy}
          className="col-span-2"
        />
      </div>

      {selectedService && (
        <p className="text-body-sm text-muted">
          {formatCurrency(selectedService.default_price)} ·{" "}
          {selectedService.planned_duration_minutes} min
        </p>
      )}

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

      <AuthorizationCodeField
        value={authorizationCode}
        onChange={setAuthorizationCode}
        visible={requiresAuthorization && (isCourtesy || Number(discount) > 0)}
        operation={isCourtesy ? "courtesy" : "discount"}
      />

      {error && <p className="text-body-sm text-danger">{error}</p>}

      <Button type="submit" pending={pending} disabled={!serviceId || !professionalId} className="w-full">
        {pending ? "Adicionando…" : "Adicionar"}
      </Button>
    </form>
  );
}
