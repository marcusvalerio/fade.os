import { createClientRecord } from "@/actions/clientes";
import { getCurrentCompany } from "@/lib/current-company";

export default async function NovoClientePage() {
  const current = await getCurrentCompany();

  return (
    <div className="max-w-md">
      <h1 className="text-xl mb-6">Novo cliente</h1>
      <form action={createClientRecord} className="space-y-4 bg-white rounded-xl shadow-sm p-6">
        <input type="hidden" name="company_id" value={current!.company.id} />
        <TextField name="name" label="Nome" required />
        <TextField name="phone" label="Telefone" />
        <TextField name="email" label="E-mail" type="email" />
        <TextField name="birth_date" label="Data de nascimento" type="date" />
        <TextAreaField name="notes" label="Observações" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="communication_consent" defaultChecked />
          Aceita receber comunicações
        </label>
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

function TextField({
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

function TextAreaField({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="block text-sm mb-1" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
