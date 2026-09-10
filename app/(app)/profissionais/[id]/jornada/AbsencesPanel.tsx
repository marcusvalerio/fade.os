"use client";

import { useState, useTransition } from "react";
import { createProfessionalAbsence, deleteProfessionalAbsence } from "@/actions/disponibilidade";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { businessInstant, formatBusinessDate } from "@/lib/time";
import type { ProfessionalAbsence, ProfessionalAbsenceType } from "@/lib/types";

const TYPE_LABEL: Record<ProfessionalAbsenceType, string> = {
  vacation: "Férias",
  day_off: "Folga",
  leave: "Afastamento",
  holiday: "Feriado individual",
  other: "Outro",
};

// No relógio da barbearia — uma folga que começa às 00:00 não pode aparecer
// como se começasse na véspera.
const RANGE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function formatRange(startsAt: string, endsAt: string) {
  return `${formatBusinessDate(startsAt, RANGE_FMT)} → ${formatBusinessDate(endsAt, RANGE_FMT)}`;
}

export function AbsencesPanel({
  professionalId,
  absences,
}: {
  professionalId: string;
  absences: ProfessionalAbsence[];
}) {
  const { show } = useToast();
  const [items, setItems] = useState(absences);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const type = String(formData.get("type") || "other") as ProfessionalAbsenceType;
    startTransition(async () => {
      const result = await createProfessionalAbsence({
        professional_id: professionalId,
        starts_at: String(formData.get("starts_at")),
        ends_at: String(formData.get("ends_at")),
        type,
        reason: String(formData.get("reason") || "") || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return show(result.error, "danger");
      }
      setItems((prev) => [
        {
          id: result.data.id,
          professional_id: professionalId,
          starts_at: businessInstant(String(formData.get("starts_at"))).toISOString(),
          ends_at: businessInstant(String(formData.get("ends_at"))).toISOString(),
          type,
          reason: String(formData.get("reason") || "") || null,
        },
        ...prev,
      ]);
      show("Ausência registrada.", "success");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProfessionalAbsence(id, professionalId);
      if (!result.ok) return show(result.error, "danger");
      setItems((prev) => prev.filter((a) => a.id !== id));
      show("Ausência removida.", "success");
    });
  }

  return (
    <div className="space-y-4">
      <Surface>
        {items.length > 0 ? (
          items.map((a) => (
            <SurfaceRow key={a.id} className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{TYPE_LABEL[a.type]}</Badge>
                  <p className="text-body-sm font-medium text-foreground">{formatRange(a.starts_at, a.ends_at)}</p>
                </div>
                {a.reason && <p className="text-caption text-muted mt-1">{a.reason}</p>}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => handleDelete(a.id)}>
                Remover
              </Button>
            </SurfaceRow>
          ))
        ) : (
          <Vazio titulo="Nenhuma ausência registrada" descricao="Férias, folgas e afastamentos entram aqui." />
        )}
      </Surface>

      <form action={handleSubmit} className="rounded-md border border-border bg-surface p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field name="starts_at" label="Início" required>
            <Input id="starts_at" name="starts_at" type="datetime-local" required />
          </Field>
          <Field name="ends_at" label="Fim" required>
            <Input id="ends_at" name="ends_at" type="datetime-local" required />
          </Field>
        </div>
        <Field name="type" label="Tipo">
          <Select id="type" name="type" defaultValue="vacation">
            <option value="vacation">Férias</option>
            <option value="day_off">Folga</option>
            <option value="leave">Afastamento</option>
            <option value="holiday">Feriado individual</option>
            <option value="other">Outro</option>
          </Select>
        </Field>
        <Field name="reason" label="Observação">
          <Input id="reason" name="reason" />
        </Field>
        {error && <p className="text-body-sm text-danger">{error}</p>}
        <Button type="submit" variant="secondary" pending={pending} className="w-full">
          Registrar ausência
        </Button>
      </form>
    </div>
  );
}
