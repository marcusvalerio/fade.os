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

type StepKey = "empresa" | "unidade" | "profissional" | "servicos" | "revisao";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("empresa");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState("");
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

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
    setUnitId(result.data.id);
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
    // No primeiro serviço do onboarding, o profissional cadastrado já
    // é associado automaticamente — associar outros profissionais fica
    // para a tela de Serviços depois do onboarding.
    await linkProfessionalToService(professionalId, result.data.id);
    setPending(false);
    setServices((prev) => [
      ...prev,
      { id: result.data.id, name: String(formData.get("name") || "") },
    ]);
  }

  return (
    <main className="min-h-screen bg-[var(--color-dusty-cotton)] flex justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Steps current={step} />

        <div className="bg-white rounded-xl shadow-sm p-8 mt-6">
          {step === "empresa" && (
            <FormStep
              title="Sua empresa"
              onSubmit={handleCompanySubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome da empresa" required />
              <Field name="trade_name" label="Nome comercial" />
              <Field name="document" label="CNPJ/CPF" />
              <Field name="phone" label="Telefone" />
              <Field name="email" label="E-mail" type="email" />
              <Field name="address" label="Endereço" />
            </FormStep>
          )}

          {step === "unidade" && (
            <FormStep
              title="Primeira unidade"
              onSubmit={handleUnitSubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome da unidade" required />
              <Field name="address" label="Endereço" />
            </FormStep>
          )}

          {step === "profissional" && (
            <FormStep
              title="Primeiro profissional"
              onSubmit={handleProfessionalSubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome" required />
              <Field name="email" label="E-mail" type="email" />
              <Field name="phone" label="Telefone" />
              <Field
                name="default_commission_percent"
                label="Comissão padrão (%)"
                type="number"
              />
            </FormStep>
          )}

          {step === "servicos" && (
            <div>
              <h2 className="text-lg mb-4">Serviços</h2>
              {services.length > 0 && (
                <ul className="mb-4 text-sm text-[var(--color-midnight-smoke)]">
                  {services.map((s) => (
                    <li key={s.id}>• {s.name}</li>
                  ))}
                </ul>
              )}
              <FormStep
                title=""
                onSubmit={handleServiceSubmit}
                pending={pending}
                error={error}
                submitLabel="Adicionar serviço"
              >
                <Field name="name" label="Nome do serviço" required />
                <Field name="category" label="Categoria" />
                <Field
                  name="default_price"
                  label="Preço (R$)"
                  type="number"
                  required
                />
                <Field
                  name="planned_duration_minutes"
                  label="Duração planejada (minutos)"
                  type="number"
                  required
                />
                <Field
                  name="default_commission_percent"
                  label="Comissão padrão (%)"
                  type="number"
                />
              </FormStep>
              <button
                type="button"
                disabled={services.length === 0}
                onClick={() => setStep("revisao")}
                className="mt-4 w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm disabled:opacity-40"
              >
                Concluir cadastro de serviços
              </button>
            </div>
          )}

          {step === "revisao" && (
            <div>
              <h2 className="text-lg mb-4">Revisão</h2>
              <dl className="space-y-3 text-sm mb-6">
                <Row label="Empresa" value={companyName} />
                <Row label="Unidade" value={unitName} />
                <Row label="Profissional" value={professionalName} />
                <Row
                  label="Serviços"
                  value={services.map((s) => s.name).join(", ")}
                />
              </dl>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full bg-[var(--color-red-gravy)] text-white rounded-md py-2 text-sm font-medium"
              >
                Entrar no sistema
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Steps({ current }: { current: StepKey }) {
  const items: { key: StepKey; label: string }[] = [
    { key: "empresa", label: "Empresa" },
    { key: "unidade", label: "Unidade" },
    { key: "profissional", label: "Equipe" },
    { key: "servicos", label: "Serviços" },
    { key: "revisao", label: "Revisão" },
  ];
  const currentIndex = items.findIndex((i) => i.key === current);
  return (
    <ol className="flex text-xs gap-2">
      {items.map((item, i) => (
        <li
          key={item.key}
          className={`flex-1 text-center pb-2 border-b-2 ${
            i <= currentIndex
              ? "border-[var(--color-red-gravy)] text-[var(--color-cobblestone)]"
              : "border-[var(--color-midnight-smoke)]/20 text-[var(--color-midnight-smoke)]/50"
          }`}
        >
          {item.label}
        </li>
      ))}
    </ol>
  );
}

function FormStep({
  title,
  onSubmit,
  pending,
  error,
  children,
  submitLabel = "Continuar",
}: {
  title: string;
  onSubmit: (formData: FormData) => void;
  pending: boolean;
  error: string | null;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  return (
    <form
      action={onSubmit}
      className="space-y-4"
      key={pending ? "pending" : "idle"}
    >
      {title && <h2 className="text-lg mb-2">{title}</h2>}
      {children}
      {error && <p className="text-sm text-[var(--color-otan-red)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm disabled:opacity-60"
      >
        {pending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-red-gravy)]"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--color-midnight-smoke)]/10 pb-2">
      <dt className="text-[var(--color-midnight-smoke)]">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
