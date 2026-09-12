"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashSession, closeCashSession, addCashMovement } from "@/actions/caixa";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { formatBusinessTime } from "@/lib/time";
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
    <div className="material-elevated rounded-md">
      <div className="flex items-center justify-between p-5">
        <p className="text-section-title text-foreground">{registerName}</p>
        <Badge tone={openSession ? "success" : "neutral"}>{openSession ? "aberto" : "fechado"}</Badge>
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
            <Button variant="secondary" size="sm" onClick={() => setOpenModal("close")}>
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
          <p className="text-body-sm text-muted">
            Saldo esperado: <strong className="text-foreground">{formatCurrency(currentBalance)}</strong>
          </p>
          <Field name="counted_balance" label="Valor contado" helper="O que você contou na gaveta agora.">
            <MoneyInput value={countedBalance} onValueChange={setCountedBalance} />
          </Field>
          {/* A diferença é o número que vai virar histórico imutável — quem
              fecha precisa vê-la antes de confirmar, não descobrir no toast. */}
          <p className="text-body-sm text-muted">
            Diferença:{" "}
            <strong
              className={Math.abs(diferenca) < 0.01 ? "text-foreground" : "text-danger-ink"}
            >
              {Math.abs(diferenca) < 0.01 ? "nenhuma" : formatCurrency(diferenca)}
            </strong>
          </p>
          <Field
            name="closing_notes"
            label={Math.abs(diferenca) < 0.01 ? "Observação (opcional)" : "O que explica a diferença?"}
          >
            <Textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={2}
              placeholder="Fica guardado junto do fechamento."
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
