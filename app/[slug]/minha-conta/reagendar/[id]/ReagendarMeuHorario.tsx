"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { horariosParaMeuReagendamento, reagendarMeuHorario } from "@/actions/cliente";
import { businessDate, formatBusinessDayLabel, formatBusinessTime } from "@/lib/time";
import { Aviso } from "@/components/ui/estado";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Estado = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; inicios: string[] };

/**
 * O cliente escolhe outro dia e um dos inícios que o banco confirmou como
 * livres para todo o horário (todos os serviços, com os mesmos
 * profissionais). Ao confirmar, o horário volta para "Aguardando
 * confirmação" até a barbearia reconfirmar.
 */
export function ReagendarMeuHorario({
  slug,
  appointmentId,
  diaInicial,
  hoje,
  dias,
}: {
  slug: string;
  appointmentId: string;
  diaInicial: string;
  hoje: string;
  dias: string[];
}) {
  const router = useRouter();
  const [dia, setDia] = useState(diaInicial);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let atual = true;
    setEstado({ tipo: "carregando" });
    setEscolhido(null);
    horariosParaMeuReagendamento(slug, appointmentId, dia).then((r) => {
      if (!atual) return;
      if (!r.ok) return setEstado({ tipo: "erro", mensagem: r.error });
      setEstado({ tipo: "pronto", inicios: r.data.map((s) => s.slot_start) });
    });
    return () => {
      atual = false;
    };
  }, [slug, appointmentId, dia]);

  async function confirmar() {
    if (!escolhido) return;
    setErro(null);
    setEnviando(true);
    const r = await reagendarMeuHorario({ slug, appointmentId, startsAt: escolhido });
    setEnviando(false);
    if (!r.ok) return setErro(r.error);
    router.push(`/${slug}/minha-conta?reagendado=1`);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-subtitle text-caption text-muted mb-2">Dia</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Escolha o dia">
          {dias.map((d) => {
            const ativo = d === dia;
            return (
              <button
                key={d}
                type="button"
                data-dia={d}
                aria-pressed={ativo}
                onClick={() => setDia(d)}
                className={cn(
                  "shrink-0 w-14 py-2 rounded-sm border text-center transition-colors duration-micro",
                  ativo ? "bg-foreground text-background border-foreground" : "border-border-strong text-foreground hover:border-foreground"
                )}
              >
                <span className="block font-subtitle text-micro uppercase">{formatBusinessDayLabel(d, { weekday: "short" }).replace(".", "")}</span>
                <span className="block numero text-body mt-0.5">{d.slice(8, 10)}</span>
                {d === hoje && <span className="block text-micro opacity-70">hoje</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-subtitle text-caption text-muted mb-2">
          Horários livres em {formatBusinessDayLabel(dia, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        {estado.tipo === "carregando" ? (
          <div role="status" aria-label="Carregando horários" className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="h-10 w-16 rounded-sm bg-surface-muted animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : estado.tipo === "erro" ? (
          <Aviso tom="erro">{estado.mensagem}</Aviso>
        ) : estado.inicios.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum horário livre neste dia. Tente outro dia.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Horários livres">
            {estado.inicios.map((iso) => {
              const ativo = iso === escolhido;
              return (
                <button
                  key={iso}
                  type="button"
                  data-horario={iso}
                  aria-pressed={ativo}
                  onClick={() => setEscolhido(ativo ? null : iso)}
                  className={cn(
                    "h-10 min-w-16 px-3 rounded-sm border text-body-sm tabular-nums transition-colors duration-micro",
                    ativo ? "bg-primary text-primary-foreground border-primary" : "border-border-strong text-foreground hover:border-foreground"
                  )}
                >
                  {formatBusinessTime(iso)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="pt-2 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={confirmar} disabled={!escolhido} pending={enviando}>
          {enviando
            ? "Mudando…"
            : escolhido
              ? `Mudar para ${formatBusinessDayLabel(businessDate(escolhido), { day: "numeric", month: "short" })}, ${formatBusinessTime(escolhido)}`
              : "Escolha um horário"}
        </Button>
        <p className="text-caption text-muted">A barbearia confirma o novo horário com você.</p>
      </div>
    </div>
  );
}
