"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCompanyStep,
  createUnitStep,
  createProfessionalStep,
  createServiceStep,
  linkProfessionalToService,
  completeOnboarding,
} from "@/actions/onboarding";
import { createProductRecord } from "@/actions/produtos";
import { createConsumableRecord } from "@/actions/materiais";
import { setPaymentMethodActive, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_KEYS } from "@/actions/pagamentos";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { PaymentMethodKey } from "@/lib/types";

type WorkMode = "solo" | "team";
type StepKey =
  | "empresa"
  | "unidade"
  | "equipe"
  | "servicos"
  | "produtos"
  | "pagamento"
  | "revisao"
  | "conclusao";

type StepMeta = { key: StepKey; number: string; label: string; kicker: string };

const STEPS: StepMeta[] = [
  { key: "empresa", number: "01", label: "Sua barbearia", kicker: "Como ela vai aparecer no sistema." },
  { key: "unidade", number: "02", label: "Sua unidade", kicker: "Onde o atendimento acontece." },
  { key: "equipe", number: "03", label: "Sua equipe", kicker: "Quem faz o trabalho acontecer." },
  { key: "servicos", number: "04", label: "Seus serviços", kicker: "O que você oferece." },
  { key: "produtos", number: "05", label: "Seus produtos", kicker: "O que você vende e o que consome." },
  { key: "pagamento", number: "06", label: "Como você recebe", kicker: "Formas de pagamento aceitas." },
  { key: "revisao", number: "07", label: "Revisão", kicker: "Confirme antes de entrar." },
  { key: "conclusao", number: "08", label: "Pronto", kicker: "Sua operação, montada." },
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("empresa");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [consumables, setConsumables] = useState<{ id: string; name: string }[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Set<PaymentMethodKey>>(new Set());

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  async function handleCompanySubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await createCompanyStep({
      name: String(formData.get("name") || ""),
      trade_name: String(formData.get("trade_name") || "") || undefined,
      document: String(formData.get("document") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      whatsapp: String(formData.get("whatsapp") || "") || undefined,
      email: String(formData.get("email") || "") || undefined,
      address: String(formData.get("address") || "") || undefined,
      postal_code: String(formData.get("postal_code") || "") || undefined,
      city: String(formData.get("city") || "") || undefined,
      state: String(formData.get("state") || "") || undefined,
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
      phone: String(formData.get("phone") || "") || undefined,
      business_hours_note: String(formData.get("business_hours_note") || "") || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setUnitId(result.data.id);
    setUnitName(String(formData.get("name") || ""));
    setStep("equipe");
  }

  async function handleAddProfessional(formData: FormData) {
    if (!companyId || !unitId) return;
    setError(null);
    setPending(true);
    const result = await createProfessionalStep({
      company_id: companyId,
      unit_id: unitId,
      name: String(formData.get("name") || ""),
      role_title: String(formData.get("role_title") || "") || undefined,
      email: String(formData.get("email") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      default_commission_percent:
        Number(formData.get("default_commission_percent")) || undefined,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    const added = { id: result.data.id, name: String(formData.get("name") || "") };
    setProfessionals((prev) => [...prev, added]);
    if (workMode === "solo") setStep("servicos");
  }

  async function handleServiceSubmit(formData: FormData) {
    if (!companyId) return;
    setError(null);
    setPending(true);
    const result = await createServiceStep({
      company_id: companyId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || undefined,
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
    // Toda a equipe cadastrada até aqui já sai habilitada a realizar o
    // serviço — ajuste fino de quem realiza o quê fica para a tela de
    // Serviços depois do onboarding, não é decisão para a etapa de setup.
    await Promise.all(
      professionals.map((p) => linkProfessionalToService(companyId, p.id, result.data.id))
    );
    setPending(false);
    setServices((prev) => [
      ...prev,
      { id: result.data.id, name: String(formData.get("name") || "") },
    ]);
  }

  async function handleProductSubmit(formData: FormData) {
    if (!companyId || !unitId) return;
    setError(null);
    setPending(true);
    formData.set("company_id", companyId);
    formData.set("unit_id", unitId);
    const result = await createProductRecord(formData);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setProducts((prev) => [...prev, { id: result.data.id, name: String(formData.get("name") || "") }]);
  }

  async function handleConsumableSubmit(formData: FormData) {
    if (!companyId || !unitId) return;
    setError(null);
    setPending(true);
    formData.set("company_id", companyId);
    formData.set("unit_id", unitId);
    const result = await createConsumableRecord(formData);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setConsumables((prev) => [...prev, { id: result.data.id, name: String(formData.get("name") || "") }]);
  }

  async function handleTogglePaymentMethod(method: PaymentMethodKey) {
    if (!companyId) return;
    const willBeActive = !paymentMethods.has(method);
    const result = await setPaymentMethodActive(companyId, method, willBeActive);
    if (!result.ok) return setError(result.error);
    setPaymentMethods((prev) => {
      const next = new Set(prev);
      if (willBeActive) next.add(method);
      else next.delete(method);
      return next;
    });
  }

  async function handleComplete() {
    if (!companyId) return;
    setPending(true);
    await completeOnboarding(companyId);
    setPending(false);
    setStep("conclusao");
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

        <ContextTrail
          companyName={companyName}
          unitName={unitName}
          professionalNames={professionals.map((p) => p.name)}
        />
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
              title="Sua barbearia"
              description="Vamos começar pelo essencial — isso aparece para você e, no futuro, para seus clientes."
              onSubmit={handleCompanySubmit}
              pending={pending}
              error={error}
            >
              <Field name="name" label="Nome da barbearia" required>
                <Input id="name" name="name" required autoFocus />
              </Field>
              <Field name="trade_name" label="Nome comercial">
                <Input id="trade_name" name="trade_name" />
              </Field>
              <Field name="document" label="CNPJ/CPF">
                <Input id="document" name="document" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field name="phone" label="Telefone">
                  <Input id="phone" name="phone" />
                </Field>
                <Field name="whatsapp" label="WhatsApp">
                  <Input id="whatsapp" name="whatsapp" />
                </Field>
              </div>
              <Field name="email" label="E-mail">
                <Input id="email" name="email" type="email" />
              </Field>
              <Field name="address" label="Endereço">
                <Input id="address" name="address" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field name="postal_code" label="CEP">
                  <Input id="postal_code" name="postal_code" />
                </Field>
                <Field name="city" label="Cidade">
                  <Input id="city" name="city" />
                </Field>
                <Field name="state" label="Estado">
                  <Input id="state" name="state" maxLength={2} />
                </Field>
              </div>
            </StepCard>
          )}

          {step === "unidade" && (
            <StepCard
              title="Sua unidade"
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
              <Field name="phone" label="Telefone">
                <Input id="phone" name="phone" />
              </Field>
              <Field
                name="business_hours_note"
                label="Funcionamento"
                helper="Ex.: Seg a Sáb, 9h às 19h. Ajustável depois."
              >
                <Textarea id="business_hours_note" name="business_hours_note" rows={2} />
              </Field>
            </StepCard>
          )}

          {step === "equipe" && (
            <div className="space-y-5 animate-rise-in">
              {!workMode ? (
                <>
                  <div>
                    <h2 className="text-page-title text-foreground">Como você trabalha?</h2>
                    <p className="text-body-sm text-muted mt-1">
                      Isso ajusta como montamos sua equipe a seguir.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <ModeOption
                      title="Sozinho"
                      description="Você atende e também administra."
                      onClick={() => setWorkMode("solo")}
                    />
                    <ModeOption
                      title="Com equipe"
                      description="Você e outros profissionais atendem."
                      onClick={() => setWorkMode("team")}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-page-title text-foreground">
                      {workMode === "solo" ? "Você, como profissional" : "Sua equipe"}
                    </h2>
                    <p className="text-body-sm text-muted mt-1">
                      {workMode === "solo"
                        ? "Cadastre seus próprios dados de atendimento."
                        : "Quem realiza os atendimentos."}
                    </p>
                  </div>

                  {professionals.length > 0 && workMode === "team" && (
                    <ul className="rounded-md border border-border bg-surface divide-y divide-border">
                      {professionals.map((p) => (
                        <li key={p.id} className="px-4 py-2.5 text-body-sm text-foreground animate-rise-in">
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}

                  <form
                    action={handleAddProfessional}
                    className="space-y-4"
                    key={pending ? "pending" : professionals.length}
                  >
                    <Field name="name" label="Nome" required>
                      <Input id="name" name="name" required autoFocus />
                    </Field>
                    <Field name="role_title" label="Função" helper="Ex.: Barbeiro, Gerente, Recepção">
                      <Input id="role_title" name="role_title" />
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
                    {error && <p className="text-body-sm text-danger">{error}</p>}
                    <Button type="submit" pending={pending} className="w-full">
                      {pending ? "Salvando…" : workMode === "solo" ? "Continuar" : "Adicionar profissional"}
                    </Button>
                  </form>

                  {workMode === "team" && (
                    <Button
                      type="button"
                      disabled={professionals.length === 0}
                      onClick={() => setStep("servicos")}
                      className="w-full"
                    >
                      Continuar para serviços
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {step === "servicos" && (
            <div className="space-y-5 animate-rise-in">
              <div>
                <h2 className="text-page-title text-foreground">Seus serviços</h2>
                <p className="text-body-sm text-muted mt-1">O que sua barbearia oferece.</p>
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
                onClick={() => setStep("produtos")}
                className="w-full"
              >
                Continuar para produtos
              </Button>
              {services.length === 0 && (
                <button
                  type="button"
                  onClick={() => setStep("produtos")}
                  className="w-full text-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
                >
                  Cadastrar serviços depois
                </button>
              )}
            </div>
          )}

          {step === "produtos" && (
            <div className="space-y-8 animate-rise-in">
              <div>
                <h2 className="text-page-title text-foreground">Seus produtos</h2>
                <p className="text-body-sm text-muted mt-1">
                  Opcional agora — dá para cadastrar aos poucos depois.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-label uppercase text-muted">Produtos de venda</p>
                {products.length > 0 && (
                  <ul className="rounded-md border border-border bg-surface divide-y divide-border">
                    {products.map((p) => (
                      <li key={p.id} className="px-4 py-2.5 text-body-sm text-foreground">
                        {p.name}
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  action={handleProductSubmit}
                  className="space-y-3"
                  key={`product-${pending ? "pending" : products.length}`}
                >
                  <Field name="product_name" label="Nome" required>
                    <Input id="product_name" name="name" placeholder="Ex.: Pomada modeladora" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="product_sale_price" label="Preço de venda (R$)">
                      <Input id="product_sale_price" name="sale_price" type="number" step="0.01" />
                    </Field>
                    <Field name="product_stock" label="Estoque inicial">
                      <Input id="product_stock" name="current_stock" type="number" step="1" />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" size="sm" className="w-full">
                    Adicionar produto
                  </Button>
                </form>
              </div>

              <div className="space-y-4">
                <p className="text-label uppercase text-muted">Materiais de consumo</p>
                <p className="text-caption text-muted -mt-2">
                  Usados na operação, não vendidos ao cliente — lâmina, shampoo utilizado, luvas.
                </p>
                {consumables.length > 0 && (
                  <ul className="rounded-md border border-border bg-surface divide-y divide-border">
                    {consumables.map((c) => (
                      <li key={c.id} className="px-4 py-2.5 text-body-sm text-foreground">
                        {c.name}
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  action={handleConsumableSubmit}
                  className="space-y-3"
                  key={`consumable-${pending ? "pending" : consumables.length}`}
                >
                  <Field name="consumable_name" label="Nome" required>
                    <Input id="consumable_name" name="name" placeholder="Ex.: Lâmina descartável" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field name="consumable_uom" label="Unidade">
                      <Input id="consumable_uom" name="unit_of_measure" defaultValue="un" />
                    </Field>
                    <Field name="consumable_stock" label="Estoque inicial">
                      <Input id="consumable_stock" name="current_stock" type="number" step="1" />
                    </Field>
                  </div>
                  <Button type="submit" variant="secondary" size="sm" className="w-full">
                    Adicionar material
                  </Button>
                </form>
              </div>

              {error && <p className="text-body-sm text-danger">{error}</p>}

              <Button type="button" onClick={() => setStep("pagamento")} className="w-full">
                Continuar
              </Button>
            </div>
          )}

          {step === "pagamento" && (
            <div className="space-y-5 animate-rise-in">
              <div>
                <h2 className="text-page-title text-foreground">Como você recebe</h2>
                <p className="text-body-sm text-muted mt-1">
                  Formas de pagamento que sua barbearia aceita.
                </p>
              </div>

              <div className="rounded-md border border-border bg-surface divide-y divide-border">
                {PAYMENT_METHOD_KEYS.map((method) => (
                  <label
                    key={method}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer"
                  >
                    <span className="text-body-sm text-foreground">{PAYMENT_METHOD_LABEL[method]}</span>
                    <Checkbox
                      checked={paymentMethods.has(method)}
                      onChange={() => handleTogglePaymentMethod(method)}
                    />
                  </label>
                ))}
              </div>

              {error && <p className="text-body-sm text-danger">{error}</p>}

              <Button type="button" onClick={() => setStep("revisao")} className="w-full">
                Continuar
              </Button>
            </div>
          )}

          {step === "revisao" && (
            <ReviewStep
              companyName={companyName}
              unitName={unitName}
              professionalCount={professionals.length}
              serviceCount={services.length}
              productCount={products.length}
              consumableCount={consumables.length}
              paymentMethods={[...paymentMethods]}
              pending={pending}
              onConfirm={handleComplete}
            />
          )}

          {step === "conclusao" && (
            <CompletionStep companyName={companyName} onEnter={handleEnterSystem} />
          )}
        </div>
      </div>
    </main>
  );
}

function ModeOption({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md border border-border-strong px-4 py-3.5",
        "transition-colors duration-fast ease-standard hover:bg-surface-muted"
      )}
    >
      <p className="text-body font-medium text-foreground">{title}</p>
      <p className="text-body-sm text-muted mt-0.5">{description}</p>
    </button>
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
  professionalNames,
}: {
  companyName: string;
  unitName: string;
  professionalNames: string[];
}) {
  const chips = [companyName, unitName, ...professionalNames].filter(Boolean);
  if (chips.length === 0) return null;

  return (
    <div className="hidden lg:block mt-10 pt-6 border-t border-border">
      <p className="text-label uppercase text-muted mb-2">Construindo</p>
      <div className="space-y-1.5">
        {chips.map((c, i) => (
          <p key={`${c}-${i}`} className="text-body-sm text-foreground animate-rise-in">
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

function ReviewStep({
  companyName,
  unitName,
  professionalCount,
  serviceCount,
  productCount,
  consumableCount,
  paymentMethods,
  pending,
  onConfirm,
}: {
  companyName: string;
  unitName: string;
  professionalCount: number;
  serviceCount: number;
  productCount: number;
  consumableCount: number;
  paymentMethods: PaymentMethodKey[];
  pending: boolean;
  onConfirm: () => void;
}) {
  const rows = [
    { label: "Barbearia", value: companyName },
    { label: "Unidade", value: unitName },
    { label: "Equipe", value: `${professionalCount} profissional${professionalCount === 1 ? "" : "is"}` },
    { label: "Serviços", value: `${serviceCount} cadastrado${serviceCount === 1 ? "" : "s"}` },
    { label: "Produtos", value: productCount > 0 ? `${productCount} cadastrado${productCount === 1 ? "" : "s"}` : "Nenhum ainda" },
    { label: "Materiais", value: consumableCount > 0 ? `${consumableCount} cadastrado${consumableCount === 1 ? "" : "s"}` : "Nenhum ainda" },
    {
      label: "Pagamento",
      value:
        paymentMethods.length > 0
          ? paymentMethods.map((m) => PAYMENT_METHOD_LABEL[m]).join(", ")
          : "Nenhuma forma selecionada",
    },
  ];

  return (
    <div className="space-y-6 animate-rise-in">
      <div>
        <h2 className="text-page-title text-foreground">Revisão</h2>
        <p className="text-body-sm text-muted mt-1">
          Tudo isso pode ser ajustado depois em Configurações, Profissionais, Serviços e Produtos.
        </p>
      </div>

      <dl className="rounded-md border border-border bg-surface divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-3.5 flex items-center justify-between gap-4">
            <dt className="text-label uppercase text-muted shrink-0">{row.label}</dt>
            <dd className="text-body-sm text-foreground font-medium text-right">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>

      <Button onClick={onConfirm} pending={pending} className="w-full">
        {pending ? "Concluindo…" : "Concluir configuração"}
      </Button>
    </div>
  );
}

function CompletionStep({ companyName, onEnter }: { companyName: string; onEnter: () => void }) {
  return (
    <div className="space-y-8 animate-rise-in">
      <div>
        <p className="text-label text-signal-foreground bg-signal inline-block px-2 py-0.5 rounded-sm mb-3">
          Tudo pronto
        </p>
        <h2 className="text-display text-foreground">
          {companyName}
          <br />
          está pronta.
        </h2>
      </div>

      <Button onClick={onEnter} className="w-full">
        Entrar no sistema
      </Button>
    </div>
  );
}
