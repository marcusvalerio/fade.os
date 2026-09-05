"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCompanyStep,
  createUnitStep,
  createProfessionalStep,
  createServiceStep,
  linkProfessionalToService,
} from "@/actions/onboarding";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type StepKey = "empresa" | "unidade" | "profissional" | "servicos" | "conclusao";

type StepMeta = { key: StepKey; number: string; label: string; kicker: string };

const STEPS: StepMeta[] = [
  { key: "empresa", number: "01", label: "Empresa", kicker: "Como sua empresa vai aparecer no sistema." },
  { key: "unidade", number: "02", label: "Unidade", kicker: "Onde o atendimento acontece." },
  { key: "profissional", number: "03", label: "Equipe", kicker: "Quem faz o trabalho acontecer." },
  { key: "servicos", number: "04", label: "Serviços", kicker: "O que sua empresa oferece." },
  { key: "conclusao", number: "05", label: "Pronto", kicker: "Sua operação, montada." },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("empresa");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  async function handleCompanySubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await createCompanyStep({
      name: String(formData.get("name") || ""),
      trade_name: String(formData.get("trade_name") || "") || undefined,
      document: String(formData.get("document") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      email: String(formData.get("email") || "") || undefined,
      address: String(formData.get("address") || "") || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setCompanyId(result.data.id);
    setCompanyName(String(formData.get("name") || ""));
    setStep("unidade");
  }

  async function handleUnitSubmit(formData: FormData) {
    if (!companyId) return;
    setError(null);
    setPending(true);
    const result = await createUnitStep({
      company_id: companyId,
      name: String(formData.get("name") || ""),
      address: String(formData.get("address") || "") || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setUnitName(String(formData.get("name") || ""));
    setStep("profissional");
  }

  async function handleProfessionalSubmit(formData: FormData) {
    if (!companyId) return;
    setError(null);
    setPending(true);
    const result = await createProfessionalStep({
      company_id: companyId,
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      default_commission_percent:
        Number(formData.get("default_commission_percent")) || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setProfessionalId(result.data.id);
    setProfessionalName(String(formData.get("name") || ""));
    setStep("servicos");
  }

  async function handleServiceSubmit(formData: FormData) {
    if (!companyId || !professionalId) return;
    setError(null);
    setPending(true);
    const result = await createServiceStep({
      company_id: companyId,
      name: String(formData.get("name") || ""),
      category: String(formData.get("category") || "") || undefined,
      default_price: Number(formData.get("default_price")),
      planned_duration_minutes: Number(formData.get("planned_duration_minutes")),
      default_commission_percent:
        Number(formData.get("default_commission_percent")) || undefined,
    });
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    // No primeiro serviço do onboarding, o profissional cadastrado já é
    // associado automaticamente — associar outros profissionais fica para
    // a tela de Serviços depois do onboarding.
    await linkProfessionalToService(companyId, professionalId, result.data.id);
    setPending(false);
    setServices((prev) => [
      ...prev,
      { id: result.data.id, name: String(formData.get("name") || "") },
    ]);
  }

  function handleEnterSystem() {
    setLeaving(true);
    setTimeout(() => router.push("/"), 200);
  }

  return (
    <main className="min-h-screen bg-background flex flex-col lg:flex-row">
      <aside className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border px-6 py-8 lg:py-12 lg:px-10">
        <p className="font-logo font-[777] text-2xl tracking-tight text-foreground">FADE OS</p>

        <nav className="mt-10 space-y-6 hidden lg:block" aria-label="Etapas do cadastro">
          {STEPS.map((s, i) => (
            <StepRailItem
              key={s.key}
              step={s}
              state={i < stepIndex ? "done" : i === stepIndex ? "current" : "upcoming"}
            />
          ))}
        </nav>

        <div className="lg:hidden mt-6">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-normal ease-standard",
                  i <= stepIndex ? "bg-primary" : "bg-surface-muted"
                )}
              />
            ))}
          </div>
          <p className="mt-3 text-body-sm text-muted">{STEPS[stepIndex].kicker}</p>
        </div>

        <ContextTrail companyName={companyName} unitName={unitName} professionalName={professionalName} />
      </aside>

      <div
        className={cn(
          "flex-1 flex justify-center px-6 py-10 lg:py-16 transition-opacity duration-slow ease-standard",
          leaving && "opacity-0"
        )}
      >
        <div className="w-full max-w-md self-start lg:self-center" key={step}>
          {step === "empresa" && (
            <StepCard
              title="Sua empresa"
              description="Vamos começar pelo essencial."
              onSubmit={handleCompanySubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome da empresa" required>
                <Input id="name" name="name" required autoFocus />
              </Field>
              <Field name="trade_name" label="Nome comercial">
                <Input id="trade_name" name="trade_name" />
              </Field>
              <Field name="document" label="CNPJ/CPF">
                <Input id="document" name="document" />
              </Field>
              <Field name="phone" label="Telefone">
                <Input id="phone" name="phone" />
              </Field>
              <Field name="email" label="E-mail">
                <Input id="email" name="email" type="email" />
              </Field>
              <Field name="address" label="Endereço">
                <Input id="address" name="address" />
              </Field>
            </StepCard>
          )}

          {step === "unidade" && (
            <StepCard
              title="Primeira unidade"
              description={`Onde ${companyName} atende.`}
              onSubmit={handleUnitSubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome da unidade" required>
                <Input id="name" name="name" required autoFocus />
              </Field>
              <Field name="address" label="Endereço">
                <Input id="address" name="address" />
              </Field>
            </StepCard>
          )}

          {step === "profissional" && (
            <StepCard
              title="Primeiro profissional"
              description="Pode ser você mesmo, por enquanto."
              onSubmit={handleProfessionalSubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome" required>
                <Input id="name" name="name" required autoFocus />
              </Field>
              <Field name="email" label="E-mail">
                <Input id="email" name="email" type="email" />
              </Field>
              <Field name="phone" label="Telefone">
                <Input id="phone" name="phone" />
              </Field>
              <Field name="default_commission_percent" label="Comissão padrão (%)">
                <Input id="default_commission_percent" name="default_commission_percent" type="number" step="0.01" />
              </Field>
            </StepCard>
          )}

          {step === "servicos" && (
            <div className="space-y-5 animate-rise-in">
              <div>
                <h2 className="text-page-title text-foreground">Serviços</h2>
                <p className="text-body-sm text-muted mt-1">
                  O que {professionalName || "sua equipe"} vai realizar.
                </p>
              </div>

              {services.length > 0 && (
                <ul className="rounded-md border border-border bg-surface divide-y divide-border">
                  {services.map((s) => (
                    <li key={s.id} className="px-4 py-2.5 text-body-sm text-foreground animate-rise-in">
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={handleServiceSubmit}
                className="space-y-4"
                key={pending ? "pending" : services.length}
              >
                <Field name="name" label="Nome do serviço" required>
                  <Input id="name" name="name" required />
                </Field>
                <Field name="category" label="Categoria">
                  <Input id="category" name="category" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="default_price" label="Preço (R$)" required>
                    <Input id="default_price" name="default_price" type="number" step="0.01" required />
                  </Field>
                  <Field name="planned_duration_minutes" label="Duração (min)" required>
                    <Input id="planned_duration_minutes" name="planned_duration_minutes" type="number" required />
                  </Field>
                </div>
                <Field name="default_commission_percent" label="Comissão padrão (%)">
                  <Input id="default_commission_percent" name="default_commission_percent" type="number" step="0.01" />
                </Field>
                {error && <p className="text-body-sm text-danger">{error}</p>}
                <Button type="submit" variant="secondary" pending={pending} className="w-full">
                  {pending ? "Adicionando…" : "Adicionar serviço"}
                </Button>
              </form>

              <Button
                type="button"
                disabled={services.length === 0}
                onClick={() => setStep("conclusao")}
                className="w-full"
              >
                Concluir cadastro de serviços
              </Button>
            </div>
          )}

          {step === "conclusao" && (
            <CompletionStep
              companyName={companyName}
              unitName={unitName}
              professionalName={professionalName}
              services={services}
              onEnter={handleEnterSystem}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function StepRailItem({
  step,
  state,
}: {
  step: StepMeta;
  state: "done" | "current" | "upcoming";
}) {
  return (
    <div className={cn("flex gap-3 transition-opacity duration-normal", state === "upcoming" && "opacity-45")}>
      <span
        className={cn(
          "size-6 shrink-0 rounded-full flex items-center justify-center text-body-sm font-heading tabular-nums",
          state === "current" && "bg-signal text-signal-foreground",
          state === "done" && "bg-surface-muted text-foreground",
          state === "upcoming" && "text-muted"
        )}
      >
        {state === "done" ? "✓" : step.number}
      </span>
      <div>
        <p className={cn("text-body-sm font-medium", state === "upcoming" ? "text-muted" : "text-foreground")}>
          {step.label}
        </p>
        {state === "current" && <p className="text-caption text-muted mt-0.5 max-w-[14rem]">{step.kicker}</p>}
      </div>
    </div>
  );
}

function ContextTrail({
  companyName,
  unitName,
  professionalName,
}: {
  companyName: string;
  unitName: string;
  professionalName: string;
}) {
  const chips = [companyName, unitName, professionalName].filter(Boolean);
  if (chips.length === 0) return null;

  return (
    <div className="hidden lg:block mt-10 pt-6 border-t border-border">
      <p className="text-label uppercase text-muted mb-2">Construindo</p>
      <div className="space-y-1.5">
        {chips.map((c) => (
          <p key={c} className="text-body-sm text-foreground animate-rise-in">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}

function StepCard({
  title,
  description,
  onSubmit,
  pending,
  error,
  children,
}: {
  title: string;
  description?: string;
  onSubmit: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <form action={onSubmit} className="space-y-5 animate-rise-in">
      <div>
        <h2 className="text-page-title text-foreground">{title}</h2>
        {description && <p className="text-body-sm text-muted mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      {error && <p className="text-body-sm text-danger">{error}</p>}
      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Salvando…" : "Continuar"}
      </Button>
    </form>
  );
}

function CompletionStep({
  companyName,
  unitName,
  professionalName,
  services,
  onEnter,
}: {
  companyName: string;
  unitName: string;
  professionalName: string;
  services: { id: string; name: string }[];
  onEnter: () => void;
}) {
  const manifest = [
    { label: "Empresa", value: companyName },
    { label: "Unidade", value: unitName },
    { label: "Equipe", value: professionalName },
    { label: "Serviços", value: `${services.length} cadastrado${services.length === 1 ? "" : "s"}` },
  ];

  return (
    <div className="space-y-8 animate-rise-in">
      <div>
        <p className="text-label text-signal-foreground bg-signal inline-block px-2 py-0.5 rounded-sm mb-3">
          Tudo pronto
        </p>
        <h2 className="text-display text-foreground">{companyName}<br />está no ar.</h2>
      </div>

      <dl className="rounded-md border border-border bg-surface divide-y divide-border">
        {manifest.map((row, i) => (
          <div
            key={row.label}
            className="px-4 py-3.5 flex items-center justify-between animate-rise-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <dt className="text-label uppercase text-muted">{row.label}</dt>
            <dd className="text-body text-foreground font-medium">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>

      <Button onClick={onEnter} className="w-full">
        Entrar no sistema
      </Button>
    </div>
  );
}
