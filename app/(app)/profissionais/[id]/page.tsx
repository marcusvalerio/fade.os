import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfessionalRecord } from "@/actions/profissionais";
import type { Professional, Service } from "@/lib/types";

export default async function ProfissionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: professional } = await supabase
    .from("professional")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!professional) notFound();

  const { data: services } = await supabase
    .from("service")
    .select("*, professional_service!inner(professional_id)")
    .eq("company_id", (professional as Professional).company_id)
    .eq("professional_service.professional_id", id);

  const updateAction = updateProfessionalRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl mb-6">{(professional as Professional).name}</h1>
        <form
          action={updateAction}
          className="space-y-4 bg-white rounded-xl shadow-sm p-6"
        >
          <Field name="name" label="Nome" defaultValue={professional.name} required />
          <Field name="email" label="E-mail" type="email" defaultValue={professional.email ?? ""} />
          <Field name="phone" label="Telefone" defaultValue={professional.phone ?? ""} />
          <Field
            name="default_commission_percent"
            label="Comissão padrão (%)"
            type="number"
            defaultValue={professional.default_commission_percent?.toString() ?? ""}
          />
          <button
            type="submit"
            className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm"
          >
            Salvar alterações
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg mb-3">Serviços que realiza</h2>
        <p className="text-sm text-[var(--color-midnight-smoke)] mb-2">
          Para associar ou remover serviços, use a tela do serviço correspondente.
        </p>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {(services as Service[] | null)?.length ? (
            (services as Service[]).map((s) => (
              <div key={s.id} className="px-4 py-3 text-sm">
                {s.name}
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
              Nenhum serviço associado ainda.
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
        defaultValue={defaultValue}
        required={required}
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
