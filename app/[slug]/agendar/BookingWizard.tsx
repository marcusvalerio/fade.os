"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  getPublicProfessionals,
  getPublicAvailableSlots,
  createPublicAppointment,
} from "@/actions/public";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { PublicService, PublicProfessional, PublicSlot, PublicAppointmentCreated } from "@/lib/types";

type Step = "service" | "professional" | "date" | "time" | "client" | "review" | "done";

const ANY_PROFESSIONAL = "any" as const;

// Os horários da grade são do relógio da barbearia, não do relógio de quem
// está olhando: um cliente viajando não pode ver a barbearia abrindo às 05:00.
function formatDateLabel(iso: string): string {
  return formatBusinessDayLabel(iso, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function BookingWizard({
  slug,
  companyName,
  services,
}: {
  slug: string;
  companyName: string;
  services: PublicService[];
}) {
  const { show } = useToast();
  const [step, setStep] = useState<Step>("service");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [service, setService] = useState<PublicService | null>(null);
  const [professionals, setProfessionals] = useState<PublicProfessional[]>([]);
  const [professionalChoice, setProfessionalChoice] = useState<string | typeof ANY_PROFESSIONAL | null>(null);

  const [date, setDate] = useState(businessToday());
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [created, setCreated] = useState<PublicAppointmentCreated | null>(null);

  const selectedProfessionalName = useMemo(() => {
    if (!selectedSlot) return "";
    return selectedSlot.professional_name;
  }, [selectedSlot]);

  function chooseService(s: PublicService) {
    setService(s);
    setError(null);
    setProfessionalChoice(null);
    startTransition(async () => {
      const result = await getPublicProfessionals(slug, s.service_id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProfessionals(result.data);
      if (result.data.length === 1) {
        setProfessionalChoice(result.data[0].professional_id);
        setStep("date");
      } else {
        setStep("professional");
      }
    });
  }

  function chooseProfessional(choice: string | typeof ANY_PROFESSIONAL) {
    setProfessionalChoice(choice);
    setStep("date");
  }

  function loadSlots(targetDate: string) {
    if (!service) return;
    setDate(targetDate);
    setSlotsLoaded(false);
    setSelectedSlot(null);
    setError(null);
    startTransition(async () => {
      const result = await getPublicAvailableSlots({
        slug,
        serviceId: service.service_id,
        date: targetDate,
        professionalId:
          professionalChoice && professionalChoice !== ANY_PROFESSIONAL ? professionalChoice : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setSlotsLoaded(true);
        return;
      }
      setSlots(result.data);
      setSlotsLoaded(true);
    });
  }

  function goToTimeStep() {
    setStep("time");
    loadSlots(date);
  }

  const dedupedSlots = useMemo(() => {
    const sorted = [...slots].sort((a, b) => {
      if (a.slot_start !== b.slot_start) return a.slot_start.localeCompare(b.slot_start);
      return a.professional_id.localeCompare(b.professional_id);
    });
    const byTime = new Map<string, PublicSlot>();
    for (const slot of sorted) {
      if (!byTime.has(slot.slot_start)) byTime.set(slot.slot_start, slot);
    }
    return Array.from(byTime.values());
  }, [slots]);

  function chooseSlot(slot: PublicSlot) {
    setSelectedSlot(slot);
    setStep("client");
  }

  function submitClientData() {
    if (clientName.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }
    if (clientPhone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone válido, com DDD.");
      return;
    }
    setError(null);
    setStep("review");
  }

  function confirmAppointment() {
    if (!service || !selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await createPublicAppointment({
        slug,
        serviceId: service.service_id,
        professionalId: selectedSlot.professional_id,
        startsAt: selectedSlot.slot_start,
        clientName,
        clientPhone,
        clientEmail: clientEmail || undefined,
      });

      if (!result.ok) {
        show(result.error, "danger");
        setError(result.error);
        if (result.error.includes("reservado")) {
          setStep("time");
          loadSlots(date);
        }
        return;
      }

      setCreated(result.data);
      setStep("done");
    });
  }

  return (
    <div className="animate-fade-in">
      {step !== "service" && step !== "done" && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            if (step === "professional") setStep("service");
            else if (step === "date") setStep(professionals.length > 1 ? "professional" : "service");
            else if (step === "time") setStep("date");
            else if (step === "client") setStep("time");
            else if (step === "review") setStep("client");
          }}
          className="text-body-sm text-muted hover:text-foreground mb-5 transition-colors duration-fast ease-standard"
        >
          ← Voltar
        </button>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-danger mb-4">
          {error}
        </p>
      )}

      {step === "service" && (
        <div className="space-y-2">
          <p className="text-label uppercase text-muted mb-3">1. Escolha o serviço</p>
          {services.map((s) => (
            <button
              key={s.service_id}
              type="button"
              onClick={() => chooseService(s)}
              disabled={pending}
              className="w-full text-left rounded-md border border-border bg-surface p-4 hover:border-border-strong transition-colors duration-fast ease-standard disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-body font-medium text-foreground">{s.name}</p>
                <p className="text-body-sm text-foreground whitespace-nowrap">
                  {formatCurrency(s.default_price)}
                </p>
              </div>
              <p className="text-caption text-muted mt-1">{formatMinutes(s.planned_duration_minutes)}</p>
            </button>
          ))}
        </div>
      )}

      {step === "professional" && (
        <div className="space-y-2">
          <p className="text-label uppercase text-muted mb-3">2. Escolha o profissional</p>
          {professionals.length > 1 && (
            <button
              type="button"
              onClick={() => chooseProfessional(ANY_PROFESSIONAL)}
              className="w-full text-left rounded-md border border-border-strong bg-surface-context p-4 hover:opacity-90 transition-opacity duration-fast ease-standard"
            >
              <p className="text-body font-medium text-accent-foreground">Qualquer profissional</p>
              <p className="text-caption text-accent-foreground/70 mt-0.5">
                Mostramos o primeiro horário disponível entre todos.
              </p>
            </button>
          )}
          {professionals.map((p) => (
            <button
              key={p.professional_id}
              type="button"
              onClick={() => chooseProfessional(p.professional_id)}
              className="w-full flex items-center gap-3 text-left rounded-md border border-border bg-surface p-4 hover:border-border-strong transition-colors duration-fast ease-standard"
            >
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" className="size-10 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  aria-hidden
                  className="size-10 rounded-full bg-surface-muted flex items-center justify-center text-body-sm text-foreground shrink-0"
                >
                  {p.name.trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-body font-medium text-foreground">{p.name}</p>
                {p.role_title && <p className="text-caption text-muted">{p.role_title}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "date" && (
        <div className="space-y-4">
          <p className="text-label uppercase text-muted">3. Escolha a data</p>
          <Field name="date" label="Data">
            <Input
              type="date"
              name="date"
              min={businessToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-[12rem]"
            />
          </Field>
          <Button type="button" onClick={goToTimeStep} disabled={!date}>
            Ver horários
          </Button>
        </div>
      )}

      {step === "time" && (
        <div className="space-y-4">
          <p className="text-label uppercase text-muted">4. Escolha o horário</p>
          <p className="text-body-sm text-foreground capitalize">{formatDateLabel(date)}</p>

          {!slotsLoaded ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : dedupedSlots.length === 0 ? (
            <EmptyState
              title="Sem horários disponíveis"
              description="Não há horários livres nesta data. Escolha outro dia."
              action={
                <Button type="button" variant="secondary" onClick={() => setStep("date")}>
                  Escolher outra data
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {dedupedSlots.map((slot) => (
                <button
                  key={`${slot.professional_id}-${slot.slot_start}`}
                  type="button"
                  onClick={() => chooseSlot(slot)}
                  className={cn(
                    "h-11 rounded-sm border border-border-strong text-body-sm text-foreground",
                    "hover:bg-surface-muted transition-colors duration-fast ease-standard"
                  )}
                >
                  {formatBusinessTime(slot.slot_start)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "client" && service && selectedSlot && (
        <div className="space-y-4">
          <p className="text-label uppercase text-muted">5. Seus dados</p>
          <Field name="name" label="Nome" required>
            <Input
              id="name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field name="phone" label="Telefone / WhatsApp" required helper="Com DDD">
            <Input
              id="phone"
              inputMode="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              required
            />
          </Field>
          <Field name="email" label="E-mail" helper="Opcional">
            <Input
              id="email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </Field>
          <Button type="button" onClick={submitClientData} className="w-full">
            Continuar
          </Button>
        </div>
      )}

      {step === "review" && service && selectedSlot && (
        <div className="space-y-5">
          <p className="text-label uppercase text-muted">6. Revisão</p>
          <div className="rounded-md border border-border bg-surface p-5 space-y-2.5">
            <SummaryRow label="Barbearia" value={companyName} />
            <SummaryRow label="Serviço" value={service.name} />
            <SummaryRow label="Profissional" value={selectedProfessionalName} />
            <SummaryRow label="Data" value={formatDateLabel(date)} />
            <SummaryRow label="Horário" value={formatBusinessTime(selectedSlot.slot_start)} />
            <SummaryRow label="Duração" value={formatMinutes(service.planned_duration_minutes)} />
            <SummaryRow label="Preço" value={formatCurrency(service.default_price)} />
            <SummaryRow label="Cliente" value={`${clientName} · ${clientPhone}`} />
          </div>
          <Button type="button" pending={pending} onClick={confirmAppointment} className="w-full">
            Confirmar agendamento
          </Button>
        </div>
      )}

      {step === "done" && created && service && selectedSlot && (
        <div className="space-y-6 text-center animate-rise-in">
          <div>
            <div
              aria-hidden
              className="mx-auto mb-4 size-14 rounded-full bg-signal flex items-center justify-center text-signal-foreground text-section-title"
            >
              ✓
            </div>
            <h2 className="text-page-title text-foreground">Agendamento confirmado</h2>
            <p className="text-body-sm text-muted mt-1">Te esperamos em {companyName}.</p>
          </div>

          <div className="rounded-md border border-border bg-surface p-5 space-y-2.5 text-left">
            <SummaryRow label="Barbearia" value={companyName} />
            <SummaryRow label="Serviço" value={service.name} />
            <SummaryRow label="Profissional" value={selectedProfessionalName} />
            <SummaryRow label="Data" value={formatDateLabel(date)} />
            <SummaryRow label="Horário" value={formatBusinessTime(created.starts_at)} />
            <SummaryRow label="Duração" value={formatMinutes(service.planned_duration_minutes)} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/${slug}/agendamentos/${created.client_access_token}`}
              className={buttonClasses({ variant: "primary", className: "flex-1" })}
            >
              Ver meu agendamento
            </Link>
            <Link href={`/${slug}`} className={buttonClasses({ variant: "secondary", className: "flex-1" })}>
              Voltar para a barbearia
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-body-sm text-muted">{label}</span>
      <span className="text-body-sm text-foreground font-medium text-right">{value}</span>
    </div>
  );
}
