import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { PageHeader } from "@/components/ui/page-header";
import { Vazio } from "@/components/ui/estado";
import { CashRegisterCard } from "./CashRegisterCard";
import { ClosedSessionHistory } from "./ClosedSessionHistory";
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

  // A tela só lia sessões abertas: uma sessão fechada simplesmente sumia, e o
  // histórico que a rodada 02 tornou imutável não tinha por onde ser lido.
  // Nada aqui recalcula — a fotografia guardada no fechamento é o que aparece.
  const { data: closedSessions } = await supabase
    .from("cash_session")
    .select(
      "id, cash_register_id, opened_at, closed_at, opening_balance, expected_balance, counted_balance, difference, notes"
    )
    .eq("company_id", current!.company.id)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(20);

  const closedIds = (closedSessions ?? []).map((s) => s.id);
  const { data: closedMovements } = closedIds.length
    ? await supabase
        .from("cash_movement")
        .select("*")
        .in("cash_session_id", closedIds)
        .order("created_at")
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
        <Vazio
          titulo="Nenhum caixa configurado"
          descricao="Um caixa é criado automaticamente junto com a unidade em Configurações."
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

      {(closedSessions ?? []).length > 0 && (
        <ClosedSessionHistory
          sessions={closedSessions ?? []}
          movements={(closedMovements ?? []) as CashMovement[]}
          registers={registers ?? []}
        />
      )}
    </div>
  );
}
