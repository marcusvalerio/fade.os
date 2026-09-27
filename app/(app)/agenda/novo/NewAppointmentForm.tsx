"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/agenda";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";
import { businessDate, formatBusinessTime, formatBusinessDayLabel } from "@/lib/time";
import { SeletorDeHorario, type HorarioEscolhido } from "../SeletorDeHorario";

type Option = { id: string; name: string };

type Line = {
  service_id: string;
  professional_id: string;
  date: string;
  horario: HorarioEscolhido | null;
};

function localDoIso(iso: string) {
  return `${businessDate(iso)}T${formatBusinessTime(iso)}`;
}

export default function NewAppointmentForm({
  companyId,
  unitId,
  clients,
  professionalsByService,
  services,
  today,
  inicial,
}: {
  companyId: string;
  unitId: string;
  clients: Option[];
  /** Quem realmente executa cada serviço. A lista de profissionais deixa de
   *  ser global: escolher o serviço é que decide quem pode ser oferecido. */
  professionalsByService: Record<string, Option[]>;
  services: Option[];
  today: string;
  /** Vindo de outra tela (ficha do cliente, agenda de um profissional, um dia). */
  inicial: { clientId?: string; date?: string; professionalId?: string };
}) {
  const router = useRouter();
  const { show } = useToast();
  const [clientId, setClientId] = useState(inicial.clientId ?? "");
  const [lines, setLines] = useState<Line[]>([
    { service_id: "", professional_id: inicial.professionalId ?? "", date: inicial.date ?? today, horario: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function atualizar(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  // Trocar o serviço mantém o profissional só se ele faz o serviço novo —
  // deixar o valor antigo seria oferecer uma combinação que o banco recusa.
  function escolherServico(index: number, serviceId: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const quemFaz = professionalsByService[serviceId] ?? [];
        const mantem = quemFaz.some((p) => p.id === l.professional_id);
        const unico = quemFaz.length === 1 ? quemFaz[0].id : "";
        return { ...l, service_id: serviceId, professional_id: mantem ? l.professional_id : unico, horario: null };
      })
    );
  }

  function adicionarServico() {
    setLines((prev) => {
      const ultimo = prev[prev.length - 1];
      return [...prev, { service_id: "", professional_id: ultimo.professional_id, date: ultimo.date, horario: null }];
    });
  }

  const escolherHorario = useCallback((index: number, horario: HorarioEscolhido | null) => {
    setLines((prev) => (prev[index]?.horario?.local === horario?.local ? prev : prev.map((l, i) => (i === index ? { ...l, horario } : l))));
  }, []);
  // Uma função estável por linha: o seletor chama isto dentro de um efeito.
  const selecionadores = useMemo(
    () => Array.from({ length: lines.length }, (_, i) => (h: HorarioEscolhido | null) => escolherHorario(i, h)),
    [lines.length, escolherHorario]
  );

  const completo = clientId !== "" && lines.every((l) => l.service_id && l.professional_id && l.horario);
  const nomeServico = (id: string) => services.find((s) => s.id === id)?.name ?? "Serviço";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo) return;
    setError(null);
    setPending(true);

    const result = await createAppointment({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId,
      lines: lines.map((l) => ({ service_id: l.service_id, professional_id: l.professional_id, starts_at: l.horario!.local })),
    });

    setPending(false);
    if (!result.ok) return setError(result.error);
    const primeiro = lines[0];
    show(`Agendado para ${formatBusinessDayLabel(primeiro.date, { weekday: "long", day: "2-digit", month: "long" })}, ${primeiro.horario!.local.slice(11, 16)}.`, "success");
    router.push(`/agenda?date=${primeiro.date}`);
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
        titulo="Serviços e horário"
        descricao="Os horários vêm da mesma disponibilidade da página pública: jornada, funcionamento, bloqueios, ausências e o que já está marcado."
      >
        <div className="space-y-3">
          {lines.map((line, i) => {
            const quemFaz = professionalsByService[line.service_id] ?? [];
            // Serviços anteriores desta tela com o mesmo profissional ainda
            // não existem no banco — o motor não os vê; a tela desconta.
            const ocupados = lines
              .slice(0, i)
              .filter((l) => l.horario && l.professional_id === line.professional_id)
              .map((l) => ({ inicio: new Date(l.horario!.inicioIso).getTime(), fim: new Date(l.horario!.fimIso).getTime() }));
            const anterior = i > 0 ? lines[i - 1] : null;
            const logoDepois =
              anterior?.horario && anterior.date === line.date ? localDoIso(anterior.horario.fimIso) : undefined;

            return (
              <div key={i} className="border border-border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-label uppercase text-muted">
                    {lines.length > 1 ? `Serviço ${i + 1}` : "Serviço"}
                    {line.horario && (
                      <span className="normal-case tracking-normal text-foreground ml-2 tabular-nums">
                        · {line.horario.local.slice(11, 16)}–{formatBusinessTime(line.horario.fimIso)}
                      </span>
                    )}
                  </p>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                      className="text-caption text-danger-ink hover:underline alvo-toque"
                    >
                      remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    onChange={(e) => atualizar(i, { professional_id: e.target.value, horario: null })}
                    required
                    disabled={!line.service_id}
                    aria-label="Profissional"
                  >
                    <option value="">{line.service_id ? "Profissional..." : "Escolha o serviço primeiro"}</option>
                    {quemFaz.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="date"
                    value={line.date}
                    min={today}
                    onChange={(e) => atualizar(i, { date: e.target.value, horario: null })}
                    required
                    aria-label="Dia"
                  />
                </div>
                {line.service_id && quemFaz.length === 0 ? (
                  <Aviso tom="atencao">
                    Nenhum profissional ativo faz {nomeServico(line.service_id)}. Vincule alguém em Equipe → Profissionais.
                  </Aviso>
                ) : (
                  <SeletorDeHorario
                    companyId={companyId}
                    unitId={unitId}
                    serviceIds={line.service_id ? [line.service_id] : []}
                    professionalId={line.professional_id}
                    date={line.date}
                    selecionado={line.horario?.local ?? ""}
                    onSelecionar={selecionadores[i]}
                    ocupadosNaTela={ocupados}
                    preferir={logoDepois}
                  />
                )}
              </div>
            );
          })}
          <button type="button" onClick={adicionarServico} className="text-body-sm text-primary hover:underline alvo-toque">
            + adicionar outro serviço
          </button>
        </div>
      </GrupoDeCampos>

      <AcoesDoFormulario ajuda={completo ? undefined : "Escolha o cliente e um horário livre para cada serviço."}>
        <Button type="submit" pending={pending} disabled={!completo} className="w-full sm:w-auto">
          {pending ? "Agendando…" : "Criar agendamento"}
        </Button>
      </AcoesDoFormulario>
    </Formulario>
  );
}
