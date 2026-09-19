"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  getPublicProfessionalsMulti,
  getPublicAvailableSlotsMulti,
  createPublicAppointmentMulti,
} from "@/actions/public";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { businessToday, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { PublicService, PublicProfessional, PublicSlot, PublicAppointmentCreatedMulti } from "@/lib/types";

type Step = "service" | "professional" | "date" | "time" | "client" | "review" | "done";

const ANY_PROFESSIONAL = "any" as const;

const STEP_TITLE: Record<Exclude<Step, "done">, string> = {
  service: "O que você quer fazer?",
  professional: "Escolha o profissional",
  date: "Escolha a data",
  time: "Escolha o horário",
  client: "Seus dados",
  review: "Revisão",
};

// Os horários da grade são do relógio da barbearia, não do relógio de quem
// está olhando: um cliente viajando não pode ver a barbearia abrindo às 05:00.
function formatDateLabel(iso: string): string {
  return formatBusinessDayLabel(iso, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

// O motor do banco valida disponibilidade, jornada, bloqueios e duração do
// serviço. No dia de hoje existe uma regra adicional de UX: um horário cujo
// início já passou não deve continuar aparecendo para o cliente. A comparação
// é feita pelo instante real do slot, portanto continua correta mesmo se o
// dispositivo do cliente estiver em outro fuso.
function slotIsPastToday(slot: PublicSlot, targetDate: string): boolean {
  return targetDate === businessToday() && new Date(slot.slot_start).getTime() <= Date.now();
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

  // P1.19: um carrinho de serviços, não um serviço só — o cliente marca
  // Corte, Barba e Sobrancelha juntos se quiser, e o profissional atende
  // tudo em sequência, no mesmo horário reservado.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedServices = useMemo(
    () => services.filter((s) => selectedIds.has(s.service_id)),
    [services, selectedIds]
  );
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.planned_duration_minutes, 0),
    [selectedServices]
  );
  const totalPrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.default_price, 0),
    [selectedServices]
  );

  const [professionals, setProfessionals] = useState<PublicProfessional[]>([]);
  const [professionalChoice, setProfessionalChoice] = useState<string | typeof ANY_PROFESSIONAL | null>(null);

  const [date, setDate] = useState(businessToday());
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [created, setCreated] = useState<PublicAppointmentCreatedMulti | null>(null);

  const selectedProfessionalName = useMemo(() => {
    if (!selectedSlot) return "";
    return selectedSlot.professional_name;
  }, [selectedSlot]);

  // A etapa "profissional" só existe quando há mais de um candidato para o
  // carrinho de serviços escolhido (ver confirmServices) — o indicador de
  // progresso reflete essa mesma decisão em vez de fingir um número fixo de
  // passos. Antes de saber quantos profissionais existem, assume-se o caso
  // mais comum (uma única pessoa realiza os serviços, sem essa etapa).
  const stepsSequence = useMemo<Step[]>(() => {
    const seq: Step[] = ["service"];
    if (professionals.length > 1) seq.push("professional");
    seq.push("date", "time", "client", "review");
    return seq;
  }, [professionals]);
  const stepIndex = stepsSequence.indexOf(step);

  function toggleService(serviceId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  function confirmServices() {
    if (selectedIds.size === 0) {
      setError("Escolha ao menos um serviço.");
      return;
    }
    setError(null);
    setProfessionalChoice(null);
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const result = await getPublicProfessionalsMulti(slug, ids);
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
    if (selectedServices.length === 0) return;
    setDate(targetDate);
    setSlotsLoaded(false);
    setSelectedSlot(null);
    setError(null);
    startTransition(async () => {
      const result = await getPublicAvailableSlotsMulti({
        slug,
        serviceIds: Array.from(selectedIds),
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
    const sorted = slots
      .filter((slot) => !slotIsPastToday(slot, date))
      .sort((a, b) => {
        if (a.slot_start !== b.slot_start) return a.slot_start.localeCompare(b.slot_start);
        return a.professional_id.localeCompare(b.professional_id);
      });
    const byTime = new Map<string, PublicSlot>();
    for (const slot of sorted) {
      if (!byTime.has(slot.slot_start)) byTime.set(slot.slot_start, slot);
    }
    return Array.from(byTime.values());
  }, [slots, date]);

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
    if (selectedServices.length === 0 || !selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await createPublicAppointmentMulti({
        slug,
        serviceIds: Array.from(selectedIds),
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
      {step !== "done" && (
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            {step !== "service" ? (
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
                className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
              >
                ← Voltar
              </button>
            ) : (
              <span />
            )}
            <p className="text-caption text-muted tabular-nums">
              Passo {stepIndex + 1} de {stepsSequence.length}
            </p>
          </div>
          <div aria-hidden className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-normal ease-standard motion-reduce:transition-none"
              style={{ width: `${((stepIndex + 1) / stepsSequence.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-danger-ink mb-4">
          {error}
        </p>
      )}

      {step === "service" && (
        <div className="space-y-4">
          <p className="text-label uppercase text-muted">{STEP_TITLE.service}</p>
          <div className="space-y-2">
            {services.map((s) => {
              const checked = selectedIds.has(s.service_id);
              return (
                <button
                  key={s.service_id}
                  type="button"
                  onClick={() => toggleService(s.service_id)}
                  aria-pressed={checked}
                  className={cn(
                    "w-full text-left material-solid rounded-md p-4 transition-colors duration-fast ease-standard flex items-start gap-3",
                    checked ? "border-primary" : "hover:border-border-strong"
                  )}
                >
                  <Checkbox checked={checked} readOnly className="mt-1 pointer-events-none" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body font-medium text-foreground">{s.name}</p>
                      <p className="text-body-sm text-foreground whitespace-nowrap">
                        {formatCurrency(s.default_price)}
                      </p>
                    </div>
                    <p className="text-caption text-muted mt-1">{formatMinutes(s.planned_duration_minutes)}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedServices.length > 0 && (
            <p className="text-body-sm text-muted">
              {selectedServices.length === 1
                ? selectedServices[0].name
                : `${selectedServices.length} serviços selecionados`}{" "}
              · {formatMinutes(totalDuration)} · {formatCurrency(totalPrice)}
            </p>
          )}
          <Button type="button" onClick={confirmServices} pending={pending} disabled={selectedIds.size === 0} className="w-full">
            Continuar
          </Button>
        </div>
      )}

      {step === "professional" && (
        <div className="space-y-2">
          <p className="text-label uppercase text-muted mb-3">{STEP_TITLE.professional}</p>
          {professionals.length > 1 && (
            <button
              type="button"
              onClick={() => chooseProfessional(ANY_PROFESSIONAL)}
              aria-pressed={professionalChoice === ANY_PROFESSIONAL}
              className={cn(
                "w-full text-left material-solid rounded-md p-4 border transition-colors duration-fast ease-standard",
                professionalChoice === ANY_PROFESSIONAL
                  ? "border-primary bg-primary/5"
                  : "border-border-strong hover:border-primary"
              )}
            >
              <p className="text-body font-medium text-foreground">Qualquer profissional</p>
              <p className="text-caption text-muted mt-0.5">
                Mostramos o primeiro horário disponível entre todos.
              </p>
            </button>
          )}
          {professionals.map((p) => (
            <button
              key={p.professional_id}
              type="button"
              onClick={() => chooseProfessional(p.professional_id)}
              className="w-full flex items-center gap-3 text-left material-solid rounded-md p-4 hover:border-border-strong transition-colors duration-fast ease-standard"
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
          {professionals.length === 0 && (
            <EmptyState
              title="Nenhum profissional realiza todos esses serviços"
              description="Escolha menos serviços de uma vez, ou serviços diferentes."
              action={
                <Button type="button" variant="secondary" onClick={() => setStep("service")}>
                  Voltar para os serviços
                </Button>
              }
            />
          )}
        </div>
      )}

      {step === "date" && (
        <div className="space-y-4">
          <p className="text-label uppercase text-muted">{STEP_TITLE.date}</p>
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
          <p className="text-label uppercase text-muted">{STEP_TITLE.time}</p>
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
              description={date === businessToday() ? "Não há mais horários disponíveis hoje. Escolha outro dia." : "Não há horários livres nesta data. Escolha outro dia."}
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

      {step === "client" && selectedServices.length > 0 && selectedSlot && (
        <div className="space-y-4">
          <p className="text-label uppercase text-muted">{STEP_TITLE.client}</p>
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

      {step === "review" && selectedServices.length > 0 && selectedSlot && (
        <div className="space-y-5">
          <p className="text-label uppercase text-muted">{STEP_TITLE.review}</p>
          <div className="material-solid rounded-md p-5 space-y-2.5">
            <SummaryRow label="Barbearia" value={companyName} />
            <SummaryRow
              label={selectedServices.length === 1 ? "Serviço" : "Serviços"}
              value={selectedServices.map((s) => s.name).join(", ")}
            />
            <SummaryRow label="Profissional" value={selectedProfessionalName} />
            <SummaryRow label="Data" value={formatDateLabel(date)} />
            <SummaryRow label="Horário" value={formatBusinessTime(selectedSlot.slot_start)} />
            <SummaryRow label="Duração total" value={formatMinutes(totalDuration)} />
            <SummaryRow label="Preço total" value={formatCurrency(totalPrice)} />
            <SummaryRow label="Cliente" value={`${clientName} · ${clientPhone}`} />
          </div>
          <Button type="button" pending={pending} onClick={confirmAppointment} className="w-full">
            Confirmar agendamento
          </Button>
        </div>
      )}

      {step === "done" && created && selectedServices.length > 0 && selectedSlot && (
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

          <div className="material-solid rounded-md p-5 space-y-2.5 text-left">
            <SummaryRow label="Barbearia" value={companyName} />
            <SummaryRow
              label={selectedServices.length === 1 ? "Serviço" : "Serviços"}
              value={selectedServices.map((s) => s.name).join(", ")}
            />
            <SummaryRow label="Profissional" value={selectedProfessionalName} />
            <SummaryRow label="Data" value={formatDateLabel(date)} />
            <SummaryRow label="Horário" value={formatBusinessTime(created.starts_at)} />
            <SummaryRow label="Duração total" value={formatMinutes(totalDuration)} />
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