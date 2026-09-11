"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWalkInAttendance } from "@/actions/atendimento";
import { Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";

type Option = { id: string; name: string };

export default function NewWalkInForm({
  companyId,
  unitId,
  clients,
}: {
  companyId: string;
  unitId: string;
  clients: Option[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await createWalkInAttendance({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push(`/atendimento/${result.data.id}`);
  }

  return (
    <Formulario onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível iniciar o atendimento">
            {error}
          </Aviso>
        </div>
      )}

      <GrupoDeCampos titulo="Cliente" descricao="Quem chegou sem agendamento prévio.">
        <Field name="client_id" label="Cliente" required>
          <Select id="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Selecione...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </GrupoDeCampos>

      <AcoesDoFormulario ajuda="Depois de iniciado, adicione os serviços e produtos do atendimento.">
        <Button type="submit" pending={pending} className="w-full sm:w-auto">
          {pending ? "Iniciando…" : "Iniciar atendimento"}
        </Button>
      </AcoesDoFormulario>
    </Formulario>
  );
}
