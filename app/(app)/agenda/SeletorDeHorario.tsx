"use client";

import { useEffect, useMemo, useState } from "react";
import { getAvailableSlots, horariosParaReagendar } from "@/actions/disponibilidade";
import { businessDate, formatBusinessTime } from "@/lib/time";
import { Aviso } from "@/components/ui/estado";
import { cn } from "@/lib/cn";

export type HorarioEscolhido = {
  /** Relógio da barbearia, no formato do `datetime-local`: "2026-09-29T14:00". */
  local: string;
  inicioIso: string;
  fimIso: string;
};

type Estado =
  | { tipo: "incompleto" }
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; horarios: HorarioEscolhido[] };

const PERIODOS = [
  { rotulo: "Manhã", ate: 12 },
  { rotulo: "Tarde", ate: 18 },
  { rotulo: "Noite", ate: 24 },
] as const;

/**
 * Os horários que o CORTEX consegue de fato reservar.
 *
 * Nada aqui é calculado no navegador: a lista vem do mesmo motor que a
 * página pública usa (get_available_slots) — jornada, funcionamento,
 * intervalos, bloqueios, ausências e o que já está marcado. Antes a agenda
 * interna oferecia um campo livre de data e hora, e o banco recusava depois;
 * agora a tela só mostra o que o banco aceita.
 *
 * `ocupadosNaTela` cobre o que ainda não foi salvo: num agendamento com dois
 * serviços, o segundo não pode cair em cima do primeiro, que o motor ainda
 * não conhece.
 */
