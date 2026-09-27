"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rescheduleAppointment } from "@/actions/agenda";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";
import { formatBusinessDayLabel } from "@/lib/time";
import { SeletorDeHorario, type HorarioEscolhido } from "../../SeletorDeHorario";

export function FormularioReagendar({
  appointmentId,
  companyId,
  unitId,
  serviceIds,
  profissionais,
  profissionalAtual,
  mesmoProfissional,
  dataAtual,
  today,
  linhas,
}: {
  appointmentId: string;
  companyId: string;
  unitId: string;
  serviceIds: string[];
  profissionais: { id: string; name: string }[];
  profissionalAtual: string;
  mesmoProfissional: boolean;
  dataAtual: string;
  today: string;
  /** Serviços com a distância de cada um até o primeiro (modo composto). */
  linhas: { serviceId: string; professionalId: string; offsetMin: number; rotulo: string }[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [profissional, setProfissional] = useState(profissionalAtual);
  const [data, setData] = useState(dataAtual);
  const [horario, setHorario] = useState<HorarioEscolhido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!horario) return;
    setErro(null);
    setPendente(true);
    const resultado = await rescheduleAppointment({
      appointment_id: appointmentId,
      starts_at: horario.local,
      professional_id: mesmoProfissional && profissional !== profissionalAtual ? profissional : null,
    });
    setPendente(false);
    if (!resultado.ok) return setErro(resultado.error);
    show(
      `Reagendado para ${formatBusinessDayLabel(data, { weekday: "long", day: "2-digit", month: "long" })}, ${horario.local.slice(11, 16)}.`,
      "success"
    );
    router.push(`/agenda?date=${data}`);
  }

  return (
    <Formulario onSubmit={enviar} noValidate>
      {erro && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível reagendar">
            {erro}
          </Aviso>
        </div>
      )}
      <GrupoDeCampos
        titulo="Novo horário"
        descricao="Os horários livres ignoram o próprio agendamento — dá para mover alguns minutos para frente ou para trás."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mesmoProfissional ? (
            <Field name="profissional" label="Profissional">
              <Select
                id="profissional"
                value={profissional}
                onChange={(e) => {
                  setProfissional(e.target.value);
                  setHorario(null);
                }}
              >
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="sm:col-span-2 text-caption text-muted">
              <p>Serviços com profissionais diferentes — cada um continua com o seu, na mesma ordem:</p>
              <ul className="mt-1.5 space-y-0.5">
                {linhas.map((l) => (
                  <li key={l.serviceId + l.offsetMin} className="text-foreground">
                    {l.rotulo}
                    {l.offsetMin > 0 && <span className="text-muted"> · começa {l.offsetMin} min depois</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5">Só aparecem horários em que todos estão livres.</p>
            </div>
          )}
          <Field name="dia" label="Dia">
            <Input
              id="dia"
              type="date"
              value={data}
              min={today}
              onChange={(e) => {
                setData(e.target.value);
                setHorario(null);
              }}
            />
          </Field>
        </div>
        <SeletorDeHorario
          companyId={companyId}
          unitId={unitId}
          serviceIds={serviceIds}
          linhas={mesmoProfissional ? undefined : linhas}
          professionalId={profissional}
          date={data}
          selecionado={horario?.local ?? ""}
          onSelecionar={setHorario}
          excluirAgendamentoId={appointmentId}
        />
      </GrupoDeCampos>
      <AcoesDoFormulario ajuda={horario ? undefined : "Escolha um horário livre."}>
        <Button type="submit" pending={pendente} disabled={!horario} className="w-full sm:w-auto">
          {pendente ? "Reagendando…" : "Confirmar novo horário"}
        </Button>
      </AcoesDoFormulario>
    </Formulario>
  );
}
