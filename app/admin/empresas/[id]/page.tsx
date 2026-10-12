import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { CompanyActions } from "./CompanyActions";
import {
  atividadeDasEmpresas,
  empresasNoBeta,
  investigacaoDaEmpresa,
  pilotosDoAdmin,
  matrizDeUso,
  haQuanto,
  MODULOS_DA_MATRIZ,
  ROTULO_DA_ACAO,
  type EstadoNoBeta,
} from "@/lib/admin";
import { nivelDeInatividade } from "@/lib/admin-saude";
import { lerErrosDoSentry } from "@/lib/sentry-leitura";
import { ROTULO_DA_CATEGORIA, ROTULO_DA_PRIORIDADE, type Categoria, type Prioridade } from "@/lib/notificacoes/catalogo";
import { cn } from "@/lib/cn";

const ROTULO_DO_ESTADO: Record<EstadoNoBeta, string> = {
  ativa: "Ativa — operou nos últimos 7 dias",
  esfriando: "Esfriando — última operação entre 7 e 14 dias",
  parada: "Parada — sem operação há mais de 14 dias",
  sem_uso: "Sem uso — configurou e nunca operou",
  configurando: "Configurando — primeira configuração não concluída",
  suspensa: "Suspensa",
};

const ROTULO_DO_BETA: Record<string, string> = { pending: "Aguardando", approved: "Aprovado", rejected: "Recusado", revoked: "Revogado" };

type CompanyDetail = {
  company: {
    id: string;
    name: string;
    trade_name: string | null;
    slug: string;
    city: string | null;
    state: string | null;
    address: string | null;
    email: string | null;
    status: "active" | "suspended";
    suspension_reason: string | null;
    suspended_at: string | null;
    created_at: string;
    onboarding_completed_at: string | null;
  };
  unit_address: string | null;
  counts: {
    users: number;
    professionals: number;
    clients: number;
    services: number;
    products: number;
    appointments: number;
    sales: number;
    sales_total: number;
  };
  access: Array<{
    user_id: string;
    email: string;
    role: string;
    linked_at: string;
    last_sign_in_at: string | null;
  }>;
  last_activity_at: string | null;
  beta: {
    status: string;
    created_at: string;
    approved_at: string | null;
    beta_period_months: number | null;
    beta_expires_at: string | null;
    region: string | null;
  } | null;
  audit: Array<{ id: string; action: string; entity_type: string; reason: string | null; created_at: string; user_id: string | null }>;
  platform_audit: Array<{ id: string; action: string; reason: string | null; created_at: string }>;
};

const ROLE_LABEL: Record<string, string> = { owner: "Responsável", admin: "Gerente", staff: "Equipe" };

