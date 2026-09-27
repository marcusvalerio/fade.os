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
            <p className="text-caption text-muted sm:col-span-2">
              Este agendamento tem serviços com profissionais diferentes: cada um continua com o seu, e os horários
              mostrados são os do primeiro serviço.
            </p>
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
          serviceIds={mesmoProfissional ? serviceIds : serviceIds.slice(0, 1)}
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
