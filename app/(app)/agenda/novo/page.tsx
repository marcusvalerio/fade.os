import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import NewAppointmentForm from "./NewAppointmentForm";
import { rotularHomonimos } from "@/lib/pessoas";

export default async function NovoAgendamentoPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const [{ data: unit }, { data: clients }, { data: links }, { data: services }] =
    await Promise.all([
      supabase
        .from("unit")
        .select("id")
        .eq("company_id", current!.company.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("client")
        .select("id, name, phone, email")
        .eq("company_id", current!.company.id)
        .order("name"),
      // Só o vínculo profissional × serviço, e só de quem está ativo. A
      // Agenda oferecia qualquer profissional para qualquer serviço e o banco
      // recusava depois; agora a tela só mostra o que existe de verdade.
      supabase
        .from("professional_service")
        // phone entra junto porque é o que desempata dois colegas de mesmo nome
        // E mesma função — sem ele a lista mostrava duas opções idênticas.
        .select("service_id, professional:professional_id!inner(id, name, active, company_id, role_title, phone, email)")
        .eq("professional.company_id", current!.company.id)
        .eq("professional.active", true),
      // service_operational é a mesma definição que o motor e a vitrine usam:
      // ativo E com preço e duração que permitem executar e cobrar. Antes
      // aqui não havia nem filtro de status.
      supabase
        .from("service_operational")
        .select("id, name")
        .eq("company_id", current!.company.id)
        .order("name"),
    ]);

  if (!unit) {
    return (
      <Surface>
        <EmptyState
          title="Cadastre uma unidade primeiro"
          description="Agendamentos precisam de uma unidade para acontecer."
        />
      </Surface>
    );
  }

  // Quem faz cada serviço — a mesma estrutura que o Atendimento já usava.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const professionalsByService: Record<string, any[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (links ?? []).forEach((link: any) => {
    const professional = link.professional;
    if (!professional) return;
    (professionalsByService[link.service_id] ??= []).push(professional);
  });
  // Homônimos ganham um identificador — mas só dentro da lista do serviço em
  // que de fato colidem.
  const professionalsRotulados: Record<string, { id: string; name: string }[]> = {};
  Object.entries(professionalsByService).forEach(([serviceId, lista]) => {
    lista.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    professionalsRotulados[serviceId] = rotularHomonimos(lista);
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-page-title text-foreground mb-6">Novo agendamento</h1>
      <NewAppointmentForm
        companyId={current!.company.id}
        unitId={unit.id}
        clients={rotularHomonimos(clients ?? [])}
        professionalsByService={professionalsRotulados}
        services={services ?? []}
      />
    </div>
  );
}
