import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getPublicBusinessHours,
  getPublicCompany,
  getPublicServices,
  getPublicTeam,
  resolvePublicSlug,
} from "@/actions/public";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMinutes } from "@/lib/format";

export const revalidate = 0;

const DIA_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default async function PublicBarbershopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Um endereço que a barbearia já teve continua levando até ela: quem
  // guardou o link antigo é redirecionado para o atual, em vez de bater numa
  // tela de "não encontrada" indistinguível de endereço inventado.
  const slugAtual = await resolvePublicSlug(slug);
  if (slugAtual && slugAtual !== slug) redirect(`/${slugAtual}`);

  const [companyResult, servicesResult, teamResult, hoursResult] = await Promise.all([
    getPublicCompany(slug),
    getPublicServices(slug),
    getPublicTeam(slug),
    getPublicBusinessHours(slug),
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
  const hours = hoursResult.ok ? hoursResult.data : [];
  const hoursNote = hours.find((h) => h.note)?.note ?? null;
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

      {hours.length > 0 && (
        <section className="shell pt-10 sm:pt-14">
          <h2 className="text-section-title text-foreground mb-5">Horário de funcionamento</h2>
          {/* Lê `unit_business_hours` — a mesma fonte que o motor de
              disponibilidade usa — em vez de repetir a regra. Dia fechado
              aparece como fechado; some da lista seria pior do que dizer. */}
          <div className="rounded-md border border-border bg-surface divide-y divide-border max-w-md">
            {hours.map((h) => (
              <div key={h.weekday} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-body-sm text-foreground">{DIA_SEMANA[h.weekday]}</span>
                <span
                  className={
                    h.active
                      ? "text-body-sm tabular-nums text-foreground"
                      : "text-body-sm text-muted"
                  }
                >
                  {h.active && h.start_time && h.end_time
                    ? `${h.start_time.slice(0, 5)} às ${h.end_time.slice(0, 5)}`
                    : "Fechado"}
                </span>
              </div>
            ))}
          </div>
          {hoursNote && <p className="text-body-sm text-muted mt-3 max-w-md">{hoursNote}</p>}
        </section>
      )}

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
