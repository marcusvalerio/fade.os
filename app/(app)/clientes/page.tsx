import Link from "next/link";
import { formatBusinessDate } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { getClientBehaviors } from "@/lib/crm";
import { isCompanyManager } from "@/lib/permissions";
import { mensagemDeRetorno, urgenciaDeRetorno } from "@/lib/crm-regras";
import { whatsAppUrl } from "@/lib/whatsapp";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { ClientSearchInput } from "./ClientSearchInput";
import { SituacaoCliente } from "./SituacaoCliente";
import type { Client } from "@/lib/types";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const current = await getCurrentCompany();
  const supabase = await createClient();

  let query = supabase
    .from("client")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: clients, error } = await query;
  const [behaviors, gerente] = await Promise.all([getClientBehaviors(current!.company.id), isCompanyManager(current!.company.id)]);

  const callToday = (clients as Client[] | null)
    ?.filter((c) => {
      const status = behaviors.get(c.id)?.status;
      return status === "atencao" || status === "recuperacao";
    })
    .sort((a, b) => urgenciaDeRetorno(behaviors.get(b.id)!) - urgenciaDeRetorno(behaviors.get(a.id)!));

  return (
    <div>
      <PageHeader
        eyebrow="Hoje"
        title="Clientes"
        action={
          <>
            {gerente && (
              <Link href="/clientes/importar" className={buttonClasses({ variant: "secondary" })}>
                Importar planilha
              </Link>
            )}
            <Link href="/clientes/novo" className={buttonClasses()}>
              Novo cliente
            </Link>
          </>
        }
      />

      {!q && callToday && callToday.length > 0 && (
        <section className="mb-8" aria-labelledby="chamar-hoje">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 id="chamar-hoje" className="text-section-title text-foreground">
              Clientes para chamar hoje
            </h2>
            <p className="text-caption text-muted">
              {callToday.length} passaram do próprio ritmo de volta · quem está mais atrasado primeiro
            </p>
          </div>
          <Surface>
            {callToday.slice(0, 8).map((c) => {
              const behavior = behaviors.get(c.id);
              // O CORTEX não envia mensagem: prepara o texto e abre o WhatsApp
              // da equipe — e só para quem autorizou contato.
              const whatsapp = c.communication_consent
                ? whatsAppUrl(c.phone, mensagemDeRetorno(c.name, current!.company.name, behavior?.daysSinceVisit ?? null))
                : null;
              return (
                <SurfaceRow key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/clientes/${c.id}`} className="group min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <p className="text-body-sm font-medium text-foreground group-hover:underline underline-offset-4">
                      {c.name}
                    </p>
                    <p className="text-caption text-muted mt-0.5">
                      Costuma voltar a cada {behavior?.avgGapDays} dias — já se passaram {behavior?.daysSinceVisit}.
                    </p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0">
                    <SituacaoCliente status={behavior?.status ?? "ativo"} />
                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-caption text-muted">
                        {c.communication_consent ? "sem telefone" : "sem autorização de contato"}
                      </span>
                    )}
                    <Link href={`/agenda/novo?cliente=${c.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      Agendar
                    </Link>
                  </div>
                </SurfaceRow>
              );
            })}
          </Surface>
        </section>
      )}

      <div className="mb-5">
        <ClientSearchInput initialValue={q ?? ""} />
      </div>

      {error && <p className="text-body-sm text-danger-ink mb-4">Não foi possível carregar os clientes.</p>}

      <Surface>
        {(clients as Client[] | null)?.length ? (
          (clients as Client[]).map((c) => {
            const behavior = behaviors.get(c.id);
            return (
              <Link key={c.id} href={`/clientes/${c.id}`} className="block">
                <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                  <div>
                    <p className="text-body-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-caption text-muted mt-0.5">{c.phone || "sem telefone"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-caption text-muted">
                      {behavior?.lastVisit
                        ? `última visita ${formatBusinessDate(behavior.lastVisit, { day: "2-digit", month: "short" })}`
                        : "sem visitas"}
                    </p>
                    {behavior && <SituacaoCliente status={behavior.status} ocultarAtivo />}
                  </div>
                </SurfaceRow>
              </Link>
            );
          })
        ) : q ? (
          <Vazio
            titulo={`Nenhum cliente para "${q}"`}
            descricao="Confira a grafia ou o telefone — a busca procura pelos dois."
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/clientes" className={buttonClasses({ variant: "secondary" })}>
                  Limpar busca
                </Link>
                <Link href="/clientes/novo" className={buttonClasses()}>
                  Cadastrar {q}
                </Link>
              </div>
            }
          />
        ) : (
          <Vazio
            titulo="Nenhum cliente cadastrado ainda"
            descricao="Cadastre o primeiro cliente — ou traga a lista que você já tem numa planilha."
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/clientes/novo" className={buttonClasses({ variant: "secondary" })}>
                  Novo cliente
                </Link>
                {gerente && (
                  <Link href="/clientes/importar" className={buttonClasses({ variant: "secondary" })}>
                    Importar planilha
                  </Link>
                )}
              </div>
            }
          />
        )}
      </Surface>
    </div>
  );
}
