import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateServiceRecord, toggleProfessionalOnService } from "@/actions/servicos";
import type { Service, Professional } from "@/lib/types";

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

  const { data: allProfessionals } = await supabase
    .from("professional")
    .select("*")
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
        <h1 className="text-xl mb-6">{(service as Service).name}</h1>
        <form
          action={updateAction}
          className="space-y-4 bg-white rounded-xl shadow-sm p-6"
        >
          <Field name="name" label="Nome" defaultValue={service.name} required />
          <Field name="category" label="Categoria" defaultValue={service.category ?? ""} />
          <Field
            name="default_price"
            label="Preço (R$)"
            type="number"
            defaultValue={service.default_price.toString()}
            required
          />
          <Field
            name="planned_duration_minutes"
            label="Duração planejada (minutos)"
            type="number"
            defaultValue={service.planned_duration_minutes.toString()}
            required
          />
          <Field
            name="default_commission_percent"
            label="Comissão padrão (%)"
            type="number"
            defaultValue={service.default_commission_percent?.toString() ?? ""}
          />
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select
              name="status"
              defaultValue={service.status}
              className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <p className="text-xs text-[var(--color-midnight-smoke)]">
            Alterar preço ou comissão aqui não afeta atendimentos já registrados —
            eles guardam o valor congelado no momento em que foram feitos.
          </p>
          <button
            type="submit"
            className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm"
          >
            Salvar alterações
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg mb-3">Profissionais que realizam este serviço</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {(allProfessionals as Professional[] | null)?.length ? (
            (allProfessionals as Professional[]).map((p) => {
              const isLinked = linkedIds.has(p.id);
              return (
                <form
                  key={p.id}
                  action={async () => {
                    "use server";
                    await toggleProfessionalOnService(id, p.id, !isLinked);
                  }}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm">{p.name}</span>
                  <button
                    className={`text-xs px-3 py-1 rounded-full ${
                      isLinked
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isLinked ? "Associado" : "Associar"}
                  </button>
                </form>
              );
            })
          ) : (
            <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
              Nenhum profissional cadastrado ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        defaultValue={defaultValue}
        required={required}
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
