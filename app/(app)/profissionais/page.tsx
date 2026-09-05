import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { toggleProfessionalActive } from "@/actions/profissionais";
import type { Professional } from "@/lib/types";

export default async function ProfissionaisPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: professionals } = await supabase
    .from("professional")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl">Profissionais</h1>
        <Link
          href="/profissionais/novo"
          className="bg-[var(--color-cobblestone)] text-white text-sm px-4 py-2 rounded-md"
        >
          Novo profissional
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(professionals as Professional[] | null)?.length ? (
          (professionals as Professional[]).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/profissionais/${p.id}`} className="text-sm">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-[var(--color-midnight-smoke)]">
                  {p.default_commission_percent != null
                    ? `Comissão padrão: ${p.default_commission_percent}%`
                    : "Sem comissão padrão definida"}
                </p>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await toggleProfessionalActive(p.id, !p.active);
                }}
              >
                <button
                  className={`text-xs px-3 py-1 rounded-full ${
                    p.active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {p.active ? "Ativo" : "Inativo"}
                </button>
              </form>
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
            Nenhum profissional cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
