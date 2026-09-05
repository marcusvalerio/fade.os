import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import type { Service } from "@/lib/types";

export default async function ServicosPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("service")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl">Serviços</h1>
        <Link
          href="/servicos/novo"
          className="bg-[var(--color-cobblestone)] text-white text-sm px-4 py-2 rounded-md"
        >
          Novo serviço
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(services as Service[] | null)?.length ? (
          (services as Service[]).map((s) => (
            <Link
              key={s.id}
              href={`/servicos/${s.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-dusty-cotton)]/40"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-[var(--color-midnight-smoke)]">
                  R$ {s.default_price.toFixed(2)} · {s.planned_duration_minutes} min
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  s.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.status}
              </span>
            </Link>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
            Nenhum serviço cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