export default async function AdminCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data, error }, atividades, noBeta, investigacao, matriz, erros, pilotos] = await Promise.all([
    supabase.rpc("admin_get_company_detail", { p_company_id: id }),
    atividadeDasEmpresas(30),
    empresasNoBeta(30),
    investigacaoDaEmpresa(id),
    matrizDeUso(30),
    lerErrosDoSentry("production"),
    pilotosDoAdmin(),
  ]);

  if (error || !data) notFound();
  const atividade = atividades?.find((a) => a.id === id) ?? null;
  const uso = noBeta?.find((e) => e.id === id) ?? null;
  const modulos = matriz?.find((l) => l.company_id === id)?.uso ?? null;
  const errosDaEmpresa = erros.estado === "ok" ? (erros.porEmpresa[id] ?? 0) : null;
  const inatividade = uso ? nivelDeInatividade(uso.dias_sem_acesso, uso.ultimo_acesso) : null;
  const piloto = pilotos?.find((p) => p.company_id === id && (p.status === "ativo" || p.status === "planejado")) ?? null;
  const detail = data as CompanyDetail;
  const { company, counts, access, beta, audit, platform_audit: platformAudit } = detail;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={company.name}
          description={`/${company.slug}${company.city ? ` · ${company.city}${company.state ? `/${company.state}` : ""}` : ""}`}
        />
        <div className="flex flex-wrap items-center gap-3">
          {piloto && (
            <Link
              href={`/admin/pilotos/${piloto.id}`}
              className="inline-flex items-center gap-1.5 rounded-xs border border-primary/40 px-2 py-1 text-caption text-primary hover:bg-primary/10"
            >
              <span aria-hidden className="size-1.5 bg-primary" />
              {piloto.status === "ativo" ? "Em piloto" : "Piloto planejado"}
            </Link>
          )}
          {company.status === "suspended" ? (
            <Badge tone="danger">Suspensa</Badge>
          ) : (
            <Badge tone={company.onboarding_completed_at ? "success" : "neutral"}>
              {company.onboarding_completed_at ? "Operacional" : "Em configuração"}
            </Badge>
          )}
          <CompanyActions companyId={company.id} status={company.status} />
        </div>
      </div>

      {company.status === "suspended" && company.suspension_reason && (
        <Surface>
          <SurfaceRow>
            <p className="text-body-sm text-foreground">
              <span className="font-medium">Motivo da suspensão:</span> {company.suspension_reason}
            </p>
            {company.suspended_at && (
              <p className="text-caption text-muted mt-0.5">
                desde {new Date(company.suspended_at).toLocaleString("pt-BR")}
              </p>
            )}
          </SurfaceRow>
        </Surface>
      )}

      {uso && (
        <Secao titulo="Visão rápida">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
            <div className="bg-surface p-4 min-w-0">
              <dt className="font-subtitle text-caption text-muted">Último acesso</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 text-body text-foreground">
                {inatividade && inatividade !== "ok" && (
                  <span aria-hidden className={cn("size-2 shrink-0", inatividade === "atencao" ? "bg-warning" : "bg-danger")} />
                )}
                <span className="numero truncate">{haQuanto(uso.ultimo_acesso)}</span>
              </dd>
              <dd className="text-micro text-muted mt-0.5">
                {inatividade === "prolongada"
                  ? "inatividade prolongada (10+ dias)"
                  : inatividade === "atencao"
                    ? "atenção: 7+ dias sem acesso"
                    : inatividade === "nunca_entrou"
                      ? "ninguém entrou ainda"
                      : "acesso recente"}
              </dd>
            </div>
            <div className="bg-surface p-4 min-w-0">
              <dt className="font-subtitle text-caption text-muted">Estado de uso</dt>
              <dd className="text-body-sm text-foreground mt-1.5">{ROTULO_DO_ESTADO[uso.estado]}</dd>
            </div>
            <div className="bg-surface p-4 min-w-0">
              <dt className="font-subtitle text-caption text-muted">Beta</dt>
              <dd className="text-body-sm text-foreground mt-1.5">
                {uso.origem === "convite_beta" ? ROTULO_DO_BETA[uso.beta_status ?? ""] ?? "Convite" : "Cadastro direto"}
                {uso.beta_expira_em && uso.beta_status === "approved" ? ` · até ${new Date(uso.beta_expira_em).toLocaleDateString("pt-BR")}` : ""}
              </dd>
            </div>
            <div className="bg-surface p-4 min-w-0">
              <dt className="font-subtitle text-caption text-muted">Onboarding</dt>
              <dd className="text-body-sm text-foreground mt-1.5">{uso.onboarding_completed ? "Concluído" : "Não concluído"}</dd>
            </div>
          </dl>
        </Secao>
      )}

      {atividade && (
        <Secao titulo="Movimento nos últimos 30 dias">
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border border border-border rounded-md overflow-hidden">
            {[
              ["Agendamentos", String(atividade.agendamentos_periodo)],
              ["Atendimentos", String(atividade.atendimentos_periodo)],
              ["Receita", formatCurrency(atividade.receita_periodo)],
              ["Módulos em uso", `${atividade.modulos_usados} de 7`],
              ["Última atividade", haQuanto(atividade.ultima_atividade)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="bg-surface p-4 min-w-0">
                <dt className="font-subtitle text-caption text-muted truncate">{rotulo}</dt>
                <dd className="numero text-body text-foreground mt-1.5 truncate">{valor}</dd>
              </div>
            ))}
          </dl>
        </Secao>
      )}

      {modulos && (
        <Secao titulo="Módulos utilizados (30 dias)">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
            {MODULOS_DA_MATRIZ.map((m) => {
              const n = Number(modulos[m] ?? 0);
              return (
                <li key={m} className="bg-surface px-4 py-3 min-w-0 flex items-center justify-between gap-3">
                  <span className={cn("text-body-sm truncate", n > 0 ? "text-foreground" : "text-muted")}>{m}</span>
                  <span className={cn("numero text-caption shrink-0", n > 0 ? "text-foreground" : "text-muted")}>{n > 0 ? n : "—"}</span>
                </li>
              );
            })}
          </ul>
        </Secao>
      )}

      {investigacao && (
        <>
          <Secao titulo="Pesquisas e feedback">
            <p className="text-body-sm text-foreground">
              {investigacao.pesquisas.respondidas} de {investigacao.pesquisas.exibidas} pesquisas respondidas
              <span className="text-muted"> · {investigacao.pesquisas.dispensadas} dispensadas</span>
            </p>
            {investigacao.comentarios.length > 0 ? (
              <Surface className="mt-3">
                {investigacao.comentarios.map((c, i) => (
                  <SurfaceRow key={`${c.pesquisa_id}-${i}`}>
                    <p className="text-body-sm text-foreground">
                      {c.texto ?? (c.valor !== null && c.valor !== undefined ? `Resposta: ${typeof c.valor === "boolean" ? (c.valor ? "sim" : "não") : String(c.valor)}` : "—")}
                    </p>
                    <p className="text-caption text-muted">
                      <Link href={`/admin/pesquisas/${c.pesquisa_id}`} className="underline-offset-4 hover:underline">
                        {c.pesquisa}
                      </Link>{" "}
                      · {c.publico} · {haQuanto(c.em)}
                    </p>
                  </SurfaceRow>
                ))}
              </Surface>
            ) : (
              <p className="text-caption text-muted mt-1">Nenhuma resposta ainda.</p>
            )}
          </Secao>

          <Secao titulo="Notificações">
            <p className="text-body-sm text-foreground">
              Push ligado para {investigacao.push.com_push} de {investigacao.push.pessoas} {investigacao.push.pessoas === 1 ? "pessoa" : "pessoas"} da equipe
              <span className="text-muted"> · {investigacao.push.aparelhos} {investigacao.push.aparelhos === 1 ? "aparelho ativo" : "aparelhos ativos"}</span>
            </p>
            {investigacao.notificacoes_30d.length > 0 && (
              <p className="text-caption text-muted mt-1">
                30 dias:{" "}
                {investigacao.notificacoes_30d
                  .map((c) => `${ROTULO_DA_CATEGORIA[c.categoria as Categoria] ?? c.categoria} ${c.total} (${c.abertas} abertas)`)
                  .join(" · ")}
              </p>
            )}
            {investigacao.historico.length > 0 ? (
              <Surface className="mt-3">
                {investigacao.historico.map((h, i) => (
                  <SurfaceRow key={`${h.tipo}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="text-body-sm text-foreground min-w-0">{h.titulo}</p>
                    <p className="text-caption text-muted shrink-0">
                      {ROTULO_DA_PRIORIDADE[h.prioridade as Prioridade] ?? h.prioridade} · {h.destinatarios}{" "}
                      {h.destinatarios === 1 ? "pessoa" : "pessoas"} · {haQuanto(h.em)}
                    </p>
                  </SurfaceRow>
                ))}
              </Surface>
            ) : (
              <p className="text-caption text-muted mt-1">Nenhuma notificação importante nos últimos 90 dias.</p>
            )}
          </Secao>

          <Secao titulo="Incidentes relacionados">
            <p className="text-body-sm text-foreground">
              Erros em produção (30 dias):{" "}
              {errosDaEmpresa === null ? (
                <span className="text-muted">leitura do Sentry indisponível</span>
              ) : (
                <Link href="/admin/sistema#erros" className={cn("numero underline-offset-4 hover:underline", errosDaEmpresa > 0 && "text-danger-ink")}>
                  {errosDaEmpresa}
                </Link>
              )}
            </p>
            {investigacao.incidentes.length > 0 ? (
              <Surface className="mt-3">
                {investigacao.incidentes.map((inc, i) => (
                  <SurfaceRow key={i}>
                    <p className="text-body-sm text-foreground">{inc.titulo}</p>
                    <p className="text-caption text-muted">
                      {inc.corpo} · {haQuanto(inc.em)}
                    </p>
                  </SurfaceRow>
                ))}
              </Surface>
            ) : (
              <p className="text-caption text-muted mt-1">Nenhum aviso de incidente ligado a esta barbearia.</p>
            )}
          </Secao>
        </>
      )}

      <Secao titulo="Identidade">
        <Campo label="Nome" valor={company.name} />
        {company.trade_name && company.trade_name !== company.name && <Campo label="Nome fantasia" valor={company.trade_name} />}
        <Campo label="Endereço" valor={detail.unit_address ?? company.address ?? "Não informado"} />
        <Campo label="Criada em" valor={new Date(company.created_at).toLocaleDateString("pt-BR")} />
        <Campo
          label="Onboarding"
          valor={company.onboarding_completed_at ? `Concluído em ${new Date(company.onboarding_completed_at).toLocaleDateString("pt-BR")}` : "Não concluído"}
        />
      </Secao>

      <Secao titulo="Beta">
        {investigacao?.beta ? (
          <>
            <Campo label="Status da solicitação" valor={ROTULO_DO_BETA[investigacao.beta.status] ?? investigacao.beta.status} />
            <Campo label="Solicitado em" valor={new Date(investigacao.beta.pedido_em).toLocaleDateString("pt-BR")} />
            {investigacao.beta.aprovado_em && <Campo label="Aprovado em" valor={new Date(investigacao.beta.aprovado_em).toLocaleDateString("pt-BR")} />}
            {investigacao.beta.expira_em && <Campo label="Expira em" valor={new Date(investigacao.beta.expira_em).toLocaleDateString("pt-BR")} />}
            {investigacao.beta.regiao && <Campo label="Região" valor={investigacao.beta.regiao} />}
            {uso && (
              <Campo
                label="Utilização do Beta"
                valor={`${uso.modulos_usados} de 7 módulos em 30 dias · ${uso.agendamentos_periodo} agendamentos · ${uso.atendimentos_periodo} atendimentos`}
              />
            )}
          </>
        ) : beta ? (
          <>
            <Campo label="Status da solicitação" valor={ROTULO_DO_BETA[beta.status] ?? beta.status} />
            <Campo label="Solicitado em" valor={new Date(beta.created_at).toLocaleDateString("pt-BR")} />
            {beta.approved_at && <Campo label="Aprovado em" valor={new Date(beta.approved_at).toLocaleDateString("pt-BR")} />}
            {beta.beta_period_months && <Campo label="Período concedido" valor={`${beta.beta_period_months} mês(es)`} />}
            {beta.beta_expires_at && (
              <Campo label="Expira em" valor={new Date(beta.beta_expires_at).toLocaleDateString("pt-BR")} />
            )}
          </>
        ) : (
          <p className="text-body-sm text-muted">
            Nenhuma solicitação de Beta encontrada para o e-mail cadastrado desta empresa.
          </p>
        )}
      </Secao>

      <Secao titulo="Tamanho da operação (total)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
          <Metrica label="Usuários" valor={counts.users} />
          <Metrica label="Profissionais" valor={counts.professionals} />
          <Metrica label="Clientes" valor={counts.clients} />
          <Metrica label="Serviços" valor={counts.services} />
          <Metrica label="Produtos" valor={counts.products} />
          <Metrica label="Agendamentos" valor={counts.appointments} />
          <Metrica label="Vendas concluídas" valor={counts.sales} />
          <Metrica label="Volume financeiro" valor={formatCurrency(counts.sales_total)} />
        </div>
      </Secao>

      <Secao titulo="Acesso">
        {access.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum usuário vinculado.</p>
        ) : (
          <Surface>
            {access.map((a) => (
              <SurfaceRow key={a.user_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="text-body-sm text-foreground truncate">{a.email}</p>
                  <p className="text-caption text-muted">
                    {ROLE_LABEL[a.role] ?? a.role} · vinculado em {new Date(a.linked_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className="text-caption text-muted shrink-0">
                  {a.last_sign_in_at ? `último acesso em ${new Date(a.last_sign_in_at).toLocaleDateString("pt-BR")}` : "nunca acessou"}
                </p>
              </SurfaceRow>
            ))}
          </Surface>
        )}
      </Secao>

      <Secao titulo="Atividade">
        <Campo
          label="Última atividade registrada"
          valor={detail.last_activity_at ? new Date(detail.last_activity_at).toLocaleString("pt-BR") : "Nenhuma atividade ainda"}
        />
      </Secao>

      <Secao titulo="Auditoria">
        {audit.length === 0 && platformAudit.length === 0 ? (
          <p className="text-body-sm text-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <Surface>
            {platformAudit.map((entry) => (
              <SurfaceRow key={`p-${entry.id}`}>
                <p className="text-body-sm text-foreground">{ROTULO_DA_ACAO[entry.action] ?? entry.action}</p>
                <p className="text-caption text-muted">
                  {new Date(entry.created_at).toLocaleString("pt-BR")}
                  {entry.reason ? ` · "${entry.reason}"` : ""}
                </p>
              </SurfaceRow>
            ))}
            {audit.map((entry) => (
              <SurfaceRow key={entry.id}>
                <p className="text-body-sm text-foreground">
                  {ROTULO_DA_ACAO[entry.action] ?? entry.action} <span className="text-muted">· {entry.entity_type}</span>
                </p>
                <p className="text-caption text-muted">{new Date(entry.created_at).toLocaleString("pt-BR")}</p>
              </SurfaceRow>
            ))}
          </Surface>
        )}
      </Secao>

      <Link href="/admin/empresas" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
        ← Voltar para Empresas
      </Link>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-section-title text-foreground mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-body-sm text-foreground">
      <span className="text-muted">{label}:</span> {valor}
    </p>
  );
}

function Metrica({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="bg-surface px-4 py-3.5 min-w-0">
      <p className="font-subtitle text-caption text-muted truncate">{label}</p>
      <p className="numero text-body text-foreground mt-1 truncate">{valor}</p>
    </div>
  );
}