export function SeletorDeHorario({
  companyId,
  unitId,
  serviceIds,
  professionalId,
  date,
  selecionado,
  onSelecionar,
  ocupadosNaTela = [],
  excluirAgendamentoId,
  preferir,
  linhas,
}: {
  companyId: string;
  unitId: string;
  serviceIds: string[];
  professionalId: string;
  date: string;
  selecionado: string;
  onSelecionar: (horario: HorarioEscolhido | null) => void;
  ocupadosNaTela?: { inicio: number; fim: number }[];
  excluirAgendamentoId?: string;
  /** Se este horário estiver livre, ele já vem escolhido (ex.: logo depois do serviço anterior). */
  preferir?: string;
  /**
   * Modo composto (reagendar um horário com serviços de profissionais
   * diferentes): cada serviço mantém o seu profissional e a sua distância do
   * início. Os inícios vêm prontos do banco (get_reschedule_starts), que
   * testa cada linha deslocada com as mesmas regras de sempre.
   */
  linhas?: { serviceId: string; professionalId: string; offsetMin: number }[];
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "incompleto" });
  const chave = serviceIds.join(",");

  const chaveLinhas = linhas?.map((l) => `${l.serviceId}:${l.professionalId}:${l.offsetMin}`).join("|") ?? "";

  useEffect(() => {
    if (chaveLinhas && excluirAgendamentoId) {
      if (!date) return setEstado({ tipo: "incompleto" });
      let atual = true;
      setEstado({ tipo: "carregando" });
      horariosParaReagendar(excluirAgendamentoId, date).then((r) => {
        if (!atual) return;
        if (!r.ok) return setEstado({ tipo: "erro", mensagem: r.error });
        setEstado({
          tipo: "pronto",
          horarios: r.data.map((s) => ({
            local: `${businessDate(s.slot_start)}T${formatBusinessTime(s.slot_start)}`,
            inicioIso: s.slot_start,
            fimIso: s.slot_end,
          })),
        });
      });
      return () => {
        atual = false;
      };
    }
    if (!chave || !professionalId || !date) {
      setEstado({ tipo: "incompleto" });
      return;
    }
    let atual = true;
    setEstado({ tipo: "carregando" });
    getAvailableSlots({
      company_id: companyId,
      unit_id: unitId,
      service_id: chave.split(",")[0],
      service_ids: chave.split(","),
      date,
      professional_id: professionalId,
      exclude_appointment_id: excluirAgendamentoId,
    }).then((resultado) => {
      if (!atual) return;
      if (!resultado.ok) {
        setEstado({ tipo: "erro", mensagem: resultado.error });
        return;
      }
      setEstado({
        tipo: "pronto",
        horarios: resultado.data
          .filter((s) => s.professional_id === professionalId)
          .map((s) => ({
            local: `${businessDate(s.slot_start)}T${formatBusinessTime(s.slot_start)}`,
            inicioIso: s.slot_start,
            fimIso: s.slot_end,
          })),
      });
    });
    return () => {
      atual = false;
    };
  }, [companyId, unitId, chave, professionalId, date, excluirAgendamentoId, chaveLinhas]);

  // A chave em texto mantém a lista estável entre renders: quem chama monta
  // um array novo a cada render, e a escolha automática abaixo depende disto.
  const chaveOcupados = ocupadosNaTela.map((o) => `${o.inicio}-${o.fim}`).join("|");
  const livres = useMemo(() => {
    if (estado.tipo !== "pronto") return [];
    const ocupados = chaveOcupados
      ? chaveOcupados.split("|").map((par) => par.split("-").map(Number) as [number, number])
      : [];
    return estado.horarios.filter((h) => {
      const inicio = new Date(h.inicioIso).getTime();
      const fim = new Date(h.fimIso).getTime();
      return !ocupados.some(([oInicio, oFim]) => inicio < oFim && fim > oInicio);
    });
  }, [estado, chaveOcupados]);

  // O horário escolhido some da lista (outro serviço da tela passou a ocupar
  // o mesmo intervalo, ou a data mudou): a escolha é desfeita, nunca mantida
  // escondida. E o horário preferido entra sozinho quando está livre.
  useEffect(() => {
    if (estado.tipo !== "pronto") return;
    if (selecionado && !livres.some((h) => h.local === selecionado)) {
      onSelecionar(null);
      return;
    }
    if (!selecionado && preferir) {
      const preferido = livres.find((h) => h.local === preferir);
      if (preferido) onSelecionar(preferido);
    }
  }, [estado, livres, selecionado, preferir, onSelecionar]);

  if (estado.tipo === "incompleto") {
    return <p className="text-caption text-muted">Escolha o serviço, o profissional e o dia para ver os horários livres.</p>;
  }
  if (estado.tipo === "carregando") {
    return (
      <div role="status" aria-label="Carregando horários livres" className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-9 w-16 rounded-sm bg-surface-muted animate-pulse motion-reduce:animate-none"
            style={{ animationDelay: `calc(${i} * var(--stagger) / 2)` }}
          />
        ))}
      </div>
    );
  }
  if (estado.tipo === "erro") {
    return <Aviso tom="erro">{estado.mensagem}</Aviso>;
  }
  if (livres.length === 0) {
    return (
      <p className="text-body-sm text-muted" role="status">
        Nenhum horário livre neste dia para essa combinação. Tente outro dia ou outro profissional.
      </p>
    );
  }

  return (
    <div className="space-y-3" role="group" aria-label="Horários livres">
      {PERIODOS.map((periodo, p) => {
        const inicioPeriodo = p === 0 ? 0 : PERIODOS[p - 1].ate;
        const doPeriodo = livres.filter((h) => {
          const hora = Number(h.local.slice(11, 13));
          return hora >= inicioPeriodo && hora < periodo.ate;
        });
        if (doPeriodo.length === 0) return null;
        return (
          <div key={periodo.rotulo}>
            <p className="text-micro uppercase tracking-label text-muted mb-1.5">{periodo.rotulo}</p>
            <div className="flex flex-wrap gap-1.5">
              {doPeriodo.map((h) => {
                const ativo = h.local === selecionado;
                return (
                  <button
                    key={h.local}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => onSelecionar(ativo ? null : h)}
                    className={cn(
                      "alvo-toque h-9 min-w-16 px-3 rounded-sm border text-body-sm tabular-nums",
                      "transition-colors duration-fast ease-standard",
                      ativo
                        ? "bg-foreground text-background border-foreground"
                        : "border-border-strong text-foreground hover:border-foreground"
                    )}
                  >
                    {h.local.slice(11, 16)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
