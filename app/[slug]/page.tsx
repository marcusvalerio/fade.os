import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getPublicBusinessHours,
  getPublicCompany,
  getPublicCompanyRating,
  getPublicPaymentMethods,
  getPublicServices,
  getPublicTeam,
  resolvePublicSlug,
} from "@/actions/public";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FocalImage } from "@/components/ui/focal-point-image";
import { ImageOrInitial } from "@/components/ui/image-or-initial";
import { formatCurrency, formatMinutes } from "@/lib/format";
import { composeEndereco } from "@/lib/endereco";
import { whatsAppUrl } from "@/lib/whatsapp";
import { PAYMENT_METHOD_LABEL } from "@/lib/payment-methods";
import type { PublicCompany, PaymentMethodKey } from "@/lib/types";

function instagramHandle(value: string): string {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  const handle = (fromUrl ?? trimmed).replace(/^@/, "");
  return handle;
}

function instagramUrl(value: string): string {
  return value.includes("instagram.com") ? value : `https://instagram.com/${instagramHandle(value)}`;
}

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

  const [companyResult, servicesResult, teamResult, hoursResult, ratingResult, paymentMethodsResult] =
    await Promise.all([
      getPublicCompany(slug),
      getPublicServices(slug),
      getPublicTeam(slug),
      getPublicBusinessHours(slug),
      getPublicCompanyRating(slug),
      getPublicPaymentMethods(slug),
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
  const team = teamResult.ok ? teamResult.data : [];
  const hours = hoursResult.ok ? hoursResult.data : [];
  const hoursNote = hours.find((h) => h.note)?.note ?? null;
  const rating = ratingResult.ok ? ratingResult.data : { averageStars: null, ratingCount: 0 };
  const paymentMethods = paymentMethodsResult.ok ? paymentMethodsResult.data : [];
  const contactPhone = company.whatsapp || company.phone;
  const contactWhatsAppUrl = whatsAppUrl(contactPhone, `Olá! Vim pela página da ${company.name}.`);
  // `unit_address` costuma já terminar em cidade/UF. Quem decide o que ainda
  // falta dizer é composeEndereco; aqui não se concatena nada às cegas.
  const endereco = composeEndereco({
    unitAddress: company.unit_address,
    address: company.address,
    city: company.city,
    state: company.state,
  });

  return (
    <div className="animate-fade-in">
      {/*
        P1.3 — esta é a vitrine DA BARBEARIA, não uma tela do CORTEX. Quem
        chega deve sentir "quero conhecer essa barbearia", não "estou
        usando um software de agendamento" — por isso a capa (quando
        configurada) domina a abertura, e localização/Instagram/WhatsApp
        ficam dentro do próprio Hero, nunca numa seção de contato à parte.
      */}
      <section className="relative border-b border-border">
        {company.cover_image_url ? (
          <div className="relative">
            <FocalImage
              src={company.cover_image_url}
              alt=""
              focalX={company.cover_image_focal_x}
              focalY={company.cover_image_focal_y}
              className="aspect-[4/3] sm:aspect-[21/9] w-full"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[var(--neutral-ink)] via-[var(--neutral-ink)]/35 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0">
              <HeroConteudo
                company={company}
                slug={slug}
                endereco={endereco}
                contactPhone={contactPhone}
                contactWhatsAppUrl={contactWhatsAppUrl}
                rating={rating}
                onImage
              />
            </div>
          </div>
        ) : (
          <div className="bg-surface">
            <HeroConteudo
              company={company}
              slug={slug}
              endereco={endereco}
              contactPhone={contactPhone}
              contactWhatsAppUrl={contactWhatsAppUrl}
              rating={rating}
              onImage={false}
            />
          </div>
        )}
      </section>

      {/*
        Composição pré-piloto: serviço/ação vem logo depois do Hero —
        horário de funcionamento é informação secundária e desceu para
        perto do rodapé, junto do CTA final, em vez de dominar a abertura
        da página.
      */}
      <section className="shell pt-10 sm:pt-14">
        <h2 className="text-section-title text-foreground mb-5">Serviços</h2>

        {services.length === 0 ? (
          <EmptyState
            title="Nenhum serviço disponível no momento"
            description="Esta barbearia ainda não configurou os serviços para agendamento público."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((service) => (
              <div key={service.service_id} className="material-solid rounded-md p-5">
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
                className="flex items-center gap-3 material-solid rounded-md pl-2.5 pr-4 py-2.5"
              >
                <ImageOrInitial
                  src={professional.avatar_url}
                  alt={professional.name}
                  label={professional.name}
                  className="size-9 rounded-full object-cover text-body-sm"
                />
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

      {hours.length > 0 && (
        <section className="shell pb-10 sm:pb-14">
          <h2 className="text-section-title text-foreground mb-5">Horário de funcionamento</h2>
          {/* Lê `unit_business_hours` — a mesma fonte que o motor de
              disponibilidade usa — em vez de repetir a regra. Dia fechado
              aparece como fechado; some da lista seria pior do que dizer. */}
          <div className="material-solid rounded-md divide-y divide-border max-w-md">
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

      {paymentMethods.length > 0 && (
        <section className="shell pb-10 sm:pb-14">
          <h2 className="text-section-title text-foreground mb-5">Formas de pagamento</h2>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <span
                key={method}
                className="text-body-sm text-foreground rounded-sm border border-border px-3 py-1.5"
              >
                {PAYMENT_METHOD_LABEL[method as PaymentMethodKey] ?? method}
              </span>
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

/**
 * O conteúdo do Hero é o mesmo nos dois casos (com ou sem capa) — só o
 * fundo muda. LOCALIZAÇÃO | INSTAGRAM | WHATSAPP moram aqui dentro, nunca
 * numa seção de contato separada: é a primeira coisa que o visitante lê,
 * junto do nome e da ação de agendar.
 */
function HeroConteudo({
  company,
  slug,
  endereco,
  contactPhone,
  contactWhatsAppUrl,
  rating,
  onImage,
}: {
  company: PublicCompany;
  slug: string;
  endereco: string | null;
  contactPhone: string | null | undefined;
  contactWhatsAppUrl: string | null;
  rating: { averageStars: number | null; ratingCount: number };
  onImage: boolean;
}) {
  const tone = onImage ? "text-neutral-warm-white" : "text-foreground";
  const toneMuted = onImage ? "text-neutral-bone" : "text-muted";
  const toneLink = onImage
    ? "text-neutral-bone hover:text-neutral-warm-white"
    : "text-muted hover:text-foreground";

  return (
    <div className={`shell py-8 sm:py-10 ${onImage ? "" : "flex flex-col sm:flex-row sm:items-center gap-6"}`}>
      {!onImage && (
        <ImageOrInitial
          src={company.logo_url}
          alt={company.name}
          label={company.name}
          className="size-20 sm:size-22 rounded-md border border-border shrink-0 object-cover text-page-title"
        />
      )}

      <div className="min-w-0 flex-1">
        <h1 className={`text-display leading-tight ${tone}`}>{company.name}</h1>

        {rating.ratingCount > 0 && rating.averageStars !== null && (
          <p className={`inline-flex items-center gap-1.5 text-body-sm mt-2 ${toneMuted}`}>
            <StarGlyph />
            <span className={`font-medium ${tone}`}>{rating.averageStars.toFixed(1)}</span>
            <span>
              ({rating.ratingCount} avaliaç{rating.ratingCount === 1 ? "ão" : "ões"})
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
          {endereco && (
            <span className={`inline-flex items-center gap-1.5 text-body-sm ${toneMuted}`}>
              <PinIcon /> {endereco}
            </span>
          )}
          {company.instagram && (
            <a
              href={instagramUrl(company.instagram)}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 text-body-sm transition-colors duration-fast ease-standard ${toneLink}`}
            >
              <InstagramIcon /> @{instagramHandle(company.instagram)}
            </a>
          )}
          {contactPhone &&
            (contactWhatsAppUrl ? (
              <a
                href={contactWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 text-body-sm transition-colors duration-fast ease-standard ${toneLink}`}
              >
                <WhatsappIcon /> {contactPhone}
              </a>
            ) : (
              <span className={`inline-flex items-center gap-1.5 text-body-sm ${toneMuted}`}>
                <WhatsappIcon /> {contactPhone}
              </span>
            ))}
        </div>

        <div className="mt-5">
          <Link
            href={`/${slug}/agendar`}
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            Agendar horário
          </Link>
        </div>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function StarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M12 2.5l2.9 6.06 6.6.77-4.86 4.6 1.28 6.57L12 17.4l-5.92 3.1 1.28-6.57-4.86-4.6 6.6-.77L12 2.5z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M12.04 2c-5.5 0-10 4.5-10 10 0 1.76.46 3.48 1.34 5L2 22l5.15-1.35A9.95 9.95 0 0 0 12.04 22c5.5 0 10-4.5 10-10s-4.5-10-10-10Zm0 18.2c-1.6 0-3.15-.43-4.5-1.24l-.32-.19-3.06.8.82-2.98-.21-.31A8.2 8.2 0 1 1 20.24 12a8.2 8.2 0 0 1-8.2 8.2Zm4.5-6.13c-.25-.12-1.47-.72-1.7-.8-.23-.08-.4-.12-.56.12-.17.25-.65.8-.8.96-.15.17-.3.19-.55.06-.25-.12-1.06-.39-2.01-1.24-.74-.66-1.24-1.48-1.39-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.23.89 2.42 1.02 2.59.12.17 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}
