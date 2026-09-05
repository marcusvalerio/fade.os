import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateClientRecord } from "@/actions/clientes";
import type { Client, Attendance } from "@/lib/types";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("client")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: attendances } = await supabase
    .from("attendance")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const updateAction = updateClientRecord.bind(null, id);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl mb-6">{(client as Client).name}</h1>
        <form action={updateAction} className="space-y-4 bg-white rounded-xl shadow-sm p-6">
          <TextField name="name" label="Nome" defaultValue={client.name} required />
          <TextField name="phone" label="Telefone" defaultValue={client.phone ?? ""} />
          <TextField name="email" label="E-mail" type="email" defaultValue={client.email ?? ""} />
          <TextField
            name="birth_date"
            label="Data de nascimento"
            type="date"
            defaultValue={client.birth_date ?? ""}
          />
          <TextAreaField name="notes" label="Observações" defaultValue={client.notes ?? ""} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="communication_consent"
              defaultChecked={client.communication_consent}
            />
            Aceita receber comunicações
          </label>
          <button
            type="submit"
            className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm"
          >
            Salvar alterações
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg mb-3">Histórico de atendimentos</h2>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {(attendances as Attendance[] | null)?.length ? (
            (attendances as Attendance[]).map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm flex justify-between">
                <span>Atendimento</span>
                <span className="text-[var(--color-midnight-smoke)]">{a.status}</span>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-[var(--color-midnight-smoke)]">
              Nenhum atendimento registrado ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TextField({
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

function TextAreaField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-sm mb-1" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
