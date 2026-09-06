import Link from "next/link";
import { getPublicCompany, getPublicServices, getPublicTeam } from "@/actions/public";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMinutes } from "@/lib/format";

export const revalidate = 0;

export default async function PublicBarbershopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [companyResult, servicesResult, teamResult] = await Promise.all([
    getPublicCompany(slug),
    getPublicServices(slug),
    getPublicTeam(slug),
  ]);

  const company = companyResult.ok ? companyResult.data : null;

  if (!company) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="Barbearia não encontrada"
          description="Verifique o endereço ou volte para a página inicial do FADE OS."
          action={
            <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
              Ir para o FADE OS
            </Link>
          }
        />
      </div>
    );
  }

  const services = servicesResult.ok ? servicesResult.data : [];
  const team = teamResult.ok ? teamResult.data : [];
  const contactPhone = company.whatsapp || company.phone;

  return (
    <div className="animate-fade-in">
      <section className="border-b border-border bg-surface">
        <div className="shell py-10 sm:py-14 flex flex-col sm:flex-row sm:items-center gap-6">
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="size-20 sm:size-[88px] rounded-md object-cover border border-border shrink-0"
            />
          ) : (
            <div
              aria-hidden
              className="size-20 sm:size-[88px] rounded-md bg-surface-muted border border-border shrink-0 flex items-center justify-center text-page-title text-foreground"
            >
              {company.name.trim().charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-display text-foreground leading-tight">{company.name}</h1>
            {company.unit_address || company.address ? (
              <p className="text-body-sm text-muted mt-1.5">
                {company.unit_address || company.address}
                {company.city ? `, ${company.city}${company.state ? ` — ${company.state}` : ""}` : ""}
              </p>
            ) : null}
            {contactPhone && (
              <p className="text-body-sm text-muted mt-0.5">{contactPhone}</p>
            )}
          </div>

          <Link
            href={`/${slug}/agendar`}
            className={buttonClasses({ variant: "primary", size: "md", className: "shrink-0 sm:self-center" })}
          >
            Agendar horário
          </Link>
        </div>
      </section>

      <section className="shell py-10 sm:py-14">
        <h2 className="text-section-title text-foreground mb-5">Serviços</h2>

        {services.length === 0 ? (
          <EmptyState
            title="Nenhum serviço disponível no momento"
            description="Esta barbearia ainda não configurou os serviços para agendamento público."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((service) => (
              <div key={service.service_id} className="rounded-md border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body font-medium text-foreground">{service.name}</p>
                  <p className="text-body-sm text-foreground whitespace-nowrap">
                    {formatCurrency(service.default_price)}
                  </p>
                </div>
                {service.description && (
                  <p className="text-body-sm text-muted mt-1.5">{service.description}</p>
                )}
                <p className="text-caption text-muted mt-3">
                  {formatMinutes(service.planned_duration_minutes)}
                  {service.category ? ` · ${service.category}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {team.length > 0 && (
        <section className="shell pb-14">
          <h2 className="text-section-title text-foreground mb-5">Equipe</h2>
          <div className="flex flex-wrap gap-3">
            {team.map((professional) => (
              <div
                key={professional.professional_id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface pl-2.5 pr-4 py-2.5"
              >
                {professional.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={professional.avatar_url}
                    alt={professional.name}
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="size-9 rounded-full bg-surface-muted flex items-center justify-center text-body-sm text-foreground"
                  >
                    {professional.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-body-sm font-medium text-foreground">{professional.name}</p>
                  {professional.role_title && (
                    <p className="text-caption text-muted">{professional.role_title}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="shell pb-16">
        <div className="rounded-md border border-border bg-surface-context px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-section-title text-accent-foreground">Pronto para marcar seu horário?</p>
          <Link href={`/${slug}/agendar`} className={buttonClasses({ variant: "primary" })}>
            Agendar horário
          </Link>
        </div>
      </section>
    </div>
  );
}
