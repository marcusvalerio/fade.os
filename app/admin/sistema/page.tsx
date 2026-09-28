import Link from "next/link";
import { checkPlatformHealth } from "@/lib/platform-health";
import { provedoresOAuth } from "@/lib/auth-provedores";
import {
  visaoDaPlataforma,
  usuariosDetalhados,
  haQuanto,
  empresasNoBeta,
  atividadeDasEmpresas,
  usoDosModulos,
  saudeDasNotificacoes,
  funilDoBetaNoBanco,
  type SaudeDasNotificacoes,
} from "@/lib/admin";
import { calcularAdocao, type EmpresaResumida } from "@/lib/admin-saude";
import { integracoesDoAmbiente } from "@/lib/admin-integracoes";
import { StatusIndicator, type HealthStatus } from "../StatusIndicator";
import { lerErrosDoSentry, type AmbienteDoSentry } from "@/lib/sentry-leitura";
import { ErrosDoSentry } from "./ErrosDoSentry";
import { cn } from "@/lib/cn";

/**
 * Saúde da plataforma — o dashboard do Admin. Três blocos:
 *   Adoção     — quem está usando, esfriando, parado (7 e 10 dias sem acesso);
 *   Utilização — módulos, funcionalidades do Beta, pesquisas;
 *   Operação   — serviços, erros, notificações/push, integrações, jobs.
 *
 * Aqui é INFORMAÇÃO: nada desta página dispara notificação. O que pede
 * ação chega pelo sino (Avisos). Só o que dá para medir de verdade;
 * serviço sem integração aparece como "Não conectado", nunca "Operacional".
 */
