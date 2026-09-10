import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
};

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
      <PageHeader
        title="Atendimentos"
        action={
          <Link href="/atendimento/novo" className={buttonClasses()}>
            Novo atendimento (walk-in)
          </Link>
        }
      />

      <Surface>
        {attendances && attendances.length > 0 ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attendances.map((a: any) => (
            <Link key={a.id} href={`/atendimento/${a.id}`} className="block">
              <SurfaceRow className="flex items-center justify-between hover:bg-surface-muted">
                <div>
                  <p className="text-body-sm font-medium text-foreground">{a.client?.name}</p>
                  <p className="text-caption text-muted mt-0.5">
                    {a.origin === "walk_in" ? "Walk-in" : "Originado de agendamento"}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              </SurfaceRow>
            </Link>
          ))
        ) : (
          <Vazio
            titulo="Nenhum atendimento ainda"
            descricao="Atendimentos aparecem aqui quando um agendamento começa ou quando um cliente chega sem hora marcada."
            acao={
              <Link href="/atendimento/novo" className={buttonClasses({ variant: "secondary" })}>
                Registrar walk-in
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
