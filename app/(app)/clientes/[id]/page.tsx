import Link from "next/link";
import { formatBusinessDate, formatBusinessDayLabel, formatBusinessTime, businessDate } from "@/lib/time";
import { notFound } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { buttonClasses } from "@/components/ui/button";
import { whatsAppUrl } from "@/lib/whatsapp";
import { mensagemDeRetorno } from "@/lib/crm-regras";
import { createClient } from "@/lib/supabase/server";
import { updateClientRecord } from "@/actions/clientes";
import { ClientForm } from "../ClientForm";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Vazio } from "@/components/ui/estado";
import { formatCurrency } from "@/lib/format";
import { comportamentoDoCliente } from "@/lib/crm";
import { resumoDaFicha, type ItemDaFicha } from "@/lib/ficha-cliente";
import { SituacaoCliente } from "../SituacaoCliente";
import type { Client, Attendance } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_AGENDAMENTO: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Aguardando",
  in_progress: "Em atendimento",
};

type LinhaDeAgendamento = {
  id: string;
  status: string;
  appointment_service: { starts_at: string; is_active: boolean; service: { name: string } | null; professional: { name: string } | null }[];
};

const HISTORICO_CURTO = 15;

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historico?: string }>;
}) {
  const { id } = await params;
  const { historico } = await searchParams;
  const historicoCompleto = historico === "todos";
  const supabase = await createClient();

  const { data: client } = await supabase.from("client").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();
  const c = client as Client;

  const [{ data: attendances }, { data: agendamentos }, { data: identidade }, current] = await Promise.all([
    supabase.from("attendance").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase
      .from("appointment")
      .select("id, status, appointment_service(starts_at, is_active, service:service_id(name), professional:professional_id(name))")
      .eq("client_id", id),
    supabase.from("client_identity").select("id").eq("client_id", id).limit(1).maybeSingle(),
    getCurrentCompany(),
  ]);

  const attendanceList = (attendances ?? []) as Attendance[];
  const completedAttendances = attendanceList.filter((a) => a.status === "completed");
  const attendanceIds = attendanceList.map((a) => a.id);

  const { data: items } = attendanceIds.length
    ? await supabase
        .from("attendance_item")
        .select("attendance_id, kind, final_price, service:service_id(name), professional:professional_id(name), product:product_id(name)")
        .in("attendance_id", attendanceIds)
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemRows = (items ?? []) as any[];
  const concluidos = new Set(completedAttendances.map((a) => a.id));
  const itensConcluidos: ItemDaFicha[] = itemRows
    .filter((i) => concluidos.has(i.attendance_id))
    .map((i) => ({
      attendance_id: i.attendance_id,
      kind: i.kind ?? null,
      final_price: i.final_price,
      servico: i.service?.name ?? null,
      profissional: i.professional?.name ?? null,
    }));
  const resumo = resumoDaFicha(itensConcluidos, completedAttendances.length);

  // A mesma régua da lista de Clientes (lib/crm.ts), sobre as mesmas
  // visitas concluídas — a ficha não pode dizer "ativo" se a lista diz
  // "atenção".
  const visitasMs = completedAttendances
    .map((a) => new Date((a as unknown as { created_at: string }).created_at).getTime())
    .sort((a, b) => a - b);
  const comportamento = visitasMs.length ? comportamentoDoCliente(id, visitasMs, Date.now()) : null;

  // Agenda desta pessoa: o próximo horário marcado e as faltas.
  const agora = Date.now();
  const lista = ((agendamentos ?? []) as unknown as LinhaDeAgendamento[]).map((a) => {
    const ativas = a.appointment_service.filter((l) => l.is_active);
    const linhas = (ativas.length ? ativas : a.appointment_service).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    return { ...a, inicio: linhas[0]?.starts_at ?? null, linhas };
  });
  const proximo = lista
    .filter((a) => a.inicio && STATUS_AGENDAMENTO[a.status] && new Date(a.inicio).getTime() > agora - 60 * 60 * 1000)
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!))[0];
  const faltas = lista.filter((a) => a.status === "no_show").length;
  const cancelouVezes = lista.filter((a) => a.status === "cancelled_by_client").length;

  const telefone = c.phone;
  const updateAction = updateClientRecord.bind(null, id);
  // Contato só com autorização do cliente; o texto é preparado, o envio é da equipe.
  const whatsapp = c.communication_consent
    ? whatsAppUrl(telefone, mensagemDeRetorno(c.name, current?.company.name ?? "barbearia", comportamento?.daysSinceVisit ?? null))
    : null;

  const fatos: { rotulo: string; valor: string; nota?: string }[] = [
    {
      rotulo: "Última visita",
      valor: comportamento?.lastVisit ? formatBusinessDate(comportamento.lastVisit, { day: "2-digit", month: "short" }) : "—",
      nota:
        comportamento?.daysSinceVisit != null
          ? comportamento.daysSinceVisit === 0
            ? "hoje"
            : `há ${comportamento.daysSinceVisit} ${comportamento.daysSinceVisit === 1 ? "dia" : "dias"}`
          : undefined,
    },
    { rotulo: "Visitas", valor: String(resumo.visitas) },
    {
      rotulo: "Frequência",
      valor: comportamento?.avgGapDays != null ? `${comportamento.avgGapDays} dias` : "—",
      nota: comportamento?.avgGapDays != null ? "entre uma visita e outra" : "precisa de 2 visitas",
    },
    { rotulo: "Ticket médio", valor: resumo.ticketMedio != null ? formatCurrency(resumo.ticketMedio) : "—" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      {/* 1. Quem é e como está — a resposta de quem abre a ficha no balcão. */}
      <header>
        <p className="eyebrow mb-3">
          <Link href="/clientes" className="hover:text-foreground">
            Clientes
          </Link>
        </p>
        <h1 className="text-page-title text-foreground text-balance">{c.name}</h1>
        <p className="font-subtitle text-body-sm text-muted mt-2 tabular-nums flex flex-wrap gap-x-3 gap-y-1">
          <span>{telefone || "sem telefone"}</span>
          {c.email && <span className="break-all">{c.email}</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption text-muted">
          {comportamento && <SituacaoCliente status={comportamento.status} />}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={c.communication_consent ? "size-1.5 bg-success" : "size-1.5 border border-border-strong"} />
            {c.communication_consent ? "Aceita contato pelo WhatsApp" : "Sem autorização de contato"}
          </span>
          {identidade && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 bg-brand-blue" />
              Tem conta na página da barbearia
            </span>
          )}
        </div>
        {c.notes && (
          <p className="mt-4 max-w-measure-long border-l-2 border-brand-blue pl-3 text-body-sm text-foreground">{c.notes}</p>
        )}
        {/* O que fazer com esta pessoa agora — as ações que a ficha sustenta. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/agenda/novo?cliente=${id}`} className={buttonClasses({ size: "sm" })}>
            Agendar
          </Link>
          <Link href={`/atendimento/novo?cliente=${id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Atender agora
          </Link>
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {/* 2. O que vem por aí. */}
      <section aria-labelledby="proximo" className="painel p-4 sm:p-5">
        <h2 id="proximo" className="font-subtitle text-caption uppercase tracking-label text-muted">
          Próximo atendimento
        </h2>
        {proximo ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-section-title text-foreground tabular-nums">
                {formatBusinessDayLabel(businessDate(proximo.inicio!), { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
                {formatBusinessTime(proximo.inicio!)}
              </p>
              <p className="text-caption text-muted mt-0.5">
                {[...new Set(proximo.linhas.map((l) => l.service?.name).filter(Boolean))].join(" + ")} ·{" "}
                {[...new Set(proximo.linhas.map((l) => l.professional?.name).filter(Boolean))].join(", ")} ·{" "}
                {STATUS_AGENDAMENTO[proximo.status]}
              </p>
            </div>
            <Link href={`/agenda/${proximo.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Abrir
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-body-sm text-muted">Nada marcado.</p>
        )}
      </section>

      {/* 3. O relacionamento em números — só o que tem base. */}
      <section aria-labelledby="relacao">
        <h2 id="relacao" className="sr-only">
          Relacionamento
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
          {fatos.map((f) => (
            <div key={f.rotulo} className="bg-surface p-4">
              <dt className="font-subtitle text-caption text-muted">{f.rotulo}</dt>
              <dd className="numero text-section-title text-foreground mt-1">{f.valor}</dd>
              {f.nota && <dd className="text-micro text-muted mt-0.5">{f.nota}</dd>}
            </div>
          ))}
        </dl>
        {resumo.visitas > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="painel p-4">
              <p className="font-subtitle text-caption text-muted">Serviços mais usados</p>
              {resumo.servicosMaisUsados.length ? (
                <ul className="mt-2 space-y-1.5">
                  {resumo.servicosMaisUsados.map((s) => (
                    <li key={s.nome} className="flex items-baseline justify-between gap-3 text-body-sm">
                      <span className="text-foreground truncate">{s.nome}</span>
                      <span className="numero text-muted shrink-0">
                        {s.vezes} {s.vezes === 1 ? "vez" : "vezes"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-body-sm text-muted">Só produtos até agora.</p>
              )}
            </div>
            <div className="painel p-4">
              <p className="font-subtitle text-caption text-muted">Profissional preferido</p>
              {resumo.profissionalPreferido ? (
                <p className="mt-2 text-body-sm text-foreground">
                  {resumo.profissionalPreferido.nome}
                  <span className="text-muted"> · {resumo.profissionalPreferido.vezes} visitas</span>
                </p>
              ) : (
                <p className="mt-2 text-body-sm text-muted">Ainda sem preferência clara.</p>
              )}
              <p className="font-subtitle text-caption text-muted mt-4">Gasto total</p>
              <p className="numero text-body text-foreground mt-1">{formatCurrency(resumo.totalGasto)}</p>
            </div>
          </div>
        )}
        {(faltas > 0 || cancelouVezes > 0) && (
          <p className="mt-3 text-caption text-muted">
            {faltas > 0 && `Não compareceu ${faltas} ${faltas === 1 ? "vez" : "vezes"}.`}{" "}
            {cancelouVezes > 0 && `Cancelou ${cancelouVezes} ${cancelouVezes === 1 ? "vez" : "vezes"} pela página.`}
          </p>
        )}
      </section>

      {/* 4. O histórico — o que foi feito, por quanto e por quem. */}
      <section aria-labelledby="historico">
        <h2 id="historico" className="text-section-title text-foreground mb-3">
          Histórico de atendimentos
        </h2>
        <Surface>
          {attendanceList.length > 0 ? (
            (historicoCompleto ? attendanceList : attendanceList.slice(0, HISTORICO_CURTO)).map((a) => {
              const itens = itemRows.filter((i) => i.attendance_id === a.id);
              const oQueFoiFeito = [...new Set(itens.map((i) => i.service?.name ?? i.product?.name).filter(Boolean))].join(" + ");
              const quemFez = [...new Set(itens.map((i) => i.professional?.name).filter(Boolean))].join(", ");
              const valor = itens.reduce((soma, i) => soma + Number(i.final_price), 0);
              const criadoEm = (a as unknown as { created_at: string }).created_at;

              return (
                <SurfaceRow key={a.id} className="flex items-baseline gap-4">
                  <span className="text-body-sm tabular-nums text-muted shrink-0 w-20">
                    {formatBusinessDate(criadoEm, { day: "2-digit", month: "short", year: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm text-foreground truncate">
                      {oQueFoiFeito || STATUS_LABEL[a.status] || "Atendimento"}
                    </span>
                    {quemFez && <span className="block text-caption text-muted truncate">{quemFez}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    {valor > 0 && <span className="block text-body-sm tabular-nums text-foreground">{formatCurrency(valor)}</span>}
                    {a.status !== "completed" && (
                      <span className="block text-caption text-muted">{STATUS_LABEL[a.status] ?? a.status}</span>
                    )}
                  </span>
                </SurfaceRow>
              );
            })
          ) : (
            <Vazio
              titulo="Nenhum atendimento ainda"
              descricao="Assim que o primeiro atendimento for concluído, o que foi feito, por quanto e por quem passa a ficar registrado aqui."
            />
          )}
        </Surface>
        {!historicoCompleto && attendanceList.length > HISTORICO_CURTO && (
          <Link href={`/clientes/${id}?historico=todos#historico`} className={buttonClasses({ variant: "ghost", size: "sm", className: "mt-2" })}>
            Ver todos os {attendanceList.length} atendimentos
          </Link>
        )}
      </section>

      {/* 5. Os dados cadastrais — necessários de vez em quando, não a cada
          visita. Ficam recolhidos até alguém precisar editar. */}
      <details className="group painel">
        <summary className="alvo-toque flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-body-sm font-medium text-foreground">
          Dados, observações e consentimento
          <span aria-hidden="true" className="text-caption text-muted group-open:hidden">
            Editar
          </span>
          <span aria-hidden="true" className="hidden text-caption text-muted group-open:inline">
            Fechar
          </span>
        </summary>
        <div className="border-t border-border px-4 py-5">
          <ClientForm
            action={updateAction}
            modo="editar"
            valores={{
              name: client.name,
              phone: client.phone,
              email: client.email,
              birth_date: client.birth_date,
              notes: client.notes,
              communication_consent: client.communication_consent,
            }}
          />
        </div>
      </details>
    </div>
  );
}
