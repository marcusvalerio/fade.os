"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { closeAttendance } from "@/actions/atendimento";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_KEYS } from "@/lib/payment-methods";
import type { PaymentMethodKey } from "@/lib/types";

type PaymentRow = { method: PaymentMethodKey; amount: number };

export default function CloseAttendanceForm({
  attendanceId,
  subtotal,
  activeMethods,
}: {
  attendanceId: string;
  subtotal: number;
  activeMethods: PaymentMethodKey[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: activeMethods[0] ?? "cash", amount: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = Math.max(0, subtotal - discount + surcharge);
  const paymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.round((total - paymentsSum) * 100) / 100;

  function updatePayment(index: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, { method: activeMethods[0] ?? "cash", amount: Math.max(remaining, 0) }]);
  }

  async function handleConfirm() {
    setError(null);
    if (Math.abs(remaining) > 0.01) {
      setError(`Falta alocar ${formatCurrency(remaining)} entre as formas de pagamento.`);
      return;
    }
    setPending(true);
    const result = await closeAttendance({
      attendance_id: attendanceId,
      discount_amount: discount,
      surcharge_amount: surcharge,
      payments: payments.filter((p) => p.amount > 0),
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      show(result.error, "danger");
      return;
    }

    show("Atendimento fechado e pagamento registrado.", "success");
    setOpen(false);
    router.push("/atendimento");
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={subtotal <= 0}>
        Fechar e receber
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Fechar atendimento">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-label uppercase text-muted mb-1.5">Desconto global</p>
              <MoneyInput value={discount} onValueChange={setDiscount} />
            </div>
            <div>
              <p className="text-label uppercase text-muted mb-1.5">Acréscimo</p>
              <MoneyInput value={surcharge} onValueChange={setSurcharge} />
            </div>
          </div>

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-body-sm text-muted">Total a receber</span>
            <span className="text-section-title text-foreground tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="space-y-2">
            <p className="text-label uppercase text-muted">Pagamento</p>
            {payments.map((payment, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={payment.method}
                  onChange={(e) => updatePayment(i, { method: e.target.value as PaymentMethodKey })}
                  className="flex-1"
                >
                  {PAYMENT_METHOD_KEYS.filter((m) => activeMethods.includes(m)).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </Select>
                <MoneyInput
                  value={payment.amount}
                  onValueChange={(v) => updatePayment(i, { amount: v })}
                  className="w-36"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addPaymentRow}
              className="text-body-sm text-primary hover:underline"
            >
              + outra forma de pagamento
            </button>
          </div>

          <p
            className={
              Math.abs(remaining) > 0.01 ? "text-body-sm text-danger" : "text-body-sm text-success"
            }
          >
            {Math.abs(remaining) > 0.01
              ? `Falta alocar ${formatCurrency(remaining)}`
              : "Pagamento confere com o total"}
          </p>

          {error && <p className="text-body-sm text-danger">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="button" pending={pending} onClick={handleConfirm}>
              Confirmar e fechar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
