import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
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

      <form className="mb-5">
        <Input type="text" name="q" defaultValue={q ?? ""} placeholder="Buscar por nome ou telefone" className="max-w-sm" />
      </form>

      {error && <p className="text-body-sm text-danger mb-4">Não foi possível carregar os clientes.</p>}

      <Surface>
        {(clients as Client[] | null)?.length ? (
          (clients as Client[]).map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`} className="block">
              <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                <div>
                  <p className="text-body-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-caption text-muted mt-0.5">{c.phone || "sem telefone"}</p>
                </div>
              </SurfaceRow>
            </Link>
          ))
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
