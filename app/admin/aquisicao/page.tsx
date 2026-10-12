import type { Metadata } from "next";
import Link from "next/link";
import { atividadeDasEmpresas, funilDoBetaNoBanco, visaoDaPlataforma, haQuanto } from "@/lib/admin";
import { montarFunil, taxa, SEM_ATRIBUICAO } from "@/lib/aquisicao";
import { CHAVES_UTM, DOMINIO_DE_PRODUCAO, PAGINAS_DE_AQUISICAO, ROTULO_DO_CANAL, type Canal } from "@/lib/analytics/regras";
import { SerieSemanal } from "../SerieSemanal";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Aquisição · CORTEX ADMIN" };

/**
 * Aquisição — de onde vêm as barbearias que de fato passam a usar o CORTEX.
 *
 * Separado de Produto (uso) e de Saúde (operação da plataforma). Hoje mostra
 * o que já é medido de verdade: pedidos de Beta, empresas, onboarding,
 * primeiro uso e atividade. Visitantes, sessões, origem, páginas e campanhas
 * dependem da coleta do site — PENDENTE — REQUER ACESSO AO SUPABASE — e
 * aparecem como "coleta não ativada", nunca como zero.
 *
 * Empresas anteriores à coleta ficam "Sem atribuição — anterior à coleta":
 * origem não se inventa para dado histórico.
 */

const ABAS = [
  { chave: "visao", rotulo: "Visão geral" },
  { chave: "origem", rotulo: "Origem" },
  { chave: "paginas", rotulo: "Páginas" },
  { chave: "campanhas", rotulo: "Campanhas" },
  { chave: "funil", rotulo: "Funil" },
] as const;
type Aba = (typeof ABAS)[number]["chave"];

const SEM_COLETA = "—";

