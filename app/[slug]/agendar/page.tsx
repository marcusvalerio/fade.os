import Link from "next/link";
import { getPublicCompany, getPublicServices } from "@/actions/public";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingWizard } from "./BookingWizard";

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

  return (
    <div className="shell max-w-xl py-8 sm:py-12">
      <p className="text-body-sm text-muted mb-1">{company.name}</p>
      <h1 className="text-page-title text-foreground mb-6">Agendar horário</h1>
      <BookingWizard slug={slug} companyName={company.name} services={services} />
    </div>
  );
}
