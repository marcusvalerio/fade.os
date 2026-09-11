"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { closeAttendance } from "@/actions/atendimento";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";
import { PAYMENT_METHOD_LABEL, selectablePaymentMethods } from "@/lib/payment-methods";
import type { PaymentMethodKey } from "@/lib/types";

type PaymentRow = { method: PaymentMethodKey; amount: number };

export default function CloseAttendanceForm({
  attendanceId,
  subtotal,
  itemCount,
  activeMethods,
  cashSessionOpen,
  requiresAuthorization,
}: {
  attendanceId: string;
  subtotal: number;
  /** Quantos itens o atendimento tem. É isto — e não o subtotal — que decide
   *  se dá para fechar: uma cortesia integral soma zero e mesmo assim é um
   *  atendimento legítimo, com serviço prestado e estoque consumido. */
  itemCount: number;
  activeMethods: PaymentMethodKey[];
  cashSessionOpen: boolean;
  requiresAuthorization: boolean;
}) {
  // Mesma regra do PDV: dinheiro sai da lista sem caixa aberto.
  const metodos = selectablePaymentMethods(activeMethods, cashSessionOpen);
  const semFormaDePagamento = metodos.length === 0;
  const dinheiroIndisponivel = activeMethods.includes("cash") && !cashSessionOpen;
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: metodos[0] ?? "cash", amount: 0 },
  ]);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = Math.max(0, subtotal - discount + surcharge);
  // Nada a receber: cortesia integral, ou desconto que zerou a conta. O banco
  // já trata esse caso (fecha sem pagamento e recusa qualquer pagamento
  // informado); era a interface que travava o botão em `subtotal <= 0` e
  // deixava o atendimento preso.
  const semCobranca = total <= 0;
  const paymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.round((total - paymentsSum) * 100) / 100;

  function updatePayment(index: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, { method: metodos[0] ?? "cash", amount: Math.max(remaining, 0) }]);
  }

  // Mesmo gesto do PDV: ao abrir o pagamento, a primeira forma já vem
  // sugerida com o total — a pessoa só precisa trocar de método ou dividir,
  // não digitar o valor inteiro de novo.
  function abrirFechamento() {
    setPayments([{ method: metodos[0] ?? "cash", amount: total }]);
    setOpen(true);
  }

  async function handleConfirm() {
    setError(null);
    if (!semCobranca && Math.abs(remaining) > 0.01) {
      setError(`Falta alocar ${formatCurrency(remaining)} entre as formas de pagamento.`);
      return;
    }
    setPending(true);
    const result = await closeAttendance({
      attendance_id: attendanceId,
      discount_amount: discount,
      surcharge_amount: surcharge,
      payments: payments.filter((p) => p.amount > 0),
      authorization_code: authorizationCode.trim() || undefined,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      show(result.error, "danger");
      return;
    }

    show(
      semCobranca
        ? "Atendimento fechado como cortesia, sem cobrança."
        : "Atendimento fechado e pagamento registrado.",
      "success"
    );
    setOpen(false);
    router.push("/atendimento");
  }

  return (
    <>
      <Button type="button" onClick={abrirFechamento} disabled={itemCount === 0}>
        {semCobranca ? "Fechar sem cobrança" : "Fechar e receber"}
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

          {semCobranca ? (
            /* Cortesia integral: não há o que cobrar, e o banco recusa
               qualquer pagamento informado quando o total é zero. Em vez de
               oferecer formas de pagamento que seriam rejeitadas, a tela diz
               o que vai acontecer. */
            <div className="rounded-md border border-border bg-surface-muted px-4 py-3">
              <p className="text-body-sm text-foreground">Sem cobrança</p>
              <p className="text-caption text-muted mt-1">
                O atendimento será fechado sem pagamento. Os itens ficam registrados com o preço
                original e o valor cobrado zerado, o estoque é consumido normalmente e a comissão
                segue a regra de sempre — sobre o valor efetivamente cobrado.
              </p>
            </div>
          ) : (
            <>
            <div className="space-y-2">
              <p className="text-label uppercase text-muted">Pagamento</p>
              {payments.map((payment, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={payment.method}
                    onChange={(e) => updatePayment(i, { method: e.target.value as PaymentMethodKey })}
                    className="flex-1"
                    aria-label="Forma de pagamento"
                  >
                    {metodos.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </option>
                    ))}
                  </Select>
                  <MoneyInput
                    value={payment.amount}
                    onValueChange={(v) => updatePayment(i, { amount: v })}
                    className="w-36"
                    aria-label="Valor recebido nesta forma"
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

            {semFormaDePagamento ? (
              <Aviso tom="erro" titulo="Nenhuma forma de pagamento disponível">
                Ative uma em Configurações → Pagamentos.
              </Aviso>
            ) : (
              <>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted">Informado</span>
                  <span className="tabular-nums text-foreground">{formatCurrency(paymentsSum)}</span>
                </div>
                {Math.abs(remaining) > 0.01 ? (
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="text-muted">{remaining > 0 ? "Falta" : "Sobra"}</span>
                    <span className="tabular-nums font-medium text-warning-ink">
                      {formatCurrency(Math.abs(remaining))}
                    </span>
                  </div>
                ) : (
                  <p className="text-body-sm text-success-ink font-medium">Pagamento completo</p>
                )}
              </>
            )}

            {dinheiroIndisponivel && (
              <Aviso tom="atencao">
                Dinheiro não aparece na lista porque não há caixa aberto. Abra o caixa em Negócio →
                Caixa para receber em espécie.
              </Aviso>
            )}
            </>
          )}

          <AuthorizationCodeField
            value={authorizationCode}
            onChange={setAuthorizationCode}
            visible={requiresAuthorization && (discount > 0 || surcharge > 0)}
            operation="discount"
          />

          {error && <Aviso tom="erro">{error}</Aviso>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <BotaoDeAcaoClique
              pending={pending}
              rotuloPendente={semCobranca ? "Fechando…" : "Recebendo…"}
              disabled={semFormaDePagamento && !semCobranca}
              onClick={handleConfirm}
            >
              Confirmar e fechar
            </BotaoDeAcaoClique>
          </div>
        </div>
      </Modal>
    </>
  );
}
