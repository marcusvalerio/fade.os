"use client";

import { useState, useTransition } from "react";
import { openCashSession, closeCashSession, addCashMovement } from "@/actions/caixa";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import type { CashMovement } from "@/lib/types";

type OpenSession = {
  id: string;
  opening_balance: number;
  opened_at: string;
};

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
  const [pending, startTransition] = useTransition();
  const [openModal, setOpenModal] = useState<"open" | "close" | "movement" | null>(null);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [countedBalance, setCountedBalance] = useState(0);
  const [movementType, setMovementType] = useState<"sangria" | "suprimento">("sangria");
  const [movementAmount, setMovementAmount] = useState(0);
  const [movementReason, setMovementReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inflow = movements
    .filter((m) => ["sale_payment", "suprimento", "other_in"].includes(m.type))
    .reduce((s, m) => s + Number(m.amount), 0);
  const outflow = movements
    .filter((m) => ["sangria", "other_out"].includes(m.type))
    .reduce((s, m) => s + Number(m.amount), 0);
  const currentBalance = (openSession?.opening_balance ?? 0) + inflow - outflow;

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      const result = await openCashSession(registerId, openingBalance);
      if (!result.ok) return setError(result.error);
      show("Caixa aberto.", "success");
      setOpenModal(null);
    });
  }

  function handleClose() {
    if (!openSession) return;
    setError(null);
    startTransition(async () => {
      const result = await closeCashSession(openSession.id, countedBalance);
      if (!result.ok) return setError(result.error);
      show(
        Math.abs(result.data.difference) < 0.01
          ? "Caixa fechado sem divergência."
          : `Caixa fechado com diferença de ${formatCurrency(result.data.difference)}.`,
        Math.abs(result.data.difference) < 0.01 ? "success" : "danger"
      );
      setOpenModal(null);
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
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-section-title text-foreground">{registerName}</p>
        <Badge tone={openSession ? "success" : "neutral"}>{openSession ? "aberto" : "fechado"}</Badge>
      </div>

      {openSession ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-body-sm text-muted">Saldo esperado agora</span>
            <span className="text-section-title text-foreground tabular-nums">
              {formatCurrency(currentBalance)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpenModal("movement")}>
              Sangria / suprimento
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOpenModal("close")}>
              Fechar caixa
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" onClick={() => setOpenModal("open")}>
          Abrir caixa
        </Button>
      )}

      <Modal open={openModal === "open"} onClose={() => setOpenModal(null)} title="Abrir caixa">
        <div className="space-y-4">
          <Field name="opening_balance" label="Saldo inicial">
            <MoneyInput value={openingBalance} onValueChange={setOpeningBalance} />
          </Field>
          {error && <p className="text-body-sm text-danger">{error}</p>}
          <Button pending={pending} onClick={handleOpen} className="w-full">
            Abrir
          </Button>
        </div>
      </Modal>

      <Modal open={openModal === "close"} onClose={() => setOpenModal(null)} title="Fechar caixa">
        <div className="space-y-4">
          <p className="text-body-sm text-muted">
            Saldo esperado: <strong className="text-foreground">{formatCurrency(currentBalance)}</strong>
          </p>
          <Field name="counted_balance" label="Valor contado">
            <MoneyInput value={countedBalance} onValueChange={setCountedBalance} />
          </Field>
          {error && <p className="text-body-sm text-danger">{error}</p>}
          <Button pending={pending} onClick={handleClose} className="w-full">
            Confirmar fechamento
          </Button>
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
          {error && <p className="text-body-sm text-danger">{error}</p>}
          <Button
            pending={pending}
            disabled={movementAmount <= 0 || movementReason.trim().length < 2}
            onClick={handleMovement}
            className="w-full"
          >
            Registrar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
