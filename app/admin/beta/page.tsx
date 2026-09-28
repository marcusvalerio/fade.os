import Link from "next/link";
import { empresasNoBeta, funilDoBetaNoBanco, haQuanto, type EmpresaNoBeta, type EstadoNoBeta, type FunilDoBetaNoBanco } from "@/lib/admin";
import { funilDoBeta } from "@/lib/admin-saude";
import { lerErrosDoSentry } from "@/lib/sentry-leitura";
import { cn } from "@/lib/cn";

const ESTADOS: { chave: EstadoNoBeta; rotulo: string; explica: string; marca: string }[] = [
  { chave: "parada", rotulo: "Parada", explica: "sem operação há mais de 14 dias", marca: "bg-warning" },
  { chave: "sem_uso", rotulo: "Sem uso", explica: "configurou e nunca operou", marca: "bg-warning" },
  { chave: "esfriando", rotulo: "Esfriando", explica: "última operação entre 7 e 14 dias", marca: "border-[1.5px] border-warning" },
  { chave: "configurando", rotulo: "Configurando", explica: "primeira configuração não concluída", marca: "border border-border-strong" },
  { chave: "ativa", rotulo: "Ativa", explica: "operou nos últimos 7 dias", marca: "bg-primary" },
  { chave: "suspensa", rotulo: "Suspensa", explica: "acesso suspenso pela plataforma", marca: "bg-border-strong" },
];

const MODULOS_MEDIDOS = 7; // os mesmos de admin_company_activity.modulos_usados
const DIA = 86400000;

/**
 * Beta — cada barbearia que entrou, desde quando, se ainda entra, se opera,
 * o que usa, o que respondeu e quantos erros gerou. Agrupado por estado
 * para triagem; dentro do grupo, pela data de entrada (não por volume).
 */
export default async function AdminBetaPage() {
  const [empresas, erros, funil] = await Promise.all([empresasNoBeta(30), lerErrosDoSentry("production"), funilDoBetaNoBanco()]);
  if (!empresas) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar o beta.</p>
      </div>
    );
  }

  const agora = Date.now();
  const grupos = ESTADOS.map((e) => ({ ...e, itens: empresas.filter((x) => x.estado === e.chave) })).filter((g) => g.itens.length > 0);
  const ativas = empresas.filter((e) => e.estado === "ativa").length;
  const emRisco = empresas.filter((e) => e.estado === "parada" || e.estado === "sem_uso" || e.estado === "esfriando").length;
  const responderam = empresas.filter((e) => e.pesquisas_respondidas > 0).length;
  const errosPor = erros.estado === "ok" ? erros.porEmpresa : null;

  return (
    <div className="space-y-6">
      <header className="animate-rise-in max-w-3xl">
        <p className="eyebrow">Beta</p>
        <h1 className="text-page-title text-foreground mt-2.5">Barbearias no beta</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Entrada pelo convite aprovado (ou pela criação da conta, quando veio direto). Operação = agendamento, atendimento, venda ou caixa registrados. Últimos 30 dias.
        </p>
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
        {[
          ["No beta", String(empresas.length)],
          ["Operando", String(ativas)],
          ["Pedem contato", String(emRisco)],
          ["Responderam pesquisa", String(responderam)],
        ].map(([r, v]) => (
          <div key={r} className="bg-surface p-4">
            <dt className="font-subtitle text-caption text-muted">{r}</dt>
            <dd className="numero text-metric-sm text-foreground mt-2">{v}</dd>
          </div>
        ))}
      </dl>

      {funil && <FunilDoBeta funil={funil} empresas={empresas} />}

      {erros.estado !== "ok" && (
        <p className="text-caption text-muted">
          Erros por barbearia: {erros.estado === "nao_conectado" ? "leitura do Sentry não conectada (falta SENTRY_API_TOKEN no servidor)" : `indisponível — ${erros.motivo}`}.
        </p>
      )}

      {grupos.map((g) => (
        <section key={g.chave} className="painel overflow-hidden" aria-labelledby={`g-${g.chave}`}>
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-5 pb-3">
            <h2 id={`g-${g.chave}`} className="flex items-center gap-2 text-section-title text-foreground">
              <span aria-hidden className={cn("size-2.5", g.marca)} />
              {g.rotulo}
              <span className="mono text-caption text-muted">{g.itens.length}</span>
            </h2>
            <p className="text-caption text-muted">{g.explica}</p>
          </header>
          <div className="hidden xl:grid grid-cols-[minmax(0,1.8fr)_6rem_7rem_7rem_6rem_7rem_6rem_6rem] gap-3 px-5 py-2 border-y border-border text-micro font-subtitle text-muted">
            <span>Barbearia</span>
            <span className="text-right">No beta</span>
            <span className="text-right">Último acesso</span>
            <span className="text-right">Última operação</span>
            <span className="text-right">Módulos</span>
            <span className="text-right">Agend. · atend.</span>
            <span className="text-right">Pesquisas</span>
            <span className="text-right">Erros 30d</span>
          </div>
          <ul className="divide-y divide-border xl:divide-y-0 border-t border-border xl:border-t-0">
            {g.itens.map((e) => (
              <LinhaDoBeta key={e.id} e={e} agora={agora} erros={errosPor ? (errosPor[e.id] ?? 0) : null} />
            ))}
          </ul>
        </section>
      ))}

      {funil && <Dificuldades itens={funil.dificuldades} />}
    </div>
  );
}

