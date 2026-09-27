import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCompanyManager } from "@/lib/permissions";
import { updateServiceRecord, toggleProfessionalOnService } from "@/actions/servicos";
import { ServiceForm } from "../ServiceForm";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import type { Service, Professional } from "@/lib/types";
import { AcessoRestrito } from "@/components/ui/acesso-restrito";

export default async function ServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("service")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!service) notFound();

  // Mesma fronteira da lista em /servicos: catálogo é administração. Sem
  // este gate, qualquer staff que soubesse a URL editava vínculos de
  // profissional × serviço mesmo sem o link aparecer em lugar nenhum.
  if (!(await isCompanyManager((service as Service).company_id))) {
    return (
      <div>
        <PageHeader eyebrow="Cadastros" title="Serviço" />
        <AcessoRestrito />
      </div>
    );
  }

  // Só id/name: esta tela usa a lista apenas para o toggle de associação,
  // nunca leu e-mail/telefone/comissão do profissional.
  const { data: allProfessionals } = await supabase
    .from("professional")
    .select("id, name")
    .eq("company_id", (service as Service).company_id)
    .order("name");

  const { data: links } = await supabase
    .from("professional_service")
    .select("professional_id")
    .eq("service_id", id);

  const linkedIds = new Set((links ?? []).map((l) => l.professional_id));
  const updateAction = updateServiceRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-page-title text-foreground mb-6">{(service as Service).name}</h1>
        <ServiceForm
          modo="editar"
          action={updateAction}
          valores={{
            name: (service as Service).name,
            description: (service as Service).description,
            category: (service as Service).category,
            default_price: (service as Service).default_price,
            planned_duration_minutes: (service as Service).planned_duration_minutes,
            default_commission_percent: (service as Service).default_commission_percent,
            status: (service as Service).status,
            is_public: (service as Service).is_public,
          }}
        />
      </div>

      <div>
        <h2 className="text-section-title text-foreground mb-3">Profissionais que realizam este serviço</h2>
        <Surface>
          {(allProfessionals as Professional[] | null)?.length ? (
            (allProfessionals as Professional[]).map((p) => {
              const isLinked = linkedIds.has(p.id);
              return (
                <SurfaceRow key={p.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-foreground">{p.name}</span>
                  <form
                    action={async () => {
                      "use server";
                      await toggleProfessionalOnService(id, p.id, !isLinked);
                    }}
                  >
                    <button type="submit">
                      <Badge tone={isLinked ? "success" : "neutral"}>
                        {isLinked ? "Associado" : "Associar"}
                      </Badge>
                    </button>
                  </form>
                </SurfaceRow>
              );
            })
          ) : (
            <Vazio
              titulo="Nenhum profissional cadastrado ainda"
              descricao="Cadastre profissionais para poder associá-los a este serviço."
            />
          )}
        </Surface>
      </div>
    </div>
  );
}
