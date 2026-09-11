"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/agenda";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";

type Option = { id: string; name: string };

type Line = {
  service_id: string;
  professional_id: string;
  starts_at: string;
};

// Sem campo de fim: a duração é a do serviço, aplicada pelo servidor.
const emptyLine: Line = { service_id: "", professional_id: "", starts_at: "" };

export default function NewAppointmentForm({
  companyId,
  unitId,
  clients,
  professionalsByService,
  services,
}: {
  companyId: string;
  unitId: string;
  clients: Option[];
  /** Quem realmente executa cada serviço. A lista de profissionais deixa de
   *  ser global: escolher o serviço é que decide quem pode ser oferecido. */
  professionalsByService: Record<string, Option[]>;
  services: Option[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  // Trocar o serviço limpa o profissional: quem estava escolhido pode não
  // fazer o serviço novo, e deixar o valor antigo seria oferecer de novo
  // uma combinação que o banco recusa.
  function escolherServico(index: number, serviceId: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, service_id: serviceId, professional_id: "" } : l))
    );
  }

  function removerLinha(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await createAppointment({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId,
      lines,
    });

    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push("/agenda");
  }

  return (
    <Formulario onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível criar o agendamento">
            {error}
          </Aviso>
        </div>
      )}

      <GrupoDeCampos titulo="Cliente">
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

      <GrupoDeCampos
        titulo="Serviços"
        descricao="Um agendamento pode reunir mais de um serviço, cada um com seu horário e profissional."
      >
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="border border-border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-label uppercase text-muted">Serviço {i + 1}</p>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerLinha(i)}
                    className="text-caption text-danger-ink hover:underline alvo-toque"
                  >
                    remover
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  value={line.service_id}
                  onChange={(e) => escolherServico(i, e.target.value)}
                  required
                  aria-label="Serviço"
                >
                  <option value="">Serviço...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={line.professional_id}
                  onChange={(e) => updateLine(i, "professional_id", e.target.value)}
                  required
                  disabled={!line.service_id}
                  aria-label="Profissional"
                >
                  <option value="">
                    {line.service_id ? "Profissional..." : "Escolha o serviço primeiro"}
                  </option>
                  {(professionalsByService[line.service_id] ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                {line.service_id && (professionalsByService[line.service_id] ?? []).length === 0 && (
                  <div className="col-span-2">
                    <Aviso tom="atencao">
                      Nenhum profissional ativo faz esse serviço. Vincule alguém em Equipe →
                      Profissionais.
                    </Aviso>
                  </div>
                )}
                <Input
                  type="datetime-local"
                  value={line.starts_at}
                  onChange={(e) => updateLine(i, "starts_at", e.target.value)}
                  required
                  aria-label="Data e horário"
                  className="col-span-2"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { ...emptyLine }])}
            className="text-body-sm text-primary hover:underline"
          >
            + adicionar outro serviço
          </button>
        </div>
      </GrupoDeCampos>

      <AcoesDoFormulario>
        <Button type="submit" pending={pending} className="w-full sm:w-auto">
          {pending ? "Criando…" : "Criar agendamento"}
        </Button>
      </AcoesDoFormulario>
    </Formulario>
  );
}
