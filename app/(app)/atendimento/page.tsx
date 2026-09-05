import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";

export default async function AtendimentoListPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: attendances } = await supabase
    .from("attendance")
    .select("id, origin, status, created_at, client:client_id(name)")
    .eq("company_id", current!.company.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl">Atendimentos</h1>
        <Link
          href="/atendimento/novo"
          className="bg-[var(--color-cobblestone)] text-white text-sm px-4 py-2 rounded-md"
        >
          Novo atendimento (walk-in)
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {attendances && attendances.length > 0 ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attendances.map((a: any) => (
            <Link
              key={a.id}
              href={`/atendimento/${a.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-dusty-cotton)]/40"
            >
              <div>
                <p className="text-sm font-medium">{a.client?.name}</p>
                <p className="text-xs text-[var(--color-midnight-smoke)]">
                  {a.origin === "walk_in" ? "Walk-in" : "Originado de agendamento"}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  a.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : a.status === "cancelled"
                    ? "bg-gray-100 text-gray-500"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {a.status === "in_progress"
                  ? "Em andamento"
                  : a.status === "completed"
                  ? "Concluído"
                  : "Cancelado"}
              </span>
            </Link>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
            Nenhum atendimento registrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
