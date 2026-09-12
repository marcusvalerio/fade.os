import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatMinutes } from "@/lib/format";
import type { Service } from "@/lib/types";

export default async function ServicosPage() {
  const current = await getCurrentCompany();
  // Catálogo e equipe são administração, não operação. O banco já recusa a
  // escrita para quem não é owner/admin (RLS + trigger assert_admin_write);
  // esta tela deixa de oferecer o que não vai funcionar, no mesmo formato de
  // Financeiro, Relatórios e Configurações.
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div>
        <PageHeader title="Serviços" />
        <Vazio
          titulo="Acesso restrito"
          descricao="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: services } = await supabase
    .from("service")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  // R23 P1-02: o domínio permite um serviço ativo sem ninguém para
  // executá-lo (a ligação é uma decisão manual, não uma trava do sistema) —
  // o problema era a lista não avisar disso. Uma contagem por serviço, não
  // uma trava: só muda o que a pessoa vê, nunca o que pode salvar.
  const serviceIds = (services ?? []).map((s) => s.id);
  const { data: links } = serviceIds.length
    ? await supabase.from("professional_service").select("service_id").in("service_id", serviceIds)
    : { data: [] as { service_id: string }[] | null };
  const servicosComProfissional = new Set((links ?? []).map((l) => l.service_id));

  return (
    <div>
      <PageHeader
        title="Serviços"
        description="O que sua barbearia vende como atendimento profissional — corte, barba, combo."
        action={
          <Link href="/servicos/novo" className={buttonClasses()}>
            Novo serviço
          </Link>
        }
      />

      <Surface>
        {(services as Service[] | null)?.length ? (
          (services as Service[]).map((s) => (
            <Link key={s.id} href={`/servicos/${s.id}`} className="block">
              <SurfaceRow className="flex items-center justify-between gap-3 hover:bg-surface-muted">
                {/* O nome agora tem teto de 80 caracteres, mas os registros
                    antigos do laboratório passam de 300 e empurravam a lista
                    para 2.530px numa tela de 390px. `min-w-0` + `truncate`
                    fazem a linha caber sem esconder o dado: ele continua
                    inteiro na ficha do serviço. */}
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-caption text-muted mt-0.5">
                    {formatCurrency(s.default_price)} · {formatMinutes(s.planned_duration_minutes)}
                  </p>
                  {!servicosComProfissional.has(s.id) && (
                    <p className="text-caption text-info-ink mt-0.5">Sem profissional vinculado</p>
                  )}
                </div>
                <Badge tone={s.status === "active" ? "success" : "neutral"} className="shrink-0">
                  {s.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </SurfaceRow>
            </Link>
          ))
        ) : (
          <Vazio
            titulo="Nenhum serviço cadastrado ainda"
            descricao="Cadastre o que sua empresa oferece para poder agendar e atender."
            acao={
              <Link href="/servicos/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo serviço
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
