import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { hasAuthorizationCode } from "@/actions/configuracoes";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { PublicPageSettingsPanel } from "./PublicPageSettingsPanel";
import { PublicPageContentPanel } from "./PublicPageContentPanel";
import { UnitSettingsForm } from "./UnitSettingsForm";
import { UnitBusinessHoursEditor } from "./UnitBusinessHoursEditor";
import { PaymentMethodsPanel } from "./PaymentMethodsPanel";
import { AuthorizationCodePanel } from "./AuthorizationCodePanel";
import { SelfProfessionalToggle } from "./SelfProfessionalToggle";
import { DeleteAccountPanel } from "./DeleteAccountPanel";
import { MetaMensalForm } from "./MetaMensalForm";
import Link from "next/link";
import { provedoresOAuth } from "@/lib/auth-provedores";
import { BotaoReverApresentacao } from "@/components/apresentacao";
import { buttonClasses } from "@/components/ui/button";
import type { Company, Unit, PaymentMethodKey, UnitBusinessHours } from "@/lib/types";

export default async function ConfiguracoesPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const user = await requireAuthenticatedUser();
  // Configurações da empresa (dados, unidade, pagamentos, autorização,
  // página pública) são só do responsável/gerente — mas excluir a própria
  // conta é uma decisão pessoal, de qualquer pessoa com login, staff
  // incluído. Por isso quem não gerencia a empresa vê uma versão reduzida
  // desta tela, nunca "acesso restrito" (isso deixaria staff sem nenhuma
  // rota para excluir a própria conta).
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div className="max-w-2xl">
        <PageHeader eyebrow="Barbearia" title="Configurações" description="O que você pode ajustar por aqui." />
        <div className="divide-y divide-border border-t border-border">
          <Grupo titulo="Notificações" descricao="O que o CORTEX avisa você, aqui e no aparelho.">
            <LinkDeNotificacoes />
          </Grupo>
          <Grupo
            titulo="Excluir conta"
            descricao="Remove o acesso desta conta às empresas vinculadas. Não apaga a empresa nem o histórico comercial dela."
          >
            <DeleteAccountPanel />
          </Grupo>
        </div>
      </div>
    );
  }

  // Consultas independentes em paralelo (antes: seis idas ao banco em fila).
  const companyId = current!.company.id;
  const [{ data: company }, { data: units }, { data: paymentMethods }, { data: selfProfessional }, provedores, codigoConfigurado] =
    await Promise.all([
      supabase.from("company").select("*").eq("id", companyId).single(),
      supabase.from("unit").select("*").eq("company_id", companyId).order("created_at"),
      supabase.from("payment_method").select("method, active").eq("company_id", companyId).eq("active", true),
      supabase.from("professional").select("active").eq("company_id", companyId).eq("user_id", user.id).maybeSingle(),
      provedoresOAuth(),
      hasAuthorizationCode(companyId),
    ]);

  // Horários dependem das unidades.
  const unitIds = (units ?? []).map((u) => u.id);
  const { data: businessHours } = unitIds.length
    ? await supabase.from("unit_business_hours").select("*").in("unit_id", unitIds)
    : { data: [] };

  const activeMethods = (paymentMethods ?? []).map((p) => p.method as PaymentMethodKey);
  const unitPrincipal = (units as Unit[] | null)?.[0];
  const metaAtual = Number(((unitPrincipal?.settings ?? {}) as Record<string, unknown>).meta_faturamento_mensal ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Barbearia"
        title="Configurações"
        description="Cada coisa no seu contexto: o que muda quando você mexe aqui está escrito ao lado."
      />

      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        {/* Índice: no desktop fica fixo ao lado; no celular, uma faixa
            rolável no topo — nunca empurra a página para o lado. */}
        <nav aria-label="Seções das configurações" className="mb-6 lg:mb-0">
          <ul className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 lg:flex-col lg:overflow-visible lg:sticky lg:top-8">
            {SECOES.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="block rounded-sm px-3 py-1.5 text-body-sm text-muted hover:text-foreground hover:bg-surface-muted/60 whitespace-nowrap"
                >
                  {s.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-2xl divide-y divide-border border-t border-border">
          <Grupo id="empresa" titulo="Empresa" descricao="Nome, documento, contatos e endereço — como a barbearia aparece dentro e fora do sistema.">
            <CompanySettingsForm company={company as Company} />
          </Grupo>

          <Grupo
            id="operacao"
            titulo="Operação"
            descricao="A unidade e o horário de funcionamento. É o funcionamento daqui, cruzado com a jornada de cada profissional, que decide os horários oferecidos."
          >
            <div className="space-y-6">
              {(units as Unit[] | null)?.map((unit) => (
                <div key={unit.id} className="space-y-4">
                  <UnitSettingsForm unit={unit} />
                  <div>
                    <p className="font-subtitle text-caption text-muted mb-2">Horário de funcionamento</p>
                    <UnitBusinessHoursEditor
                      unitId={unit.id}
                      hours={(businessHours as UnitBusinessHours[] | null)?.filter((h) => h.unit_id === unit.id) ?? []}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Grupo>

          <Grupo
            id="agenda"
            titulo="Agenda e agendamento online"
            descricao="Onde o cliente marca sozinho e como os horários são decididos."
          >
            <div className="space-y-6">
              <PublicPageSettingsPanel companyId={current!.company.id} slug={(company as Company).slug} />
              <div>
                <p className="font-subtitle text-caption text-muted mb-2">Vitrine da página</p>
                <PublicPageContentPanel company={company as Company} />
              </div>
              <Regras
                titulo="Como a agenda decide"
                itens={[
                  "Um horário só aparece se cabe inteiro dentro da jornada do profissional e do funcionamento da unidade, fora de intervalos, bloqueios e ausências.",
                  "Horário que já passou nunca é oferecido. Dois agendamentos nunca ocupam o mesmo profissional ao mesmo tempo — o banco recusa.",
                  "O cliente cancela pelo link do horário (ou pela conta dele) enquanto estiver Agendado ou Confirmado. A barbearia reagenda pela Agenda.",
                ]}
                rodape={
                  <>
                    Jornadas, intervalos e ausências de cada profissional ficam em{" "}
                    <Link href="/profissionais" className="text-foreground underline underline-offset-4 decoration-signal">
                      Equipe
                    </Link>
                    .
                  </>
                }
              />
            </div>
          </Grupo>

          <Grupo
            id="atendimento"
            titulo="Atendimento"
            descricao="O código pedido para desconto e cortesia quando quem opera não é responsável nem gerente."
          >
            <AuthorizationCodePanel companyId={current!.company.id} configured={codigoConfigurado} />
          </Grupo>

          <Grupo
            id="financeiro"
            titulo="Financeiro"
            descricao="Como a barbearia recebe e aonde quer chegar no mês."
          >
            <div className="space-y-7">
              <div>
                <p className="font-subtitle text-caption text-muted mb-2">Formas de pagamento</p>
                <p className="text-caption text-muted mb-3">Só o que estiver ativo aparece no fechamento e na venda.</p>
                <PaymentMethodsPanel companyId={current!.company.id} activeMethods={activeMethods} />
              </div>
              <MetaMensalForm companyId={current!.company.id} metaAtual={metaAtual} />
            </div>
          </Grupo>

          <Grupo id="equipe" titulo="Equipe e serviços" descricao="Cadastros que têm tela própria — aqui fica só o caminho até eles.">
            <ul className="divide-y divide-border border-y border-border">
              {[
                ["/profissionais", "Profissionais", "Quem atende, jornada, intervalos, ausências, comissão e acesso ao CORTEX."],
                ["/servicos", "Serviços", "Preço, duração, comissão, quem faz cada um e o que aparece na página pública."],
                ["/produtos", "Produtos", "Preço, custo, estoque mínimo."],
              ].map(([href, rotulo, texto]) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center justify-between gap-4 py-3">
                    <span className="min-w-0">
                      <span className="block text-body-sm font-medium text-foreground">{rotulo}</span>
                      <span className="block text-caption text-muted">{texto}</span>
                    </span>
                    <span aria-hidden className="text-muted group-hover:text-foreground">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Grupo>

          <Grupo
            id="notificacoes"
            titulo="Notificações"
            descricao="O que o CORTEX avisa e para quem."
          >
            <LinkDeNotificacoes />
            <div className="mt-4">
              <Regras
                titulo="Como funciona"
                itens={[
                  "O CORTEX avisa a equipe dentro do sistema (o sino) e, se a pessoa permitir, no celular ou computador: novos agendamentos online, cancelamentos, clientes que chegaram, avaliações, estoque que acabou, caixa com diferença, comissões pagas.",
                  "Clientes com conta na página da barbearia recebem confirmação, mudança de horário e lembrete cerca de 2 horas antes.",
                  "Cada pessoa escolhe o que quer receber; avisos de segurança não podem ser desligados.",
                  "WhatsApp continua pelo aparelho: confirmação de horário e convite de retorno saem prontos, e quem envia é a equipe.",
                ]}
              />
            </div>
          </Grupo>

          <Grupo id="integracoes" titulo="Integrações" descricao="Serviços externos ligados ao CORTEX — só o que existe de verdade.">
            <ul className="divide-y divide-border border-y border-border">
              <Integracao
                nome="Login com Google (clientes)"
                estado={provedores.google ? "Ligado" : "Desligado"}
                ligado={provedores.google}
                texto="Seus clientes podem entrar na área deles com a conta Google. A equipe entra sempre com e-mail e senha."
              />
              <Integracao
                nome="WhatsApp"
                estado="Pelo aparelho"
                ligado
                texto="Mensagens prontas abrem no WhatsApp de quem está operando. Não há envio automático nem integração com a API do WhatsApp."
              />
              <Integracao nome="Webhooks e API" estado="Não disponível" ligado={false} texto="Nenhuma integração externa por API está ativa." />
            </ul>
          </Grupo>

          <Grupo id="conta" titulo="Sua conta" descricao="Vale só para você.">
            <div className="space-y-7">
              <div>
                <p className="font-subtitle text-caption text-muted mb-2">Também atendo</p>
                <p className="text-caption text-muted mb-3">
                  Se você também corta cabelo, ative a agenda de profissional para a sua própria conta — sem criar um segundo login.
                </p>
                <SelfProfessionalToggle enabled={selfProfessional?.active === true} />
              </div>
              <div>
                <p className="font-subtitle text-caption text-muted mb-2">Aparência neste aparelho</p>
                <ThemeToggle />
              </div>
              <div>
                <p className="font-subtitle text-caption text-muted mb-2">Apresentação</p>
                <BotaoReverApresentacao className={buttonClasses({ variant: "secondary", size: "sm" })} />
              </div>
              <div>
                <p className="font-subtitle text-caption text-muted mb-2">Excluir conta</p>
                <p className="text-caption text-muted mb-3">
                  Remove o acesso desta conta às empresas vinculadas. Não apaga a empresa nem o histórico comercial dela.
                </p>
                <DeleteAccountPanel />
              </div>
            </div>
          </Grupo>
        </div>
      </div>
    </div>
  );
}

const SECOES = [
  { id: "empresa", rotulo: "Empresa" },
  { id: "operacao", rotulo: "Operação" },
  { id: "agenda", rotulo: "Agenda" },
  { id: "atendimento", rotulo: "Atendimento" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "equipe", rotulo: "Equipe e serviços" },
  { id: "notificacoes", rotulo: "Notificações" },
  { id: "integracoes", rotulo: "Integrações" },
  { id: "conta", rotulo: "Sua conta" },
];

function Regras({ titulo, itens, rodape }: { titulo: string; itens: string[]; rodape?: React.ReactNode }) {
  return (
    <div>
      <p className="font-subtitle text-caption text-muted mb-2">{titulo}</p>
      <ul className="space-y-2">
        {itens.map((t) => (
          <li key={t} className="flex gap-3 text-body-sm text-foreground">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-brand-blue" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {rodape && <p className="text-caption text-muted mt-3">{rodape}</p>}
    </div>
  );
}

function Integracao({ nome, estado, ligado, texto }: { nome: string; estado: string; ligado: boolean; texto: string }) {
  return (
    <li className="py-3 flex items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-body-sm font-medium text-foreground">{nome}</span>
        <span className="block text-caption text-muted mt-0.5">{texto}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0 text-caption text-foreground">
        <span aria-hidden className={ligado ? "size-1.5 bg-success" : "size-1.5 border border-border-strong"} />
        {estado}
      </span>
    </li>
  );
}

/**
 * Um grupo de configuração.
 *
 * Título, uma linha de consequência, e o painel. A linha de consequência é o
 * que impede a tela de virar um monte de campo sem dono: ela responde "o que
 * acontece se eu mexer aqui" antes de a pessoa mexer.
 */
function LinkDeNotificacoes() {
  return (
    <Link
      href="/configuracoes/notificacoes"
      className="group flex items-center justify-between gap-4 border-y border-border py-3"
    >
      <span className="min-w-0">
        <span className="block text-body-sm font-medium text-foreground">Suas notificações</span>
        <span className="block text-caption text-muted">Escolha o que receber e ligue os avisos neste aparelho.</span>
      </span>
      <span aria-hidden className="text-muted group-hover:text-foreground">→</span>
    </Link>
  );
}

function Grupo({
  id,
  titulo,
  descricao,
  children,
}: {
  id?: string;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-8 first:pt-6 scroll-mt-20">
      <h2 className="text-section-title text-foreground">{titulo}</h2>
      <p className="text-body-sm text-muted mt-1 mb-4 max-w-prose">{descricao}</p>
      {children}
    </section>
  );
}