/**
 * Solicitação → aprovação → utilização → abandono → feedback. Informação,
 * não notificação: só o pedido novo e o pedido parado há 48 h viram aviso.
 */
function FunilDoBeta({ funil, empresas }: { funil: FunilDoBetaNoBanco; empresas: EmpresaNoBeta[] }) {
  const etapas = funilDoBeta(funil.solicitacoes, empresas);
  const topo = Math.max(etapas[0]?.valor ?? 0, 1);
  const s = funil.solicitacoes;
  return (
    <section id="funil" className="painel overflow-hidden scroll-mt-6" aria-labelledby="funil-titulo">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id="funil-titulo" className="text-section-title text-foreground">Funil do Beta</h2>
        <Link href="/admin/acessos" className="text-caption text-muted underline-offset-4 hover:text-foreground hover:underline">
          Solicitações
        </Link>
      </div>
      <ol className="grid gap-px bg-border border-y border-border sm:grid-cols-5">
        {etapas.map((e) => (
          <li key={e.chave} className="bg-surface p-4 min-w-0">
            <p className="font-subtitle text-micro text-muted truncate">{e.rotulo}</p>
            <p className="numero text-metric-sm text-foreground mt-1.5">{e.valor}</p>
            <span aria-hidden className="mt-2 block h-1 bg-surface-muted">
              <span className="block h-full bg-chart" style={{ width: `${Math.min(100, (e.valor / topo) * 100)}%` }} />
            </span>
            <p className="text-micro text-muted mt-1.5">{e.detalhe}</p>
          </li>
        ))}
      </ol>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 px-5 py-4 text-caption">
        {[
          ["Pendentes", String(s.pending ?? 0)],
          ["Aprovadas", String(s.approved ?? 0)],
          ["Rejeitadas", String(s.rejected ?? 0)],
          ["Esperando há +48 h", String(funil.aguardando_48h)],
          ["Recebidas em 30 dias", String(funil.recebidas_30d)],
          ["Pendente mais antiga", funil.pendente_mais_antiga ? haQuanto(funil.pendente_mais_antiga) : "—"],
          ["Tempo até aprovar (mediana)", funil.horas_ate_aprovar === null ? "—" : funil.horas_ate_aprovar < 48 ? `${funil.horas_ate_aprovar} h` : `${Math.round(funil.horas_ate_aprovar / 24)} dias`],
        ].map(([r, v]) => (
          <div key={r} className="min-w-0">
            <dt className="text-muted truncate">{r}</dt>
            <dd className="numero text-foreground mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** O que as pesquisas dizem que está difícil (nota 1–2, "não" ou texto). */
function Dificuldades({ itens }: { itens: FunilDoBetaNoBanco["dificuldades"] }) {
  return (
    <section id="dificuldades" className="painel overflow-hidden scroll-mt-6" aria-labelledby="dificuldades-titulo">
      <div className="px-5 pt-5 pb-3">
        <h2 id="dificuldades-titulo" className="text-section-title text-foreground">Feedbacks e dificuldades</h2>
        <p className="text-caption text-muted mt-1">Últimos 90 dias: respostas negativas e comentários das pesquisas. Sem o nome de quem respondeu.</p>
      </div>
      {itens.length === 0 ? (
        <p className="px-5 pb-5 text-caption text-muted">Nenhum comentário ou resposta negativa ainda.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {itens.map((d, i) => (
            <li key={`${d.pesquisa_id}-${i}`} className="px-5 py-3">
              <p className="text-body-sm text-foreground">{d.texto ?? (d.negativa ? "Resposta negativa, sem comentário." : "—")}</p>
              <p className="text-caption text-muted mt-0.5">
                {d.negativa && <span className="text-warning-ink">dificuldade · </span>}
                <Link href={`/admin/pesquisas/${d.pesquisa_id}`} className="underline-offset-4 hover:underline">
                  {d.pesquisa}
                </Link>
                {d.funcionalidade ? ` · ${d.funcionalidade}` : ""}
                {d.empresa ? ` · ${d.empresa}` : ""} · {d.publico} · {haQuanto(d.em)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaDoBeta({ e, agora, erros }: { e: EmpresaNoBeta; agora: number; erros: number | null }) {
  const diasNoBeta = Math.max(0, Math.floor((agora - new Date(e.entrou_em).getTime()) / DIA));
  const expira = e.beta_expira_em ? Math.ceil((new Date(e.beta_expira_em).getTime() - agora) / DIA) : null;
  const celula = "flex justify-between gap-3 xl:block xl:text-right";
  const rotulo = "text-caption text-muted xl:sr-only";
  return (
    <li className="grid gap-x-8 gap-y-1.5 px-5 py-3.5 md:grid-cols-2 xl:gap-x-3 xl:grid-cols-[minmax(0,1.8fr)_6rem_7rem_7rem_6rem_7rem_6rem_6rem] xl:items-center xl:py-3 xl:border-b xl:border-border xl:last:border-b-0">
      <span className="min-w-0 md:col-span-2 xl:col-span-1">
        <Link href={`/admin/empresas/${e.id}`} className="block truncate text-body-sm font-medium text-foreground hover:underline underline-offset-4">
          {e.name}
        </Link>
        <span className="block text-caption text-muted truncate">
          {e.origem === "convite_beta" ? "convite" : "cadastro direto"}
          {expira !== null && e.beta_status === "approved" && <> · {expira >= 0 ? `beta até ${expira} dias` : "beta vencido"}</>}
          {e.beta_status === "revoked" && <> · beta revogado</>}
          {` · ${e.usuarios} ${e.usuarios === 1 ? "acesso" : "acessos"}`}
        </span>
      </span>
      <span className={celula}>
        <span className={rotulo}>No beta</span>
        <span className="mono text-caption text-foreground">{diasNoBeta} d</span>
      </span>
      <span className={celula}>
        <span className={rotulo}>Último acesso</span>
        <span className={cn("mono text-caption", (e.dias_sem_acesso ?? 0) >= 10 ? "text-danger-ink" : (e.dias_sem_acesso ?? 0) >= 7 ? "text-warning-ink" : "text-muted")}>{haQuanto(e.ultimo_acesso)}</span>
      </span>
      <span className={celula}>
        <span className={rotulo}>Última operação</span>
        <span className="mono text-caption text-muted">{haQuanto(e.ultima_atividade)}</span>
      </span>
      <span className={celula}>
        <span className={rotulo}>Módulos</span>
        <span className="inline-flex items-center gap-1.5 xl:justify-end" aria-label={`${e.modulos_usados} de ${MODULOS_MEDIDOS} módulos usados em 30 dias`}>
          <span aria-hidden className="flex gap-px">
            {Array.from({ length: MODULOS_MEDIDOS }, (_, i) => (
              <span key={i} className={cn("h-2.5 w-1", i < e.modulos_usados ? "bg-primary" : "bg-surface-muted")} />
            ))}
          </span>
          <span className="mono text-caption text-foreground">{e.modulos_usados}</span>
        </span>
      </span>
      <span className={celula}>
        <span className={rotulo}>Agend. · atend.</span>
        <span className="mono text-caption text-foreground">
          {e.agendamentos_periodo} · {e.atendimentos_periodo}
        </span>
      </span>
      <span className={celula}>
        <span className={rotulo}>Pesquisas</span>
        <span className="mono text-caption text-foreground">
          {e.pesquisas_respondidas}
          {e.comentarios > 0 && <span className="text-muted"> · {e.comentarios} txt</span>}
        </span>
      </span>
      <span className={celula}>
        <span className={rotulo}>Erros 30d</span>
        <span className={cn("mono text-caption", erros && erros > 0 ? "text-danger-ink" : "text-muted")}>{erros === null ? "—" : erros}</span>
      </span>
    </li>
  );
}
