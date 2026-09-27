"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashSession, closeCashSession, addCashMovement } from "@/actions/caixa";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { formatBusinessTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { CashMovement } from "@/lib/types";

type OpenSession = {
  id: string;
  opening_balance: number;
  opened_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  sale_payment: "Venda",
  suprimento: "Suprimento",
  sangria: "Sangria",
  other_in: "Entrada",
  other_out: "Saída",
};

const ENTRADAS = ["sale_payment", "suprimento", "other_in"];

export function CashRegisterCard({
  registerId,
  registerName,
  openSession,
  movements,
}: {
  registerId: string;
  registerName: string;
  openSession: OpenSession | null;
  movements: CashMovement[];
}) {
  const { show } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openModal, setOpenModal] = useState<"open" | "close" | "movement" | null>(null);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [countedBalance, setCountedBalance] = useState(0);
  // A diferença só é mostrada depois que a pessoa informa o que contou —
  // antes disso, "falta R$ 557" seria um alarme falso.
  const [contou, setContou] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [movementType, setMovementType] = useState<"sangria" | "suprimento">("sangria");
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementReason, setMovementReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Sinal de sucesso do botão que acabou de agir — não do `pending`, que
  // também desce quando a ação falha.
  const [sucessoEm, setSucessoEm] = useState<number>();

  const inflow = movements
    .filter((m) => ["sale_payment", "suprimento", "other_in"].includes(m.type))
    .reduce((s, m) => s + Number(m.amount), 0);
  const outflow = movements
    .filter((m) => ["sangria", "other_out"].includes(m.type))
    .reduce((s, m) => s + Number(m.amount), 0);
  const currentBalance = (openSession?.opening_balance ?? 0) + inflow - outflow;
  const diferenca = Math.round((countedBalance - currentBalance) * 100) / 100;
  // Prévia da consequência no saldo, enquanto a pessoa ainda está digitando
  // — "o que vai acontecer" antes de confirmar, não depois.
  const saldoAposMovimento =
    movementType === "sangria" ? currentBalance - movementAmount : currentBalance + movementAmount;

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      const result = await openCashSession(registerId, openingBalance);
      if (!result.ok) return setError(result.error);
      show("Caixa aberto.", "success");
      setOpenModal(null);
      setSucessoEm(Date.now());
      // O servidor já revalidou o caminho — sem isto, a pessoa continuaria
      // vendo "aberto" com os botões de sempre depois de fechar o caixa, o
      // tipo de estado que engana em vez de informar.
      router.refresh();
    });
  }

  function handleClose() {
    if (!openSession) return;
    setError(null);
    startTransition(async () => {
      const result = await closeCashSession(openSession.id, countedBalance, closingNotes);
      if (!result.ok) return setError(result.error);
      show(
        Math.abs(result.data.difference) < 0.01
          ? "Caixa fechado sem divergência."
          : `Caixa fechado com diferença de ${formatCurrency(result.data.difference)}.`,
        Math.abs(result.data.difference) < 0.01 ? "success" : "danger"
      );
      setClosingNotes("");
      setOpenModal(null);
      setSucessoEm(Date.now());
      router.refresh();
    });
  }

  function handleMovement() {
    if (!openSession) return;
    setError(null);
    startTransition(async () => {
      const result = await addCashMovement({
        cash_session_id: openSession.id,
        type: movementType,
        amount: movementAmount,
        reason: movementReason,
      });
      if (!result.ok) return setError(result.error);
      show("Movimentação registrada.", "success");
      setOpenModal(null);
      setMovementAmount(0);
      setMovementReason("");
      setSucessoEm(Date.now());
      router.refresh();
    });
  }

  return (
    // material-elevated (R18): é o cartão de estado principal da tela — o
    // mesmo papel que Bloco tem no Início.
    // is-updating (R23, P1-03): entre a confirmação (toast) e o
    // router.refresh() realmente repintar este cartão com o estado novo, a
    // auditoria flagrou até 3,4s em que o cartão mostrava "fechado" com um
    // saldo antigo — sem nada dizendo que ainda estava a caminho. `pending`
    // já existia (é o mesmo que desabilita o botão dentro do modal); só
    // faltava usá-lo aqui fora, onde a pessoa realmente está olhando.
    <div className={cn("material-elevated rounded-md", pending && "is-updating")} aria-busy={pending}>
      <div className="flex items-center justify-between gap-3 p-5">
        <p className="text-section-title text-foreground">{registerName}</p>
        {/* O estado é o sinal do CORTEX, não um badge: quadrado cheio = aberto
            (com a hora, que é o que se pergunta no balcão), vazado = fechado. */}
        <p className="flex items-center gap-2 text-caption text-muted shrink-0">
          <span
            aria-hidden="true"
            className={cn("size-2", openSession ? "bg-success" : "border border-border-strong")}
          />
          {openSession ? `Aberto desde ${formatBusinessTime(openSession.opened_at)}` : "Fechado"}
        </p>
      </div>

      {openSession ? (
        <>
          {/* O saldo é a única resposta que importa olhando de longe — ganha
              o mesmo peso de um KPI, não o de um título de seção. */}
          <div className="flex items-baseline justify-between px-5 pb-4">
            <span className="text-body-sm text-muted">Saldo esperado agora</span>
            <span className="text-metric font-heading text-foreground tabular-nums">
              {formatCurrency(currentBalance)}
            </span>
          </div>
          {/* De onde vem o esperado — a mesma conta que o fechamento grava. */}
          <dl className="mx-5 mb-4 grid grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden text-center">
            {[
              { r: "Abertura", v: openSession.opening_balance ?? 0, sinal: "" },
              { r: "Entrou", v: inflow, sinal: "+" },
              { r: "Saiu", v: outflow, sinal: "−" },
            ].map((f) => (
              <div key={f.r} className="bg-surface px-2 py-2.5">
                <dt className="font-subtitle text-micro uppercase text-muted">{f.r}</dt>
                <dd className="numero text-body-sm text-foreground mt-0.5">
                  {f.sinal}
                  {formatCurrency(Number(f.v))}
                </dd>
              </div>
            ))}
          </dl>

          {/* Movimentações de hoje — antes o saldo aparecia pronto, sem como
              conferir de onde ele veio enquanto o caixa ainda estava aberto.
              A mesma pergunta que o histórico de sessões fechadas responde
              (o que aconteceu?) valia também para a sessão em curso. */}
          {movements.length > 0 && (
            <div className="border-t border-border">
              <p className="text-label uppercase text-muted px-5 pt-3 pb-1.5">Movimentações de hoje</p>
              <div className="divide-y divide-border max-h-56 overflow-y-auto">
                {[...movements]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-body-sm text-foreground">{TIPO_LABEL[m.type] ?? m.type}</p>
                        <p className="text-caption text-muted truncate">
                          {formatBusinessTime(m.created_at)}
                          {m.reason ? ` · ${m.reason}` : ""}
                        </p>
                      </div>
                      <span
                        className={
                          "text-body-sm tabular-nums shrink-0 " +
                          (ENTRADAS.includes(m.type) ? "text-success-ink" : "text-foreground")
                        }
                      >
                        {ENTRADAS.includes(m.type) ? "+" : "−"}
                        {formatCurrency(Number(m.amount))}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 p-5 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setOpenModal("movement")}>
              Sangria / suprimento
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setContou(false);
                setCountedBalance(0);
                setOpenModal("close");
              }}
            >
              Fechar caixa
            </Button>
          </div>
        </>
      ) : (
        <div className="p-5 pt-0">
          <Button size="sm" onClick={() => setOpenModal("open")}>
            Abrir caixa
          </Button>
        </div>
      )}

      <Modal open={openModal === "open"} onClose={() => setOpenModal(null)} title="Abrir caixa">
        <div className="space-y-4">
          <Field name="opening_balance" label="Saldo inicial" helper="O que já está na gaveta antes da primeira venda.">
            <MoneyInput value={openingBalance} onValueChange={setOpeningBalance} />
          </Field>
          {error && <Aviso tom="erro">{error}</Aviso>}
          <BotaoDeAcaoClique
            pending={pending}
            rotuloPendente="Abrindo…"
            onClick={handleOpen}
            className="w-full"
          >
            Abrir caixa
          </BotaoDeAcaoClique>
        </div>
      </Modal>

      <Modal open={openModal === "close"} onClose={() => setOpenModal(null)} title="Fechar caixa">
        <div className="space-y-4">
          {/* A conferência lida de cima para baixo: o que o sistema espera, o
              que a pessoa contou, e o resultado — com o mesmo peso de um número
              de KPI, porque é o número que vira histórico imutável. */}
          <div className="rounded-md border border-border divide-y divide-border">
            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="text-body-sm text-muted">Esperado na gaveta</span>
              <span className="text-body font-medium text-foreground tabular-nums">
                {formatCurrency(currentBalance)}
              </span>
            </div>
            <div className="px-4 py-3">
              <Field name="counted_balance" label="Contado agora" helper="O que você contou na gaveta, cédula por cédula.">
                <MoneyInput
                  value={countedBalance}
                  onValueChange={(v) => {
                    setCountedBalance(v);
                    setContou(true);
                  }}
                />
              </Field>
            </div>
            <div
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-normal ease-standard",
                contou && Math.abs(diferenca) >= 0.01 && (diferenca < 0 ? "bg-danger/10" : "bg-warning/10")
              )}
              aria-live="polite"
            >
              <span className="flex items-center gap-2 text-label uppercase">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2",
                    !contou
                      ? "border border-border-strong"
                      : Math.abs(diferenca) < 0.01
                        ? "bg-success"
                        : diferenca < 0
                          ? "bg-danger"
                          : "bg-warning"
                  )}
                />
                <span
                  className={cn(
                    !contou
                      ? "text-muted"
                      : Math.abs(diferenca) < 0.01
                        ? "text-success-ink"
                        : diferenca < 0
                          ? "text-danger-ink"
                          : "text-warning-ink"
                  )}
                >
                  {!contou
                    ? "Aguardando a contagem"
                    : Math.abs(diferenca) < 0.01
                      ? "Confere"
                      : diferenca < 0
                        ? "Falta na gaveta"
                        : "Sobra na gaveta"}
                </span>
              </span>
              {contou && Math.abs(diferenca) >= 0.01 && (
                <span
                  className={cn(
                    "text-metric-sm tabular-nums",
                    diferenca < 0 ? "text-danger-ink" : "text-warning-ink"
                  )}
                >
                  {formatCurrency(Math.abs(diferenca))}
                </span>
              )}
            </div>
          </div>
          <Field
            name="closing_notes"
            label={contou && Math.abs(diferenca) >= 0.01 ? "O que explica a diferença?" : "Observação (opcional)"}
            helper={
              contou && Math.abs(diferenca) >= 0.01
                ? "Fica guardado junto do fechamento — é o que quem abrir o histórico vai ler."
                : undefined
            }
          >
            <Textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: troco dado a mais para um cliente."
            />
          </Field>
          {error && <Aviso tom="erro">{error}</Aviso>}
          <BotaoDeAcaoClique
            pending={pending}
            rotuloPendente="Fechando…"
            onClick={handleClose}
            className="w-full"
          >
            Confirmar fechamento
          </BotaoDeAcaoClique>
        </div>
      </Modal>

      <Modal open={openModal === "movement"} onClose={() => setOpenModal(null)} title="Sangria / suprimento">
        <div className="space-y-4">
          <Field name="type" label="Tipo">
            <Select value={movementType} onChange={(e) => setMovementType(e.target.value as typeof movementType)}>
              <option value="sangria">Sangria (retirada)</option>
              <option value="suprimento">Suprimento (entrada)</option>
            </Select>
          </Field>
          <Field name="amount" label="Valor">
            <MoneyInput value={movementAmount} onValueChange={setMovementAmount} />
          </Field>
          <Field name="reason" label="Motivo" required>
            <Textarea value={movementReason} onChange={(e) => setMovementReason(e.target.value)} rows={2} />
          </Field>
          {movementAmount > 0 && (
            <p className="text-body-sm text-muted">
              Saldo depois desta {movementType === "sangria" ? "saída" : "entrada"}:{" "}
              <strong className="text-foreground tabular-nums">{formatCurrency(saldoAposMovimento)}</strong>
            </p>
          )}
          {error && <Aviso tom="erro">{error}</Aviso>}
          <BotaoDeAcaoClique
            pending={pending}
            rotuloPendente="Registrando…"
            disabled={movementAmount <= 0 || movementReason.trim().length < 2}
            onClick={handleMovement}
            className="w-full"
          >
            Registrar
          </BotaoDeAcaoClique>
        </div>
      </Modal>
    </div>
  );
}
