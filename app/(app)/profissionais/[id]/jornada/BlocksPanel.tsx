"use client";

import { useState, useTransition } from "react";
import { createProfessionalBlock, cancelProfessionalBlock } from "@/actions/disponibilidade";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { ProfessionalBlock } from "@/lib/types";

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return `${start.toLocaleDateString("pt-BR", dateFmt)} · ${start.toLocaleTimeString("pt-BR", timeFmt)}–${end.toLocaleTimeString("pt-BR", timeFmt)}`;
  }
  return `${start.toLocaleDateString("pt-BR", dateFmt)} ${start.toLocaleTimeString("pt-BR", timeFmt)} → ${end.toLocaleDateString("pt-BR", dateFmt)} ${end.toLocaleTimeString("pt-BR", timeFmt)}`;
}

export function BlocksPanel({
  professionalId,
  blocks,
}: {
  professionalId: string;
  blocks: ProfessionalBlock[];
}) {
  const { show } = useToast();
  const [items, setItems] = useState(blocks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProfessionalBlock({
        professional_id: professionalId,
        starts_at: String(formData.get("starts_at")),
        ends_at: String(formData.get("ends_at")),
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
          unit_id: null,
          starts_at: new Date(String(formData.get("starts_at"))).toISOString(),
          ends_at: new Date(String(formData.get("ends_at"))).toISOString(),
          reason: String(formData.get("reason") || "") || null,
          status: "active",
        },
        ...prev,
      ]);
      show("Bloqueio criado.", "success");
    });
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await cancelProfessionalBlock(id, professionalId);
      if (!result.ok) return show(result.error, "danger");
      setItems((prev) => prev.filter((b) => b.id !== id));
      show("Bloqueio cancelado.", "success");
    });
  }

  const active = items.filter((b) => b.status === "active");

  return (
    <div className="space-y-4">
      <Surface>
        {active.length > 0 ? (
          active.map((b) => (
            <SurfaceRow key={b.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body-sm font-medium text-foreground">{formatRange(b.starts_at, b.ends_at)}</p>
                {b.reason && <p className="text-caption text-muted mt-0.5">{b.reason}</p>}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => handleCancel(b.id)}>
                Cancelar
              </Button>
            </SurfaceRow>
          ))
        ) : (
          <EmptyState title="Nenhum bloqueio ativo" description="Reuniões, compromissos ou manutenções entram aqui." />
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
        <Field name="reason" label="Motivo">
          <Input id="reason" name="reason" placeholder="Ex.: Reunião, manutenção" />
        </Field>
        {error && <p className="text-body-sm text-danger">{error}</p>}
        <Button type="submit" variant="secondary" pending={pending} className="w-full">
          Adicionar bloqueio
        </Button>
      </form>
    </div>
  );
}
