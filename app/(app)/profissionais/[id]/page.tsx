import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateProfessionalRecord, setProfessionalAvatar } from "@/actions/profissionais";
import { toggleProfessionalOnService } from "@/actions/servicos";
import { getProfessionalAccessStatus } from "@/actions/profissional-acesso";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProfessionalAvatar } from "./ProfessionalAvatar";
import ProfessionalAccessSection from "@/components/professional-access-section";
import type { Professional, Service } from "@/lib/types";

export default async function ProfissionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from("professional")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!professional) notFound();

  const companyId = (professional as Professional).company_id;

  const { data: allServices } = await supabase
    .from("service")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  const { data: links } = await supabase
    .from("professional_service")
    .select("service_id")
    .eq("professional_id", id);

  const linkedServiceIds = new Set((links ?? []).map((l) => l.service_id));

  const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00`;
  const todayEnd = `${new Date().toISOString().slice(0, 10)}T23:59:59`;

  const { data: todayLines } = await supabase
    .from("appointment_service")
    .select("id, appointment:appointment_id(status)")
    .eq("professional_id", id)
    .gte("starts_at", todayStart)
    .lte("starts_at", todayEnd);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayRows = (todayLines ?? []) as any[];
  const todayDone = todayRows.filter((r) => r.appointment?.status === "completed").length;
  const todayPending = todayRows.filter((r) =>
    ["scheduled", "confirmed", "arrived"].includes(r.appointment?.status)
  ).length;

  const accessResult = await getProfessionalAccessStatus(id, companyId);
  const initialAccessStatus = accessResult.ok && accessResult.data ? accessResult.data : undefined;

  const updateAction = updateProfessionalRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-page-title text-foreground">{(professional as Professional).name}</h1>
          <Badge tone={professional.active ? "success" : "neutral"}>
            {professional.active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        {(professional as Professional).role_title && (
          <p className="text-body-sm text-muted mb-4">{(professional as Professional).role_title}</p>
        )}

        <div className="mb-6">
          <ProfessionalAvatar
            professionalId={id}
            companyId={companyId}
            currentUrl={(professional as Professional).avatar_url}
            name={(professional as Professional).name}
          />
        </div>

        {todayRows.length > 0 && (
          <div className="grid grid-cols-2 gap-px bg-border rounded-md overflow-hidden mb-6 animate-rise-in">
            <div className="px-4 py-3.5 bg-surface">
              <p className="text-section-title font-heading tabular-nums text-foreground leading-none">
                {todayPending}
              </p>
              <p className="text-label uppercase text-muted mt-1.5">Restantes hoje</p>
            </div>
            <div className="px-4 py-3.5 bg-surface">
              <p className="text-section-title font-heading tabular-nums text-foreground leading-none">
                {todayDone}
              </p>
              <p className="text-label uppercase text-muted mt-1.5">Concluídos hoje</p>
            </div>
          </div>
        )}

        <form action={updateAction} className="space-y-6">
          <div className="rounded-md border border-border bg-surface p-6 space-y-4">
            <p className="text-label uppercase text-muted">Dados do profissional</p>
            <Field name="name" label="Nome" required>
              <Input id="name" name="name" defaultValue={professional.name} required />
            </Field>
            <Field name="role_title" label="Função" helper="Ex.: Barbeiro, Gerente, Recepção">
              <Input id="role_title" name="role_title" defaultValue={professional.role_title ?? ""} />
            </Field>
            <Field name="email" label="E-mail">
              <Input id="email" name="email" type="email" defaultValue={professional.email ?? ""} />
            </Field>
            <Field name="phone" label="Telefone">
              <Input id="phone" name="phone" defaultValue={professional.phone ?? ""} />
            </Field>
          </div>

          <div className="rounded-md border border-border bg-surface p-6 space-y-4">
            <p className="text-label uppercase text-muted">Comissão</p>
            <Field
              name="default_commission_percent"
              label="Comissão padrão"
              helper="Aplicada por padrão a novos serviços — cada serviço pode sobrescrever este valor."
            >
              <Input
                id="default_commission_percent"
                name="default_commission_percent"
                type="number"
                step="0.01"
                defaultValue={professional.default_commission_percent?.toString() ?? ""}
              />
            </Field>
          </div>

          <Button type="submit" className="w-full">
            Salvar alterações
          </Button>
        </form>
      </div>

      <ProfessionalAccessSection
        professionalId={id}
        companyId={companyId}
        professionalName={(professional as Professional).name}
        initialStatus={initialAccessStatus}
      />

      <div className="rounded-md border border-border bg-surface p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-body font-medium text-foreground">Jornada, intervalos, bloqueios e ausências</p>
          <p className="text-body-sm text-muted mt-0.5">
            O que decide quais horários este profissional pode oferecer.
          </p>
        </div>
        <Link href={`/profissionais/${id}/jornada`} className="text-body-sm text-primary hover:underline shrink-0">
          Configurar →
        </Link>
      </div>

      <div>
        <h2 className="text-section-title text-foreground mb-1">Serviços que realiza</h2>
        <p className="text-body-sm text-muted mb-3">
          A mesma associação também pode ser editada na tela de cada serviço.
        </p>
        <Surface>
          {(allServices as Service[] | null)?.length ? (
            (allServices as Service[]).map((s) => {
              const isLinked = linkedServiceIds.has(s.id);
              return (
                <SurfaceRow key={s.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-foreground">{s.name}</span>
                  <form
                    action={async () => {
                      "use server";
                      await toggleProfessionalOnService(s.id, id, !isLinked);
                    }}
                  >
                    <button type="submit">
                      <Badge tone={isLinked ? "success" : "neutral"}>
                        {isLinked ? "Associado" : "Associar"}
                      </Badge>
                    </button>
                  </form>
                </SurfaceRow>
              );
            })
          ) : (
            <EmptyState
              title="Nenhum serviço cadastrado ainda"
              description="Cadastre serviços para poder associá-los a este profissional."
            />
          )}
        </Surface>
      </div>
    </div>
  );
}
