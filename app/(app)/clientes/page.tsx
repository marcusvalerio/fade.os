import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { getClientBehaviors } from "@/lib/crm";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import type { Client } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  ativo: "ativo",
  atencao: "atenção",
  recuperacao: "recuperação",
  inativo: "inativo",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ativo: "success",
  atencao: "warning",
  recuperacao: "danger",
  inativo: "neutral",
};

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
  const behaviors = await getClientBehaviors(current!.company.id);

  const callToday = (clients as Client[] | null)?.filter((c) => {
    const status = behaviors.get(c.id)?.status;
    return status === "atencao" || status === "recuperacao";
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        action={
          <Link href="/clientes/novo" className={buttonClasses()}>
            Novo cliente
          </Link>
        }
      />

      {!q && callToday && callToday.length > 0 && (
        <section className="mb-6">
          <h2 className="text-section-title text-foreground mb-3">Clientes para chamar hoje</h2>
          <Surface>
            {callToday.slice(0, 8).map((c) => {
              const behavior = behaviors.get(c.id);
              return (
                <Link key={c.id} href={`/clientes/${c.id}`} className="block">
                  <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                    <div>
                      <p className="text-body-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-caption text-muted mt-0.5">
                        Costuma voltar a cada {behavior?.avgGapDays} dias — já se passaram{" "}
                        {behavior?.daysSinceVisit}.
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[behavior?.status ?? "ativo"]}>
                      {STATUS_LABEL[behavior?.status ?? "ativo"]}
                    </Badge>
                  </SurfaceRow>
                </Link>
              );
            })}
          </Surface>
        </section>
      )}

      <form className="mb-5">
        <Input type="text" name="q" defaultValue={q ?? ""} placeholder="Buscar por nome ou telefone" className="max-w-sm" />
      </form>

      {error && <p className="text-body-sm text-danger mb-4">Não foi possível carregar os clientes.</p>}

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
                        ? `última visita ${new Date(behavior.lastVisit).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                        : "sem visitas"}
                    </p>
                    {behavior && (
                      <Badge tone={STATUS_TONE[behavior.status]}>{STATUS_LABEL[behavior.status]}</Badge>
                    )}
                  </div>
                </SurfaceRow>
              </Link>
            );
          })
        ) : q ? (
          <EmptyState
            title="Nenhum resultado"
            description={`Não encontramos nenhum cliente para "${q}".`}
          />
        ) : (
          <EmptyState
            title="Nenhum cliente cadastrado ainda"
            description="Cadastre o primeiro cliente para começar a agendar e atender."
            action={
              <Link href="/clientes/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo cliente
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
