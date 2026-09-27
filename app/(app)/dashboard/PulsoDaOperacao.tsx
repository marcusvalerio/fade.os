import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientBehaviors } from "@/lib/crm";
import { businessDayBounds, businessToday, formatBusinessTime } from "@/lib/time";
import { formatCurrency } from "@/lib/format";
import { sinaisDoPulso, agoraEmUmaFrase, type Tom } from "@/lib/pulso";
import { cn } from "@/lib/cn";

const QUADRADO: Record<Tom, string> = {
  perigo: "bg-danger",
  atencao: "bg-warning",
  info: "bg-signal",
  neutro: "border border-border-strong",
};

/**
 * O Pulso da operação — a resposta a "o que está acontecendo agora?".
 *
 * É o conceito da landing trazido para dentro, sem animação decorativa: uma
 * frase com o agora (quem está na cadeira, quem espera, o próximo) e os
 * sinais que pedem ação, em ordem de urgência, cada um com o lugar onde se
 * resolve. Tudo sai do banco neste request — agenda do dia, atendimentos
 * abertos, caixa, ritmo dos clientes, estoque e comissões. Nada é enviado a
 * ninguém; o CORTEX mostra, a equipe decide.
 */
export async function PulsoDaOperacao({ companyId, estoqueCritico }: { companyId: string; estoqueCritico: number }) {
  const supabase = await createClient();
  const hoje = businessToday();
  const { start, end } = businessDayBounds(hoje);
  const agora = Date.now();

  const [{ data: linhas }, { count: esquecidos }, { data: caixa }, { data: comissoes }, comportamentos] = await Promise.all([
    supabase
      .from("appointment_service")
      .select("starts_at, appointment:appointment_id(id, status, client:client_id(name))")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "in_progress")
      .lt("created_at", start.toISOString()),
    supabase.from("cash_session").select("id").eq("company_id", companyId).eq("status", "open").limit(1),
    supabase.from("commission").select("amount").eq("company_id", companyId).eq("status", "due"),
    getClientBehaviors(companyId),
  ]);

  // Um agendamento com dois serviços são duas linhas: conta-se o agendamento.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porAgendamento = new Map<string, { status: string; inicio: number; cliente: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((linhas ?? []) as any[]).forEach((l) => {
    const id = l.appointment?.id;
    if (!id || porAgendamento.has(id)) return;
    porAgendamento.set(id, { status: l.appointment.status, inicio: new Date(l.starts_at).getTime(), cliente: l.appointment.client?.name ?? "Cliente" });
  });
  const ags = Array.from(porAgendamento.values());
  const conta = (s: string[]) => ags.filter((a) => s.includes(a.status)).length;
  const proximoAg = ags
    .filter((a) => ["scheduled", "confirmed"].includes(a.status) && a.inicio >= agora)
    .sort((a, b) => a.inicio - b.inicio)[0];

  const dados = {
    emAtendimento: conta(["in_progress"]),
    aguardando: conta(["arrived"]),
    restantes: ags.filter((a) => ["scheduled", "confirmed"].includes(a.status) && a.inicio >= agora).length,
    concluidos: conta(["completed"]),
    atrasados: ags.filter((a) => ["scheduled", "confirmed"].includes(a.status) && a.inicio < agora - 10 * 60_000).length,
    pendentesConfirmacao: ags.filter((a) => a.status === "scheduled" && a.inicio >= agora).length,
    atendimentosEsquecidos: esquecidos ?? 0,
    caixaAberto: (caixa ?? []).length > 0,
    atendimentosHoje: ags.length,
    clientesParaChamar: Array.from(comportamentos.values()).filter((c) => c.status === "atencao" || c.status === "recuperacao").length,
    estoqueCritico,
    comissoesDevidas: (comissoes ?? []).reduce((s, c) => s + Number(c.amount), 0),
  };

  const sinais = sinaisDoPulso(dados, formatCurrency);
  const frase = agoraEmUmaFrase(
    dados,
    proximoAg ? { hora: formatBusinessTime(new Date(proximoAg.inicio).toISOString()), cliente: proximoAg.cliente } : null
  );

  return (
    <section aria-labelledby="pulso-titulo" className="material-solid rounded-lg overflow-hidden">
      <div className="px-5 py-4 sm:px-6 border-b border-border flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-3 min-w-0">
          <span aria-hidden="true" className="pulso-vivo size-2 shrink-0 bg-signal" />
          <div className="min-w-0">
            <h2 id="pulso-titulo" className="text-label uppercase tracking-label text-muted">
              Pulso da operação · {formatBusinessTime(new Date(agora).toISOString())}
            </h2>
            <p className="text-body font-medium text-foreground mt-0.5">{frase}</p>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted tabular-nums">
          <div className="flex gap-1.5"><dt>Restantes</dt><dd className="text-foreground font-medium">{dados.restantes}</dd></div>
          <div className="flex gap-1.5"><dt>Concluídos</dt><dd className="text-foreground font-medium">{dados.concluidos}</dd></div>
          <div className="flex gap-1.5"><dt>Caixa</dt><dd className={cn("font-medium", dados.caixaAberto ? "text-success-ink" : "text-foreground")}>{dados.caixaAberto ? "aberto" : "fechado"}</dd></div>
        </dl>
      </div>
      {sinais.length === 0 ? (
        <p className="px-5 sm:px-6 py-4 text-body-sm text-muted">Nada pedindo atenção agora.</p>
      ) : (
        <ul className="divide-y divide-border">
          {sinais.map((s, i) => (
            <li
              key={s.chave}
              className="animate-rise-in motion-reduce:animate-none"
              style={{ animationDelay: `calc(${i} * var(--stagger))` }}
            >
              <Link
                href={s.href}
                className="alvo-toque group flex items-start gap-3 px-5 sm:px-6 py-3.5 transition-colors duration-fast ease-standard hover:bg-surface-muted"
              >
                <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0", QUADRADO[s.tom])} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-medium text-foreground">{s.titulo}</span>
                  <span className="block text-caption text-muted mt-0.5">{s.detalhe}</span>
                </span>
                <span className="text-caption text-muted group-hover:text-foreground shrink-0 mt-0.5 hidden sm:inline">
                  {s.acao} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