export default async function AdminHealthPage({ searchParams }: { searchParams: Promise<{ ambiente?: string }> }) {
  const { ambiente: amb } = await searchParams;
  const ambiente: AmbienteDoSentry = amb === "preview" ? "preview" : "production";
  const [saude, provedores, visao, usuarios, erros, empresas, semana, quinzena, modulos, notificacoes, funil] = await Promise.all([
    checkPlatformHealth(),
    provedoresOAuth(),
    visaoDaPlataforma(1),
    usuariosDetalhados(),
    lerErrosDoSentry(ambiente),
    empresasNoBeta(30),
    atividadeDasEmpresas(7),
    atividadeDasEmpresas(14),
    usoDosModulos(30),
    saudeDasNotificacoes(),
    funilDoBetaNoBanco(),
  ]);

  const agora = Date.now();
  const entrou = (horas: number) =>
    (usuarios ?? []).filter((u) => u.last_sign_in_at && agora - new Date(u.last_sign_in_at).getTime() < horas * 3600000).length;
  const ultimoLogin = (usuarios ?? []).map((u) => u.last_sign_in_at).filter(Boolean).sort().at(-1) ?? null;
  const conectados = saude.filter((s) => s.status !== "not_connected");
  const naoConectados = saude.filter((s) => s.status === "not_connected");
  const adocao = empresas && semana && quinzena ? calcularAdocao(empresas, semana, quinzena) : null;
  const integracoes = integracoesDoAmbiente(notificacoes);
  const ativas = adocao?.total ?? 0;

  return (
    <div className="space-y-8">
      <header className="animate-rise-in">
        <p className="eyebrow">Plataforma</p>
        <h1 className="text-page-title text-foreground mt-2.5">Saúde.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Indicadores de adoção, uso e operação, lidos agora. Nada aqui dispara notificação: o que pede ação chega em{" "}
          <Link href="/admin/avisos" className="underline underline-offset-4 hover:text-foreground">
            Avisos
          </Link>
          .
        </p>
        <nav aria-label="Seções" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-caption">
          {[
            ["#adocao", "Adoção"],
            ["#utilizacao", "Utilização"],
            ["#operacao", "Operação"],
            ["#notificacoes", "Notificações"],
            ["#integracoes", "Integrações"],
            ["#jobs", "Jobs"],
          ].map(([href, rotulo]) => (
            <a key={href} href={href} className="alvo-toque text-muted underline-offset-4 hover:text-foreground hover:underline">
              {rotulo}
            </a>
          ))}
        </nav>
      </header>

      {/* ------------------------------------------------------------ Adoção */}
      <section id="adocao" className="scroll-mt-6 space-y-4" aria-labelledby="adocao-titulo">
        <TituloDoBloco id="adocao-titulo" titulo="Adoção" descricao="Barbearias ativas no CORTEX (sem suspensas e sem Beta revogado). 7 dias sem acesso pede atenção; 10 dias é inatividade prolongada." />
        {!adocao ? (
          <Indisponivel texto="Não foi possível ler a atividade das barbearias." />
        ) : (
          <>
            <dl className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-px bg-border border border-border rounded-md overflow-hidden">
              <Indicador rotulo="Ativas" valor={adocao.ativas.length} total={ativas} nota="operaram em 7 dias" />
              <Indicador rotulo="Sem acesso · 7 dias" valor={adocao.semAcesso7.length} total={ativas} tom={adocao.semAcesso7.length ? "atencao" : undefined} />
              <Indicador rotulo="Sem acesso · 10+ dias" valor={adocao.semAcesso10.length} total={ativas} tom={adocao.semAcesso10.length ? "alerta" : undefined} nota="inatividade prolongada" />
              <Indicador rotulo="Beta sem uso" valor={adocao.betaSemUso.length} total={ativas} tom={adocao.betaSemUso.length ? "atencao" : undefined} />
              <Indicador rotulo="Começaram e pararam" valor={adocao.pararam.length} total={ativas} tom={adocao.pararam.length ? "alerta" : undefined} />
              <Indicador rotulo="Onboarding pendente" valor={adocao.onboardingPendente.length} total={ativas} tom={adocao.onboardingPendente.length ? "atencao" : undefined} />
              <Indicador rotulo="Queda de uso" valor={adocao.quedaDeUso.length} total={ativas} tom={adocao.quedaDeUso.length ? "atencao" : undefined} nota="semana vs. anterior" />
            </dl>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Faixa titulo="Inatividade prolongada (10+ dias)" empresas={adocao.semAcesso10} tom="alerta" />
              <Faixa titulo="Sem acesso há 7 dias" empresas={adocao.semAcesso7} tom="atencao" />
              <Faixa titulo="Começaram e pararam" empresas={adocao.pararam} tom="alerta" />
              <Faixa titulo="Receberam o Beta e não utilizaram" empresas={adocao.betaSemUso} tom="atencao" />
              <Faixa titulo="Onboarding não concluído" empresas={adocao.onboardingPendente} tom="atencao" />
              <Faixa titulo="Queda relevante de utilização" empresas={adocao.quedaDeUso} tom="atencao" />
            </div>
          </>
        )}
      </section>

      {/* -------------------------------------------------------- Utilização */}
      <section id="utilizacao" className="scroll-mt-6 space-y-4" aria-labelledby="utilizacao-titulo">
        <TituloDoBloco id="utilizacao-titulo" titulo="Utilização" descricao="Uso medido por registro criado (30 dias) e o que as pesquisas dizem das funcionalidades." />
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="painel overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
              <h3 className="text-section-title text-foreground">Por módulo</h3>
              <Link href="/admin/uso" className="text-caption text-muted underline-offset-4 hover:text-foreground hover:underline">
                Matriz completa
              </Link>
            </div>
            {!modulos || modulos.length === 0 ? (
              <p className="px-5 pb-5 text-caption text-muted">Sem registros no período.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {[...modulos].sort((a, b) => b.empresas - a.empresas || b.registros - a.registros).map((m) => (
                  <li key={m.modulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-2.5">
                    <span className="text-body-sm text-foreground truncate">{m.modulo}</span>
                    <span className="text-caption text-muted numero">
                      {m.empresas}/{ativas || "—"} · {m.registros}
                    </span>
                    <span aria-hidden className="col-span-2 h-1 bg-surface-muted">
                      <span className="block h-full bg-chart" style={{ width: `${ativas ? Math.min(100, (m.empresas / ativas) * 100) : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="painel overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
              <h3 className="text-section-title text-foreground">Funcionalidades e pesquisas</h3>
              <Link href="/admin/beta#funil" className="text-caption text-muted underline-offset-4 hover:text-foreground hover:underline">
                Funil do Beta
              </Link>
            </div>
            {!funil || funil.funcionalidades.length === 0 ? (
              <p className="px-5 pb-5 text-caption text-muted">Nenhuma resposta de pesquisa ainda.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {funil.funcionalidades.map((f) => (
                  <li key={f.funcionalidade} className="flex items-center justify-between gap-4 px-5 py-2.5">
                    <span className="text-body-sm text-foreground truncate">{f.funcionalidade}</span>
                    <span className="text-caption text-muted numero shrink-0">
                      {f.respostas} {f.respostas === 1 ? "resposta" : "respostas"}
                      {f.negativas ? ` · ${f.negativas} com dificuldade` : ""}
                      {f.media !== null ? ` · nota ${f.media}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="px-5 py-3 text-caption text-muted border-t border-border">
              Dificuldade = nota 1–2 ou resposta “não”. Os textos estão em{" "}
              <Link href="/admin/beta#dificuldades" className="underline underline-offset-4 hover:text-foreground">
                Beta → Dificuldades
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Operação */}
      <section id="operacao" className="scroll-mt-6 space-y-6" aria-labelledby="operacao-titulo">
        <TituloDoBloco id="operacao-titulo" titulo="Operação" descricao="Serviços verificados quando a página carregou. Não há histórico contínuo de disponibilidade." />

        <section className="painel overflow-hidden" aria-labelledby="servicos">
          <h3 id="servicos" className="text-section-title text-foreground px-5 pt-5 pb-3">
            Serviços medidos
          </h3>
          <ul className="divide-y divide-border border-t border-border">
            {conectados.map((s) => (
              <li key={s.service} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="min-w-0">
                  <span className="block text-body-sm font-medium text-foreground">{s.service}</span>
                  <span className="block text-caption text-muted mono">{s.detail}</span>
                </span>
                <StatusIndicator status={s.status} />
              </li>
            ))}
            <li className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="min-w-0">
                <span className="block text-body-sm font-medium text-foreground">Login do cliente com Google</span>
                <span className="block text-caption text-muted">Lido de /auth/v1/settings do Supabase · a equipe nunca entra pelo Google</span>
              </span>
              <StatusIndicator status={provedores.google ? "operational" : "not_connected"} detail={provedores.google ? "ligado" : "desligado"} />
            </li>
          </ul>
        </section>

        <ErrosDoSentry leitura={erros} ambiente={ambiente} />

        <Notificacoes saude={notificacoes} />

        <section id="integracoes" className="painel overflow-hidden scroll-mt-6" aria-labelledby="integracoes-titulo">
          <div className="px-5 pt-5 pb-3">
            <h3 id="integracoes-titulo" className="text-section-title text-foreground">Integrações</h3>
            <p className="text-caption text-muted mt-1">Deste ambiente{process.env.VERCEL_ENV ? ` (${process.env.VERCEL_ENV})` : ""}. Mostra se está configurado — nunca o valor.</p>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {integracoes.map((i) => (
              <li key={i.nome} className="px-5 py-3.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 max-w-prose">
                  <span className="block text-body-sm font-medium text-foreground">{i.nome}</span>
                  <span className="block text-caption text-muted">{i.detalhe}</span>
                  {i.status !== "operational" && i.efeito && <span className="block text-caption text-foreground/80 mt-0.5">{i.efeito}</span>}
                </span>
                <StatusIndicator status={i.status} />
              </li>
            ))}
          </ul>
        </section>

        <Jobs saude={notificacoes} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="painel p-5" aria-labelledby="auth">
            <h3 id="auth" className="text-section-title text-foreground">Autenticação</h3>
            <dl className="mt-4 grid grid-cols-3 gap-px bg-border border-y border-border">
              {[
                ["Entraram em 24 h", String(entrou(24))],
                ["Entraram em 7 dias", String(entrou(24 * 7))],
                ["Último login", haQuanto(ultimoLogin)],
              ].map(([r, v]) => (
                <div key={r} className="bg-surface py-3 pr-3 [&:not(:first-child)]:pl-3 min-w-0">
                  <dt className="font-subtitle text-micro text-muted truncate">{r}</dt>
                  <dd className="numero text-body text-foreground mt-1 truncate">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-caption text-muted mt-3">
              {visao ? `${visao.usuarios} contas no total.` : ""} Tentativas de login malsucedidas não são registradas.
            </p>
          </section>

          <section className="painel p-5" aria-labelledby="nao-conectado">
            <h3 id="nao-conectado" className="text-section-title text-foreground">Não conectado</h3>
            <p className="text-caption text-muted mt-1">Sem integração no código hoje — não há o que medir.</p>
            <ul className="mt-3 divide-y divide-border">
              {naoConectados.map((s) => (
                <li key={s.service} className="py-2.5 flex items-start justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-body-sm text-foreground">{s.service}</span>
                    <span className="block text-caption text-muted">{s.detail}</span>
                  </span>
                  <StatusIndicator status="not_connected" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

function TituloDoBloco({ id, titulo, descricao }: { id: string; titulo: string; descricao: string }) {
  return (
    <div>
      <h2 id={id} className="font-heading text-section-title text-foreground flex items-center gap-2">
        <span aria-hidden className="size-2 bg-primary" />
        {titulo}
      </h2>
      <p className="text-caption text-muted mt-1 max-w-prose">{descricao}</p>
    </div>
  );
}

function Indisponivel({ texto }: { texto: string }) {
  return (
    <div className="painel p-5">
      <p className="text-body-sm text-foreground">{texto}</p>
    </div>
  );
}

type Tom = "atencao" | "alerta";
const MARCA_DO_TOM: Record<Tom, string> = { atencao: "bg-warning", alerta: "bg-danger" };

function Indicador({ rotulo, valor, total, nota, tom }: { rotulo: string; valor: number; total?: number; nota?: string; tom?: Tom }) {
  return (
    <div className="bg-surface p-4 min-w-0">
      <dt className="font-subtitle text-micro text-muted flex items-center gap-1.5">
        {tom && <span aria-hidden className={cn("size-1.5 shrink-0", MARCA_DO_TOM[tom])} />}
        <span className="truncate">{rotulo}</span>
      </dt>
      <dd className="mt-1.5">
        <span className="numero text-metric-sm text-foreground">{valor}</span>
        {total !== undefined && <span className="text-caption text-muted numero"> / {total}</span>}
        {nota && <span className="block text-micro text-muted mt-0.5 truncate">{nota}</span>}
      </dd>
    </div>
  );
}

function Faixa({ titulo, empresas, tom }: { titulo: string; empresas: EmpresaResumida[]; tom: Tom }) {
  if (empresas.length === 0) return null;
  const visiveis = empresas.slice(0, 6);
  return (
    <section className="painel overflow-hidden" aria-label={titulo}>
      <h3 className="px-4 pt-4 pb-2 text-body-sm font-medium text-foreground flex items-center gap-2">
        <span aria-hidden className={cn("size-2 shrink-0", MARCA_DO_TOM[tom])} />
        {titulo}
        <span className="ml-auto text-caption text-muted numero">{empresas.length}</span>
      </h3>
      <ul className="divide-y divide-border border-t border-border">
        {visiveis.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/empresas/${e.id}`} className="block px-4 py-2.5 hover:bg-surface-muted">
              <span className="block text-body-sm text-foreground truncate">{e.name}</span>
              <span className="block text-caption text-muted truncate">{e.detalhe}</span>
            </Link>
          </li>
        ))}
      </ul>
      {empresas.length > visiveis.length && (
        <p className="px-4 py-2 text-caption text-muted border-t border-border">
          E mais {empresas.length - visiveis.length}.{" "}
          <Link href="/admin/beta" className="underline underline-offset-4 hover:text-foreground">
            Ver todas
          </Link>
        </p>
      )}
    </section>
  );
}

function Notificacoes({ saude }: { saude: SaudeDasNotificacoes | null }) {
  const p = saude?.push_24h ?? {};
  const enviadas = p.enviada ?? 0;
  const falhas = p.falhou ?? 0;
  const status: HealthStatus = !saude
    ? "unknown"
    : saude.push_presas >= 10 || (falhas >= 10 && falhas >= enviadas)
      ? "down"
      : saude.push_presas > 0 || falhas > 0
        ? "degraded"
        : "operational";
  const avisos = Object.values(saude?.avisos_7d ?? {}).reduce((a, b) => a + b, 0);
  return (
    <section id="notificacoes" className="painel overflow-hidden scroll-mt-6" aria-labelledby="notificacoes-titulo">
      <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="notificacoes-titulo" className="text-section-title text-foreground">Notificações e push</h3>
          <p className="text-caption text-muted mt-1">Últimas 24 h, para as barbearias. A central funciona mesmo sem push.</p>
        </div>
        <StatusIndicator status={status} />
      </div>
      {!saude ? (
        <p className="px-5 pb-5 text-caption text-muted">Não foi possível ler o estado das notificações.</p>
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border-t border-border">
          <Indicador rotulo="Criadas" valor={saude.criadas_24h} nota={`${saude.abertas_24h} abertas`} />
          <Indicador rotulo="Push enviados" valor={enviadas} nota={`${p.token_invalido ?? 0} aparelhos descartados`} />
          <Indicador rotulo="Push com falha" valor={falhas} tom={falhas ? "alerta" : undefined} />
          <Indicador rotulo="Parados na fila" valor={saude.push_presas} tom={saude.push_presas ? "atencao" : undefined} nota="há mais de 30 min" />
          <Indicador rotulo="Aparelhos ativos" valor={saude.aparelhos_ativos} />
          <Indicador rotulo="Pessoas com push" valor={saude.pessoas_com_push} />
          <Indicador rotulo="Sem aparelho" valor={p.sem_dispositivo ?? 0} nota="pediram push sem aparelho ativo" />
          <Indicador rotulo="Avisos ao Admin" valor={avisos} nota="últimos 7 dias" />
        </dl>
      )}
    </section>
  );
}

const ROTULO_DO_JOB: Record<string, string> = {
  "notificacoes-envio-push": "Envio de push (rede de segurança)",
  "notificacoes-lembretes-agenda": "Lembretes de agenda",
  "notificacoes-comunicados-agendados": "Comunicados agendados",
  "notificacoes-limpeza": "Limpeza de notificações antigas",
  "plataforma-verificacoes": "Verificações da plataforma",
  "plataforma-piloto-coleta": "Pilotos: sessões e retrato de hoje",
  "plataforma-piloto-fechamento": "Pilotos: fechamento do dia",
};

function Jobs({ saude }: { saude: SaudeDasNotificacoes | null }) {
  const jobs = saude?.jobs ?? [];
  return (
    <section id="jobs" className="painel overflow-hidden scroll-mt-6" aria-labelledby="jobs-titulo">
      <div className="px-5 pt-5 pb-3">
        <h3 id="jobs-titulo" className="text-section-title text-foreground">Jobs agendados</h3>
        <p className="text-caption text-muted mt-1">pg_cron no banco. Três falhas numa hora viram aviso no sino.</p>
      </div>
      {jobs.length === 0 ? (
        <p className="px-5 pb-5 text-caption text-muted">{saude ? "Nenhum job cadastrado." : "Não foi possível ler os jobs."}</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {jobs.map((j) => {
            const status: HealthStatus = !j.ativo ? "not_connected" : j.ultimo_status === "failed" ? "down" : j.falhas_24h > 0 ? "degraded" : j.ultimo_status ? "operational" : "unknown";
            return (
              <li key={j.nome} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="min-w-0">
                  <span className="block text-body-sm font-medium text-foreground">{ROTULO_DO_JOB[j.nome] ?? j.nome}</span>
                  <span className="block text-caption text-muted mono">
                    {j.agenda} · última {haQuanto(j.ultima_execucao)} · {j.execucoes_24h} em 24 h{j.falhas_24h ? ` · ${j.falhas_24h} falhas` : ""}
                  </span>
                </span>
                <StatusIndicator status={status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
