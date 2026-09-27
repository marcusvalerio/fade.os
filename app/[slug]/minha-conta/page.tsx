import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/tenancy";
import { perfilDoCliente, meusAgendamentos, sairDaContaDeCliente, type MeuAgendamento } from "@/actions/cliente";
import { Aviso, Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { formatBusinessDayLabel, formatBusinessTime, businessDate } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Meus horários" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { rotulo: string; quadrado: string }> = {
  scheduled: { rotulo: "Aguardando confirmação", quadrado: "border border-border-strong" },
  confirmed: { rotulo: "Confirmado", quadrado: "bg-signal" },
  arrived: { rotulo: "Você chegou", quadrado: "bg-warning" },
  in_progress: { rotulo: "Em atendimento", quadrado: "bg-signal" },
  completed: { rotulo: "Concluído", quadrado: "bg-success" },
  cancelled_by_client: { rotulo: "Cancelado por você", quadrado: "border border-border-strong" },
  cancelled_by_company: { rotulo: "Cancelado pela barbearia", quadrado: "border border-border-strong" },
  no_show: { rotulo: "Não compareceu", quadrado: "bg-danger" },
};

/**
 * A área do cliente final nesta barbearia. Tudo aqui vem de funções do banco
 * filtradas pela identidade de quem entrou (get_my_client_appointments) — o
 * cliente não lê nenhuma tabela operacional. Ver, cancelar e avaliar usam a
 * mesma página de agendamento do link de confirmação.
 */
export default async function MinhaContaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/${slug}/entrar`);

  const perfil = await perfilDoCliente(slug);
  const sair = sairDaContaDeCliente.bind(null, slug);

  if (!perfil.ok) {
    return (
      <div className="shell py-12 sm:py-16">
        <div className="mx-auto max-w-lg space-y-5">
          <Aviso tom="atencao" titulo="Não foi possível abrir a sua conta">
            {perfil.error}
          </Aviso>
          <form action={sair}>
            <button type="submit" className={buttonClasses({ variant: "secondary" })}>
              Sair
            </button>
          </form>
        </div>
      </div>
    );
  }

  const lista = await meusAgendamentos(slug);
  const agora = Date.now();
  const todos = lista.ok ? lista.data : [];
  const ativos = ["scheduled", "confirmed", "arrived", "in_progress"];
  const proximos = todos
    .filter((a) => ativos.includes(a.status) && new Date(a.ends_at).getTime() > agora)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const historico = todos.filter((a) => !proximos.includes(a));
  const primeiroNome = perfil.data.client_name.split(/\s+/)[0];

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-label uppercase tracking-label text-muted">{perfil.data.company_name}</p>
            <h1 className="text-page-title font-heading text-foreground mt-1">Olá, {primeiroNome}.</h1>
            <p className="text-body-sm text-muted mt-1">{perfil.data.client_email}</p>
          </div>
          <form action={sair}>
            <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Sair
            </button>
          </form>
        </div>

        {!lista.ok && (
          <div className="mt-6">
            <Aviso tom="erro">{lista.error}</Aviso>
          </div>
        )}

        <section className="mt-8" aria-labelledby="proximos">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 id="proximos" className="text-section-title text-foreground">
              Próximos horários
            </h2>
            <Link href={`/${slug}/agendar`} className={buttonClasses({ size: "sm" })}>
              Marcar horário
            </Link>
          </div>
          {proximos.length === 0 ? (
            <div className="rounded-md border border-border bg-surface">
              <Vazio titulo="Nenhum horário marcado" descricao="Quando você marcar, ele aparece aqui." />
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {proximos.map((a, i) => (
                <Linha key={a.appointment_id} a={a} slug={slug} destaque={i === 0} />
              ))}
            </ul>
          )}
        </section>

        {historico.length > 0 && (
          <section className="mt-10" aria-labelledby="historico">
            <h2 id="historico" className="text-section-title text-foreground mb-3">
              Histórico
            </h2>
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {historico.map((a) => (
                <Linha key={a.appointment_id} a={a} slug={slug} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Linha({ a, slug, destaque = false }: { a: MeuAgendamento; slug: string; destaque?: boolean }) {
  const status = STATUS[a.status] ?? { rotulo: a.status, quadrado: "border border-border-strong" };
  const encerrado = !["scheduled", "confirmed", "arrived", "in_progress"].includes(a.status);
  const acao =
    a.status === "completed" ? "Avaliar" : a.status === "scheduled" || a.status === "confirmed" ? "Ver ou cancelar" : "Ver";
  return (
    <li className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3.5", encerrado && "opacity-70")}>
      <div className="min-w-0">
        <p className={cn("text-foreground tabular-nums", destaque ? "font-semibold" : "font-medium")}>
          {formatBusinessDayLabel(businessDate(a.starts_at), { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
          {formatBusinessTime(a.starts_at)}
        </p>
        <p className="text-caption text-muted mt-0.5 truncate">
          {a.services} · {a.professional_name}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-caption font-medium text-muted">
          <span aria-hidden="true" className={cn("size-1.5", status.quadrado)} />
          {status.rotulo}
        </span>
        <Link
          href={`/${slug}/agendamentos/${a.client_access_token}`}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {acao}
        </Link>
      </div>
    </li>
  );
}