export default async function AquisicaoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba: abaPedida } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.chave === abaPedida) ? (abaPedida as Aba) : "visao";

  const [visao, empresas, beta] = await Promise.all([visaoDaPlataforma(90), atividadeDasEmpresas(90), funilDoBetaNoBanco()]);

  if (!visao || !empresas || !beta) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar Aquisição agora.</p>
        <p className="text-caption text-muted mt-1">As leituras do Admin exigem um administrador de plataforma ativo.</p>
      </div>
    );
  }

  const s = beta.solicitacoes;
  const pedidosBeta = (s.pending ?? 0) + (s.approved ?? 0) + (s.rejected ?? 0) + (s.revoked ?? 0);
  const liberados = (s.approved ?? 0) + (s.revoked ?? 0);
  const agora = Date.now();
  const onboardings = empresas.filter((e) => e.onboarding_completed).length;
  const primeiroUso = empresas.filter((e) => e.ultima_atividade !== null).length;
  const ativas = empresas.filter((e) => e.ultima_atividade && agora - new Date(e.ultima_atividade).getTime() < 7 * 86400000).length;
  const funil = montarFunil({
    visitantes: null,
    interessados: null,
    cadastrosIniciados: null,
    pedidosBeta,
    aprovados: liberados,
    empresas: empresas.length,
    onboardingsConcluidos: onboardings,
    primeiroUso,
    ativas,
  });

  return (
    <div className="space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">CORTEX Admin · Crescimento</p>
        <h1 className="text-page-title text-foreground mt-2.5">Aquisição</h1>
        <p className="text-body-sm text-muted mt-2 max-w-2xl">
          De onde vêm as barbearias que passam a usar o CORTEX — do visitante ao uso real. Separado de Produto (uso por
          módulo) e de Saúde (operação da plataforma).
        </p>
      </header>

      <div className="painel border-l-2 border-l-primary px-5 py-4">
        <p className="font-subtitle text-micro uppercase tracking-label text-primary">Coleta do site ainda não ativada</p>
        <p className="text-body-sm text-muted mt-1 max-w-3xl">
          Visitantes, sessões, origem, páginas e campanhas começam a aparecer quando a coleta própria for ligada (depende
          de uma etapa no banco). A medição já está pronta em {PAGINAS_DE_AQUISICAO.join(", ")}; só o tráfego de{" "}
          <span className="mono text-foreground">{DOMINIO_DE_PRODUCAO}</span> conta como real — Preview e localhost ficam
          de fora. Os números abaixo, do Beta em diante, já são reais.
        </p>
      </div>

      <nav aria-label="Seções de Aquisição" className="flex flex-wrap gap-1 border-b border-border">
        {ABAS.map((a) => (
          <Link
            key={a.chave}
            href={a.chave === "visao" ? "/admin/aquisicao" : `/admin/aquisicao?aba=${a.chave}`}
            aria-current={aba === a.chave ? "page" : undefined}
            className={cn(
              "min-h-11 inline-flex items-center px-3.5 -mb-px border-b-2 text-body-sm transition-colors duration-fast ease-standard",
              aba === a.chave ? "border-primary text-foreground font-medium" : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {aba === "visao" && (
        <>
          <section aria-label="Números principais" className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Numero rotulo="Visitantes" valor={SEM_COLETA} nota="coleta não ativada" />
            <Numero rotulo="Sessões" valor={SEM_COLETA} nota="coleta não ativada" />
            <Numero rotulo="Novos · recorrentes" valor={SEM_COLETA} nota="só com consentimento" />
            <Numero rotulo="Pedidos de Beta" valor={pedidosBeta} nota={`${s.pending ?? 0} aguardando · ${beta.recebidas_30d} em 30 dias`} />
            <Numero rotulo="Empresas criadas" valor={empresas.length} nota={`${visao.empresas_novas} nos últimos 90 dias`} />
            <Numero rotulo="Onboardings concluídos" valor={onboardings} nota={`${pct(taxa(onboardings, empresas.length))} das empresas`} />
            <Numero rotulo="Pedido → empresa" valor={pct(taxa(empresas.length, pedidosBeta))} nota="empresas ÷ pedidos de Beta" />
            <Numero rotulo="Visitante → empresa" valor={SEM_COLETA} nota="depende da coleta do site" />
          </section>
          <section className="painel p-5" aria-labelledby="evolucao">
            <h2 id="evolucao" className="text-section-title text-foreground">Evolução semanal</h2>
            <p className="text-caption text-muted mt-1 mb-4">Empresas novas e uso nas últimas semanas. Visitantes entram aqui com a coleta.</p>
            <SerieSemanal pontos={visao.serie} />
          </section>
        </>
      )}

      {aba === "origem" && (
        <section className="painel overflow-hidden" aria-labelledby="origem">
          <header className="px-5 pt-5 pb-3">
            <h2 id="origem" className="text-section-title text-foreground">Origem das empresas</h2>
            <p className="text-caption text-muted mt-1">
              Canal → visitantes → pedidos → empresas → onboarding → uso. Empresas criadas antes da coleta não têm origem
              registrada — e ela não é inventada.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="text-left text-caption text-muted border-y border-border">
                <tr>
                  <th className="px-5 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 font-medium text-right">Visitantes</th>
                  <th className="px-3 py-2 font-medium text-right">Empresas</th>
                  <th className="px-3 py-2 font-medium text-right">Onboarding</th>
                  <th className="px-3 py-2 font-medium text-right">Em uso</th>
                  <th className="px-5 py-2 font-medium text-right">Ativas (7 d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Object.keys(ROTULO_DO_CANAL) as Canal[]).map((c) => (
                  <tr key={c} className="text-muted">
                    <td className="px-5 py-2.5">{ROTULO_DO_CANAL[c]}</td>
                    <td className="px-3 py-2.5 text-right mono">{SEM_COLETA}</td>
                    <td className="px-3 py-2.5 text-right mono">0</td>
                    <td className="px-3 py-2.5 text-right mono">0</td>
                    <td className="px-3 py-2.5 text-right mono">0</td>
                    <td className="px-5 py-2.5 text-right mono">0</td>
                  </tr>
                ))}
                <tr className="bg-surface-muted/60">
                  <td className="px-5 py-2.5 text-foreground font-medium">{SEM_ATRIBUICAO}</td>
                  <td className="px-3 py-2.5 text-right mono text-muted">{SEM_COLETA}</td>
                  <td className="px-3 py-2.5 text-right mono text-foreground">{empresas.length}</td>
                  <td className="px-3 py-2.5 text-right mono text-foreground">{onboardings}</td>
                  <td className="px-3 py-2.5 text-right mono text-foreground">{primeiroUso}</td>
                  <td className="px-5 py-2.5 text-right mono text-foreground">{ativas}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="border-t border-border divide-y divide-border">
            {empresas.map((e) => (
              <li key={e.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <Link href={`/admin/empresas/${e.id}`} className="text-body-sm text-foreground hover:underline underline-offset-4 min-w-0 truncate">
                  {e.name}
                </Link>
                <span className="text-caption text-muted">
                  {SEM_ATRIBUICAO} · {e.onboarding_completed ? "onboarding concluído" : "configurando"} · última atividade{" "}
                  {haQuanto(e.ultima_atividade)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aba === "paginas" && (
        <section className="painel p-5" aria-labelledby="paginas">
          <h2 id="paginas" className="text-section-title text-foreground">Páginas</h2>
          <p className="text-caption text-muted mt-1">Mais acessadas, de entrada e de saída — só as públicas de aquisição.</p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {PAGINAS_DE_AQUISICAO.map((p) => (
              <li key={p} className="flex items-center justify-between py-2.5 text-body-sm">
                <span className="mono text-foreground">{p}</span>
                <span className="text-caption text-muted">coleta não ativada</span>
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted mt-3">
            Páginas das barbearias e o produto nunca entram aqui: a medição não roda fora de {PAGINAS_DE_AQUISICAO.join(", ")}.
          </p>
        </section>
      )}

      {aba === "campanhas" && (
        <section className="painel p-5" aria-labelledby="campanhas">
          <h2 id="campanhas" className="text-section-title text-foreground">Campanhas</h2>
          <p className="text-caption text-muted mt-1 max-w-2xl">
            Por UTM ({CHAVES_UTM.join(", ")}): visitantes, pedidos, empresas e conversão. Aparece com a coleta ativada.
          </p>
          <div className="mt-4 rounded-md border border-border bg-surface-muted p-4">
            <p className="text-body-sm text-foreground font-medium">Para já medir certo quando a coleta ligar</p>
            <p className="text-caption text-muted mt-1">
              Link compartilhado no WhatsApp quase nunca diz de onde veio. Use UTM nos links que você divulga:
            </p>
            <code className="mt-2 block break-all mono text-caption text-foreground">
              https://{DOMINIO_DE_PRODUCAO}/?utm_source=whatsapp&amp;utm_medium=mensagem&amp;utm_campaign=beta
            </code>
            <code className="mt-1 block break-all mono text-caption text-foreground">
              https://{DOMINIO_DE_PRODUCAO}/?utm_source=instagram&amp;utm_medium=bio&amp;utm_campaign=beta
            </code>
          </div>
        </section>
      )}

      {aba === "funil" && (
        <section className="painel p-5" aria-labelledby="funil">
          <h2 id="funil" className="text-section-title text-foreground">Funil</h2>
          <p className="text-caption text-muted mt-1">
            Do visitante à barbearia ativa, desde o início. Conversão calculada só entre etapas medidas.
          </p>
          <ol className="mt-5 space-y-2.5">
            {funil.map((etapa) => {
              const base = funil.find((e) => e.valor !== null)?.valor ?? 0;
              const largura = etapa.valor !== null && base > 0 ? Math.max(2, (etapa.valor / base) * 100) : 0;
              return (
                <li key={etapa.chave} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] sm:grid-cols-[14rem_minmax(0,1fr)_5rem] items-center gap-3">
                  <span className="text-body-sm text-foreground truncate">{etapa.rotulo}</span>
                  <span className="h-6 rounded-xs bg-surface-muted overflow-hidden" aria-hidden>
                    {etapa.valor !== null && <span className="block h-full bg-primary/80" style={{ width: `${largura}%` }} />}
                  </span>
                  <span className="text-right">
                    <span className="block mono text-body-sm text-foreground">{etapa.valor ?? SEM_COLETA}</span>
                    <span className="block text-micro text-muted">
                      {etapa.valor === null ? "sem coleta" : etapa.conversao === null ? "base" : `${pct(etapa.conversao)}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="text-caption text-muted mt-4">
            Primeiro uso real = empresa com qualquer registro de operação. Ativa = atividade nos últimos 7 dias. Atividade
            posterior por empresa está em Produto e na ficha de cada empresa.
          </p>
        </section>
      )}
    </div>
  );
}

function pct(v: number | null): string {
  return v === null ? SEM_COLETA : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string | number; nota: string }) {
  return (
    <div className="bg-surface px-5 py-4 min-w-0">
      <p className="text-label uppercase text-muted truncate">{rotulo}</p>
      <p className="numero text-metric-sm text-foreground mt-1.5">{valor}</p>
      <p className="text-caption text-muted mt-1 truncate">{nota}</p>
    </div>
  );
}
