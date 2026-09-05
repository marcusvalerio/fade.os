import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl">Clientes</h1>
        <Link
          href="/clientes/novo"
          className="bg-[var(--color-cobblestone)] text-white text-sm px-4 py-2 rounded-md"
        >
          Novo cliente
        </Link>
      </div>

      <form className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome ou telefone"
          className="w-full max-w-sm border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
        />
      </form>

      {error && <p className="text-sm text-[var(--color-otan-red)]">{error.message}</p>}

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(clients as Client[] | null)?.length ? (
          (clients as Client[]).map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-dusty-cotton)]/40"
            >
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-[var(--color-midnight-smoke)]">
                  {c.phone || "sem telefone"}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
            Nenhum cliente cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
