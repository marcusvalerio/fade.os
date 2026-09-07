import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CashRegisterCard } from "./CashRegisterCard";
import type { CashMovement } from "@/lib/types";
import Link from "next/link";

export default async function CaixaPage() {
  const current = await getCurrentCompany();
  const supabase = await createClient();

  const { data: registers } = await supabase
    .from("cash_register")
    .select("id, name")
    .eq("company_id", current!.company.id)
    .eq("active", true)
    .order("created_at");

  const { data: openSessions } = await supabase
    .from("cash_session")
    .select("id, cash_register_id, opening_balance, opened_at")
    .eq("company_id", current!.company.id)
    .eq("status", "open");

  const openSessionIds = (openSessions ?? []).map((s) => s.id);
  const { data: movements } = openSessionIds.length
    ? await supabase.from("cash_movement").select("*").in("cash_session_id", openSessionIds)
    : { data: [] };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Caixa"
        description="Abertura, movimentações e fechamento com divergência."
        action={
          <Link href="/financeiro" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
            Ver financeiro
          </Link>
        }
      />

      {!registers || registers.length === 0 ? (
        <EmptyState
          title="Nenhum caixa configurado"
          description="Um caixa é criado automaticamente junto com a unidade em Configurações."
        />
      ) : (
        registers.map((register) => {
          const session = (openSessions ?? []).find((s) => s.cash_register_id === register.id) ?? null;
          const sessionMovements = ((movements ?? []) as CashMovement[]).filter(
            (m) => m.cash_session_id === session?.id
          );
          return (
            <CashRegisterCard
              key={register.id}
              registerId={register.id}
              registerName={register.name}
              openSession={session}
              movements={sessionMovements}
            />
          );
        })
      )}
    </div>
  );
}
