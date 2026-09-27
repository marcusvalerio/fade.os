import { Suspense } from "react";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import type { PeriodPreset } from "@/actions/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { AcessoRestrito } from "@/components/ui/acesso-restrito";
import { Hoje } from "./Hoje";
import { Resultado } from "./Resultado";

const PRESETS: PeriodPreset[] = ["hoje", "7dias", "mes"];

/**
 * INÍCIO — o centro de comando da barbearia, não uma página de relatório.
 *
 * Duas camadas, na ordem em que o dono pensa às 9h:
 *   1. HOJE      em que estado está a operação, o que pede ação agora
 *                (Pulso, em quatro níveis) e como a equipe está ocupada;
 *   2. RESULTADO como o negócio está indo no período — financeiro com meta,
 *                clientes, equipe, agenda e estoque, cada bloco terminando
 *                num lugar para agir.
 *
 * O resultado chega por streaming (Suspense): "Hoje" aparece antes, sem
 * esperar as contas do período.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams;
  const preset: PeriodPreset = PRESETS.includes(periodo as PeriodPreset) ? (periodo as PeriodPreset) : "7dias";
  const current = await getCurrentCompany();
  const companyId = current!.company.id;

  // Números do negócio: só o responsável/gerente vê. Esconder o link do menu
  // não impede acesso pela URL — a barreira real é esta.
  if (!(await isCompanyManager(companyId))) {
    return (
      <div>
        <PageHeader title="Início" />
        <AcessoRestrito />
      </div>
    );
  }

  const user = await requireAuthenticatedUser();
  const primeiroNome = (user.name || "").split(/\s+/)[0] || "Responsável";

  return (
    <div className="space-y-12">
      <Hoje companyId={companyId} primeiroNome={primeiroNome} />
      <Suspense key={preset} fallback={<ResultadoCarregando />}>
        <Resultado companyId={companyId} preset={preset} />
      </Suspense>
    </div>
  );
}

function ResultadoCarregando() {
  return (
    <div role="status" aria-label="Carregando o resultado do período" className="space-y-5">
      <div className="h-4 w-48 bg-surface-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-9 w-80 max-w-full bg-surface-muted animate-pulse motion-reduce:animate-none" />
      <div className="painel h-80 animate-pulse motion-reduce:animate-none" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="painel h-56 animate-pulse motion-reduce:animate-none" />
        <div className="painel h-56 animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
