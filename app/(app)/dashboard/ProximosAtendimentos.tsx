import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { businessDayBounds, businessToday, formatBusinessTime } from "@/lib/time";
import { buttonClasses } from "@/components/ui/button";
import { rotularHomonimos } from "@/lib/pessoas";
import { cn } from "@/lib/cn";
import type { AppointmentStatus } from "@/lib/types";

/**
 * O que está acontecendo agora, e o que vem logo depois.
 *
 * Esta era a lacuna registrada na R08: o Início respondia "como foi o
 * período" e não respondia "e agora?". Um resumo que só olha para trás serve
 * ao dono no fim do mês; quem abre o sistema às 9h da manhã precisa da
 * próxima hora.
 *
 * A leitura é deliberadamente assimétrica. O atendimento em curso ocupa o
 * lugar de destaque, com o amarelo do sistema; os próximos vêm como lista
 * densa, em ordem de relógio. Nada aqui é card: é hora, nome e ação, que é
 * exatamente o que se lê de relance atrás de um balcão.
 *
 * Só leitura — nenhuma regra nova. Consulta a mesma `appointment_service`
 * que a Agenda usa, com os mesmos limites de dia comercial.
 */
const STATUS_LABEL: Partial<Record<AppointmentStatus, string>> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Aguardando",
  in_progress: "Em atendimento",
};

export async function ProximosAtendimentos({ companyId }: { companyId: string }) {
  const supabase = await createClient();
  const hoje = businessToday();
  const { start, end } = businessDayBounds(hoje);
  const agora = Date.now();

  const { data: linhas } = await supabase
    .from("appointment_service")
    .select(
      "id, starts_at, service:service_id(name), professional:professional_id(id, name, role_title, phone), appointment:appointment_id(id, status, client:client_id(id, name, phone))"
    )
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todas = (linhas ?? []) as any[];

  // Homônimos continuam distinguíveis aqui pela mesma regra do resto do
  // sistema: identificador secundário só quando há repetição.
  const rotuloProf = new Map(
    rotularHomonimos(todas.map((l) => l.professional).filter((p) => p?.id)).map((p) => [p.id, p.name])
  );
  const rotuloCliente = new Map(
    rotularHomonimos(todas.map((l) => l.appointment?.client).filter((c) => c?.id)).map((c) => [c.id, c.name])
  );

  const emCurso = todas.filter((l) => l.appointment?.status === "in_progress");
  const adiante = todas
    .filter(
      (l) =>
        ["scheduled", "confirmed", "arrived"].includes(l.appointment?.status) &&
        new Date(l.starts_at).getTime() >= agora - 15 * 60_000
    )
    .slice(0, 6);

  if (emCurso.length === 0 && adiante.length === 0) {
    return (
      <section className="border-t border-border pt-6">
        <Cabecalho />
        <p className="text-body-sm text-muted mt-4">
          Nada mais marcado para hoje.{" "}
          <Link href="/agenda/novo" className="text-foreground underline underline-offset-4 decoration-signal">
            Marcar um horário
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-border pt-6">
      <Cabecalho />

      {emCurso.length > 0 && (
        <div className="mt-4 space-y-px">
          {emCurso.map((l) => (
            <EmCurso
              key={l.id}
              hora={formatBusinessTime(l.starts_at)}
              cliente={rotuloCliente.get(l.appointment?.client?.id) ?? l.appointment?.client?.name ?? "Cliente"}
              servico={l.service?.name}
              profissional={rotuloProf.get(l.professional?.id) ?? l.professional?.name}
              href={`/agenda?date=${hoje}`}
            />
          ))}
        </div>
      )}

      {adiante.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {adiante.map((l, i) => {
            const inicio = new Date(l.starts_at).getTime();
            const minutos = Math.round((inicio - agora) / 60_000);
            return (
              <Proximo
                key={l.id}
                primeiro={i === 0 && emCurso.length === 0}
                hora={formatBusinessTime(l.starts_at)}
                minutos={minutos}
                cliente={rotuloCliente.get(l.appointment?.client?.id) ?? l.appointment?.client?.name ?? "Cliente"}
                servico={l.service?.name}
                profissional={rotuloProf.get(l.professional?.id) ?? l.professional?.name}
                status={l.appointment?.status}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Cabecalho() {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-label uppercase text-muted">Agora e a seguir</h2>
      <Link
        href="/agenda"
        className="text-caption text-muted hover:text-foreground transition-colors duration-fast ease-standard"
      >
        Ver agenda
      </Link>
    </div>
  );
}

/**
 * O atendimento em curso. É o único bloco do Início que inverte — tinta
 * escura sobre amarelo — porque é o único que responde "o que está
 * acontecendo neste segundo".
 */
function EmCurso({
  hora,
  cliente,
  servico,
  profissional,
  href,
}: {
  hora: string;
  cliente: string;
  servico?: string;
  profissional?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 bg-signal text-signal-foreground rounded-md px-4 py-3.5 transition-transform duration-fast ease-standard active:scale-[0.995]"
    >
      <span className="text-body-sm font-medium tabular-nums shrink-0 opacity-80">{hora}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium truncate">{cliente}</span>
        <span className="block text-caption opacity-80 truncate">
          {[servico, profissional].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-label uppercase shrink-0 tabular-nums">em atendimento</span>
    </Link>
  );
}

function Proximo({
  primeiro,
  hora,
  minutos,
  cliente,
  servico,
  profissional,
  status,
}: {
  primeiro: boolean;
  hora: string;
  minutos: number;
  cliente: string;
  servico?: string;
  profissional?: string;
  status: AppointmentStatus;
}) {
  // "faltam 12 min" diz mais do que "10:30" para quem está no balcão; a hora
  // continua ali para quem quer a referência absoluta.
  const proximidade =
    minutos < 0 ? "atrasado" : minutos === 0 ? "agora" : minutos < 60 ? `em ${minutos} min` : null;

  return (
    <li className="flex items-center gap-4 py-3">
      <span
        aria-hidden="true"
        className={cn("w-0.5 self-stretch shrink-0 rounded-full", primeiro ? "bg-signal" : "bg-transparent")}
      />
      <span
        className={cn(
          "text-body-sm tabular-nums shrink-0 w-11",
          primeiro ? "text-foreground font-medium" : "text-muted"
        )}
      >
        {hora}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-sm font-medium text-foreground truncate">{cliente}</span>
        <span className="block text-caption text-muted truncate">
          {[servico, profissional].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-caption text-right">
        {minutos < 0 ? (
          <span className="text-danger-ink">atrasado</span>
        ) : (
          <span className="text-muted">{proximidade ?? STATUS_LABEL[status]}</span>
        )}
      </span>
    </li>
  );
}

export function AtalhoAgenda() {
  return (
    <Link href="/agenda/novo" className={buttonClasses({ variant: "secondary", size: "sm" })}>
      Novo agendamento
    </Link>
  );
}
