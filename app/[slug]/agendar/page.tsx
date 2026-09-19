import Link from "next/link";
import { getPublicCompany, getPublicServices } from "@/actions/public";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingWizard } from "./BookingWizard";
import { OnboardingGate } from "./OnboardingGate";

export const revalidate = 0;

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [companyResult, servicesResult] = await Promise.all([
    getPublicCompany(slug),
    getPublicServices(slug),
  ]);

  const company = companyResult.ok ? companyResult.data : null;

  if (!company) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="Barbearia não encontrada"
          description="Verifique o endereço ou volte para a página inicial do CORTEX.OS."
          action={
            <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
              Ir para o CORTEX.OS
            </Link>
          }
        />
      </div>
    );
  }

  const services = servicesResult.ok ? servicesResult.data : [];

  if (services.length === 0) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="Agendamento indisponível"
          description={`${company.name} ainda não configurou serviços para agendamento online.`}
          action={
            <Link href={`/${slug}`} className={buttonClasses({ variant: "secondary" })}>
              Voltar para a barbearia
            </Link>
          }
        />
      </div>
    );
  }

  const paginasOnboarding = company.public_onboarding_enabled
    ? [
        {
          titulo: company.public_intro_title ?? "",
          texto: company.public_intro_text ?? "",
          imagemUrl: company.public_intro_image_url,
          focalX: company.public_intro_image_focal_x,
          focalY: company.public_intro_image_focal_y,
        },
        {
          titulo: company.public_highlights_title ?? "",
          texto: company.public_highlights_text ?? "",
          imagemUrl: company.public_highlights_image_url,
          focalX: company.public_highlights_image_focal_x,
          focalY: company.public_highlights_image_focal_y,
        },
      ]
    : [];

  return (
    <OnboardingGate paginas={paginasOnboarding}>
      {/*
        P0 (revisão visual) — `.shell` já define seu próprio `max-width`
        (var(--shell-max-width), pensado para telas de app/dashboard) e
        vencia a utilidade Tailwind `max-w-xl` por ordem de cascata: o
        fluxo, de uma coluna só, renderizava quase full-bleed em desktop.
        `.container-narrow` (globals.css, sistema R22, já existente mas
        ainda sem uso) resolve isso com sua própria regra de max-width —
        sem competir com `.shell` e sem alterá-lo globalmente.
      */}
      <div className="container-narrow py-8 sm:py-12">
        <p className="text-body-sm text-muted mb-1">{company.name}</p>
        <h1 className="text-page-title text-foreground mb-6">Agendar horário</h1>
        <BookingWizard slug={slug} companyName={company.name} services={services} />
      </div>
    </OnboardingGate>
  );
}
