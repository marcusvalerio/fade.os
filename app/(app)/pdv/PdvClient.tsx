"use client";

import { useMemo, useState } from "react";
import { createPdvSale } from "@/actions/pdv";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_KEYS } from "@/lib/payment-methods";
import type { PaymentMethodKey } from "@/lib/types";

type ProductOption = { id: string; name: string; sale_price: number; current_stock: number };
type ClientOption = { id: string; name: string; phone: string | null };
type CartLine = { productId: string; name: string; quantity: number; unitPrice: number; stock: number };
type PaymentRow = { method: PaymentMethodKey; amount: number };

export function PdvClient({
  companyId,
  unitId,
  products,
  clients,
  activeMethods,
  requiresAuthorization,
}: {
  companyId: string;
  unitId: string;
  products: ProductOption[];
  clients: ClientOption[];
  activeMethods: PaymentMethodKey[];
  requiresAuthorization: boolean;
}) {
  const { show } = useToast();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productId, setProductId] = useState("");
  const [clientId, setClientId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: activeMethods[0] ?? "cash", amount: 0 }]);
  const [pending, setPending] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ total: number; items: number } | null>(null);

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const paymentsSum = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.round((total - paymentsSum) * 100) / 100;

  const availableProducts = useMemo(
    () => products.filter((p) => !cart.some((l) => l.productId === p.id)),
    [products, cart]
  );

  function addProduct() {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => [
      ...prev,
      { productId: product.id, name: product.name, quantity: 1, unitPrice: product.sale_price, stock: product.current_stock },
    ]);
    setProductId("");
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, quantity) } : l)));
  }

  // O `max` do input não impede digitar acima do saldo, e o banco só recusa
  // no fechamento (ESTOQUE_INSUFICIENTE) — depois de escolher pagamento e
  // apertar finalizar. Avisar na linha, na hora, é o mínimo.
  const linhasSemEstoque = cart.filter((l) => l.quantity > l.stock);

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function openPayment() {
    setPayments([{ method: activeMethods[0] ?? "cash", amount: total }]);
    setError(null);
    setPaymentOpen(true);
  }

  function updatePayment(index: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleConfirm() {
    setError(null);
    if (Math.abs(remaining) > 0.01) {
      setError(`Falta alocar ${formatCurrency(remaining)} entre as formas de pagamento.`);
      return;
    }
    setPending(true);
    const result = await createPdvSale({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId || undefined,
      items: cart.map((l) => ({ product_id: l.productId, quantity: l.quantity, discount: 0 })),
      discount_amount: discount,
      surcharge_amount: 0,
      authorization_code: authorizationCode.trim() || undefined,
      payments: payments.filter((p) => p.amount > 0),
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      show(result.error, "danger");
      return;
    }

    show("Venda registrada.", "success");
    setPaymentOpen(false);
    setConfirmation({ total, items: cart.length });
    setCart([]);
    setClientId("");
    setDiscount(0);
  }

  if (confirmation) {
    return (
      <div className="rounded-md border border-border bg-surface p-8 text-center space-y-4 animate-rise-in">
        <div
          aria-hidden
          className="mx-auto size-14 rounded-full bg-signal flex items-center justify-center text-signal-foreground text-section-title"
        >
          ✓
        </div>
        <div>
          <p className="text-page-title text-foreground">Venda concluída</p>
          <p className="text-body-sm text-muted mt-1">
            {confirmation.items} item(ns) · {formatCurrency(confirmation.total)}
          </p>
        </div>
        <Button type="button" onClick={() => setConfirmation(null)}>
          Nova venda
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-surface p-5 space-y-3">
        <p className="text-section-title text-foreground">Produtos</p>
        <div className="flex gap-2">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex-1">
            <option value="">Selecionar produto...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.sale_price)} ({p.current_stock} em estoque)
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" onClick={addProduct} disabled={!productId}>
            Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface divide-y divide-border">
        {cart.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-body-sm text-muted">Carrinho vazio — adicione um produto para começar.</p>
          </div>
        ) : (
          cart.map((line) => (
            <div key={line.productId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-foreground truncate">{line.name}</p>
                <p className="text-caption text-muted">{formatCurrency(line.unitPrice)} / un.</p>
                {line.quantity > line.stock && (
                  <p className="text-caption text-danger">
                    Só há {line.stock} em estoque.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={line.stock}
                  value={line.quantity}
                  onChange={(e) => updateQuantity(line.productId, Number(e.target.value))}
                  className="w-16 h-9 rounded-sm border border-border-strong bg-surface px-2 text-input text-foreground text-center tabular-nums"
                />
                <span className="text-body-sm text-foreground tabular-nums w-20 text-right">
                  {formatCurrency(line.unitPrice * line.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(line.productId)}
                  className="text-danger hover:underline text-caption"
                >
                  remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-5 space-y-4">
          <div>
            <p className="text-label uppercase text-muted mb-1.5">Cliente (opcional)</p>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sem cliente identificado</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="text-label uppercase text-muted mb-1.5">Desconto</p>
            <MoneyInput value={discount} onValueChange={(v) => setDiscount(Math.min(v, subtotal))} className="w-40" />
          </div>

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-body-sm text-muted">Total</span>
            <span className="text-section-title text-foreground tabular-nums">{formatCurrency(total)}</span>
          </div>

          <Button type="button" onClick={openPayment} className="w-full">
            Ir para pagamento
          </Button>
        </div>
      )}

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Pagamento">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-body-sm text-muted">Total a receber</span>
            <span className="text-section-title text-foreground tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="space-y-2">
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
              onClick={() => setPayments((prev) => [...prev, { method: activeMethods[0] ?? "cash", amount: Math.max(remaining, 0) }])}
              className="text-body-sm text-primary hover:underline"
            >
              + outra forma de pagamento
            </button>
          </div>

          <p className={Math.abs(remaining) > 0.01 ? "text-body-sm text-danger" : "text-body-sm text-success"}>
            {Math.abs(remaining) > 0.01 ? `Falta alocar ${formatCurrency(remaining)}` : "Pagamento confere com o total"}
          </p>

          <AuthorizationCodeField
            value={authorizationCode}
            onChange={setAuthorizationCode}
            visible={requiresAuthorization && discount > 0}
            operation="discount"
          />

          {error && <p className="text-body-sm text-danger">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentOpen(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              pending={pending}
              disabled={linhasSemEstoque.length > 0}
              onClick={handleConfirm}
            >
              Finalizar venda
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
