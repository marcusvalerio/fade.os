import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { toggleProfessionalActive } from "@/actions/profissionais";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
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
      <PageHeader
        title="Profissionais"
        action={
          <Link href="/profissionais/novo" className={buttonClasses()}>
            Novo profissional
          </Link>
        }
      />

      <Surface>
        {(professionals as Professional[] | null)?.length ? (
          (professionals as Professional[]).map((p) => (
            <SurfaceRow key={p.id} className="flex items-center justify-between">
              <Link href={`/profissionais/${p.id}`} className="text-body-sm">
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-caption text-muted mt-0.5">
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
                <button type="submit">
                  <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                </button>
              </form>
            </SurfaceRow>
          ))
        ) : (
          <EmptyState
            title="Nenhum profissional cadastrado ainda"
            description="Cadastre quem realiza os atendimentos para começar a montar a agenda."
            action={
              <Link href="/profissionais/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo profissional
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
