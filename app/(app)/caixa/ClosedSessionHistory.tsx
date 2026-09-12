import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { formatBusinessDate, formatBusinessTime } from "@/lib/time";
import type { CashMovement } from "@/lib/types";

type ClosedSession = {
  id: string;
  cash_register_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  expected_balance: number | null;
  counted_balance: number | null;
  difference: number | null;
  notes: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  sale_payment: "Venda",
  suprimento: "Suprimento",
  sangria: "Sangria",
  other_in: "Entrada",
  other_out: "Saída",
};

const ENTRADAS = ["sale_payment", "suprimento", "other_in"];

/**
 * O que sobrou de uma sessão de caixa depois de fechada.
 *
 * A rodada 02 tornou a fotografia imutável; faltava poder olhar para ela. A
 * tela só lia sessões abertas, então uma sessão fechada parecia não ter
 * existido. Aqui nada é recalculado: são exatamente os valores gravados no
 * fechamento, mais os movimentos que os produziram.
 */
export function ClosedSessionHistory({
  sessions,
  movements,
  registers,
}: {
  sessions: ClosedSession[];
  movements: CashMovement[];
  registers: { id: string; name: string }[];
}) {
  return (
    <section>
      <h2 className="text-section-title text-foreground mb-1">Sessões fechadas</h2>
      <p className="text-body-sm text-muted mb-3">
        Cada fechamento guarda o que foi contado e a diferença apurada. Estes números não mudam
        depois.
      </p>

      <div className="space-y-2">
        {sessions.map((session) => {
          const itens = movements.filter((m) => m.cash_session_id === session.id);
          const entradas = itens
            .filter((m) => ENTRADAS.includes(m.type))
            .reduce((soma, m) => soma + Number(m.amount), 0);
          const saidas = itens
            .filter((m) => !ENTRADAS.includes(m.type))
            .reduce((soma, m) => soma + Number(m.amount), 0);
          const diferenca = Number(session.difference ?? 0);
          const registro = registers.find((r) => r.id === session.cash_register_id);

          return (
            <details
              key={session.id}
              className="material-solid rounded-md overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-foreground">
                    {formatBusinessDate(session.opened_at, {
                      day: "2-digit",
                      month: "short",
                    })}
                    {" · "}
                    {formatBusinessTime(session.opened_at)}
                    {session.closed_at ? ` às ${formatBusinessTime(session.closed_at)}` : ""}
                  </p>
                  <p className="text-caption text-muted mt-0.5 truncate">
                    {registro?.name ?? "Caixa"} · contado{" "}
                    {formatCurrency(Number(session.counted_balance ?? 0))}
                  </p>
                </div>
                <Badge tone={Math.abs(diferenca) < 0.01 ? "success" : "danger"}>
                  {Math.abs(diferenca) < 0.01
                    ? "sem divergência"
                    : `${diferenca > 0 ? "sobra" : "falta"} ${formatCurrency(Math.abs(diferenca))}`}
                </Badge>
              </summary>

              <div className="border-t border-border px-4 py-3 space-y-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-sm">
                  <Linha rotulo="Fundo de abertura" valor={Number(session.opening_balance)} />
                  <Linha rotulo="Entradas" valor={entradas} />
                  <Linha rotulo="Saídas" valor={-saidas} />
                  <Linha rotulo="Saldo esperado" valor={Number(session.expected_balance ?? 0)} />
                  <Linha rotulo="Valor contado" valor={Number(session.counted_balance ?? 0)} />
                  <Linha rotulo="Diferença" valor={diferenca} destacar={Math.abs(diferenca) >= 0.01} />
                </dl>

                {session.notes && (
                  <p className="text-body-sm text-muted border-l-2 border-border pl-3">
                    {session.notes}
                  </p>
                )}

                {itens.length > 0 ? (
                  <div className="rounded-md border border-border divide-y divide-border">
                    {itens.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-caption text-foreground">
                            {TIPO_LABEL[m.type] ?? m.type}
                          </p>
                          {m.reason && (
                            <p className="text-caption text-muted truncate">{m.reason}</p>
                          )}
                        </div>
                        <span className="text-caption tabular-nums text-foreground shrink-0">
                          {ENTRADAS.includes(m.type) ? "+" : "−"}
                          {formatCurrency(Number(m.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-caption text-muted">
                    Nenhuma movimentação durante esta sessão.
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function Linha({
  rotulo,
  valor,
  destacar,
}: {
  rotulo: string;
  valor: number;
  destacar?: boolean;
}) {
  return (
    <>
      <dt className="text-muted">{rotulo}</dt>
      <dd
        className={`text-right tabular-nums ${destacar ? "text-danger-ink" : "text-foreground"}`}
      >
        {formatCurrency(valor)}
      </dd>
    </>
  );
}
