import { createProfessionalRecord } from "@/actions/profissionais";
import { getCurrentCompany } from "@/lib/current-company";

export default async function NovoProfissionalPage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-md">
      <h1 className="text-xl mb-6">Novo profissional</h1>
      <form
        action={createProfessionalRecord}
        className="space-y-4 bg-white rounded-xl shadow-sm p-6"
      >
        <input type="hidden" name="company_id" value={current!.company.id} />
        <Field name="name" label="Nome" required />
        <Field name="email" label="E-mail" type="email" />
        <Field name="phone" label="Telefone" />
        <Field
          name="default_commission_percent"
          label="Comissão padrão (%)"
          type="number"
        />
        <button
          type="submit"
          className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm"
        >
          Salvar
        </button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
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
        required={required}
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
