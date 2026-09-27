import { checkPlatformHealth } from "@/lib/platform-health";
import { provedoresOAuth } from "@/lib/auth-provedores";
import { visaoDaPlataforma, usuariosDetalhados, haQuanto } from "@/lib/admin";
import { StatusIndicator } from "../StatusIndicator";
import { lerErrosDoSentry, type AmbienteDoSentry } from "@/lib/sentry-leitura";
import { ErrosDoSentry } from "./ErrosDoSentry";

/**
 * Saúde da plataforma — só o que dá para medir de verdade, agora:
 * API/Banco/Autenticação com uma chamada real e a latência; o provedor de
 * login do cliente (Google) lido do próprio Supabase; a atividade de login
 * das contas. Serviços que não existem no código aparecem como "Não
 * conectado" — nunca "Operacional" fingido. Não há histórico contínuo.
 */
export default async function AdminHealthPage({ searchParams }: { searchParams: Promise<{ ambiente?: string }> }) {
  const { ambiente: amb } = await searchParams;
  const ambiente: AmbienteDoSentry = amb === "preview" ? "preview" : "production";
  const [saude, provedores, visao, usuarios, erros] = await Promise.all([
    checkPlatformHealth(),
    provedoresOAuth(),
    visaoDaPlataforma(1),
    usuariosDetalhados(),
    lerErrosDoSentry(ambiente),
  ]);

  const agora = Date.now();
  const entrou = (horas: number) =>
    (usuarios ?? []).filter((u) => u.last_sign_in_at && agora - new Date(u.last_sign_in_at).getTime() < horas * 3600000).length;
  const ultimoLogin = (usuarios ?? []).map((u) => u.last_sign_in_at).filter(Boolean).sort().at(-1) ?? null;
  const conectados = saude.filter((s) => s.status !== "not_connected");
  const naoConectados = saude.filter((s) => s.status === "not_connected");

  return (
    <div className="space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">Plataforma</p>
        <h1 className="text-page-title text-foreground mt-2.5">Saúde.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Serviços verificados agora, quando esta página carregou. Erros da aplicação vêm do Sentry. Não há histórico contínuo de disponibilidade.
        </p>
      </header>

      <section className="painel overflow-hidden" aria-labelledby="servicos">
        <h2 id="servicos" className="text-section-title text-foreground px-5 pt-5 pb-3">
          Serviços medidos
        </h2>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="painel p-5" aria-labelledby="auth">
          <h2 id="auth" className="text-section-title text-foreground">Autenticação</h2>
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
          <h2 id="nao-conectado" className="text-section-title text-foreground">Não conectado</h2>
          <p className="text-caption text-muted mt-1">Sem integração no código hoje — não há o que medir.</p>
          <ul className="mt-3 divide-y divide-border">
            {[
              ...naoConectados.map((s) => ({ nome: s.service, detalhe: s.detail })),
              { nome: "Jobs / filas", detalhe: "Nenhum worker ou fila de tarefas em segundo plano." },
              { nome: "Notificações", detalhe: "O CORTEX não envia mensagens; o WhatsApp abre no aparelho de quem opera." },
            ].map((s) => (
              <li key={s.nome} className="py-2.5 flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-body-sm text-foreground">{s.nome}</span>
                  <span className="block text-caption text-muted">{s.detalhe}</span>
                </span>
                <StatusIndicator status="not_connected" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
