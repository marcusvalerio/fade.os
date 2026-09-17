"use client";

import { useMemo, useState } from "react";
import { createPdvSale } from "@/actions/pdv";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/ui/modal";
import { Aviso, Vazio } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, selectablePaymentMethods } from "@/lib/payment-methods";
import { GlassSurface } from "@/components/ui/glass-surface";
import type { PaymentMethodKey } from "@/lib/types";

type ProductOption = { id: string; name: string; sale_price: number; current_stock: number };
type ClientOption = { id: string; name: string };
type CartLine = { productId: string; name: string; quantity: number; unitPrice: number; stock: number };
type PaymentRow = { method: PaymentMethodKey; amount: number };
type Conclusao = { total: number; items: number; payments: PaymentRow[] };

export function PdvClient({
  companyId,
  unitId,
  products,
  clients,
  activeMethods,
  cashSessionOpen,
  requiresAuthorization,
}: {
  companyId: string;
  unitId: string;
  products: ProductOption[];
  clients: ClientOption[];
  activeMethods: PaymentMethodKey[];
  cashSessionOpen: boolean;
  requiresAuthorization: boolean;
}) {
  const metodos = selectablePaymentMethods(activeMethods, cashSessionOpen);
  const semFormaDePagamento = metodos.length === 0;
  const dinheiroIndisponivel = activeMethods.includes("cash") && !cashSessionOpen;
  const { show } = useToast();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productId, setProductId] = useState("");
  const [clientId, setClientId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: metodos[0] ?? "cash", amount: 0 }]);
  const [pending, setPending] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Conclusao | null>(null);

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

  const linhasSemEstoque = cart.filter((l) => l.quantity > l.stock);

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  function openPayment() {
    setPayments([{ method: metodos[0] ?? "cash", amount: total }]);
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
    setPaymentOpen(true);
  }

  function updatePayment(index: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleConfirm() {
    setError(null);
    if (remaining > 0.01) {
      setError(`Falta alocar ${formatCurrency(remaining)} entre as formas de pagamento.`);
      return;
    }
    if (remaining < -0.01) {
      setError(`O pagamento excede a venda em ${formatCurrency(-remaining)}.`);
      return;
    }
    if (!idempotencyKey) {
      setError("Não foi possível identificar esta tentativa de venda. Volte ao carrinho e tente novamente.");
      return;
    }
    setPending(true);
    const usedPayments = payments.filter((p) => p.amount > 0);
    const result = await createPdvSale({
      company_id: companyId,
      unit_id: unitId,
      client_id: clientId || undefined,
      items: cart.map((l) => ({ product_id: l.productId, quantity: l.quantity, discount: 0 })),
      discount_amount: discount,
      surcharge_amount: 0,
      authorization_code: authorizationCode.trim() || undefined,
      payments: usedPayments,
      idempotency_key: idempotencyKey,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      show(result.error, "danger");
      return;
    }

    setPaymentOpen(false);
    setConfirmation({ total, items: cart.length, payments: usedPayments });
    setCart([]);
    setClientId("");
    setDiscount(0);
    setAuthorizationCode("");
    setIdempotencyKey(null);
  }

  if (confirmation) {
    return <VendaConcluida conclusao={confirmation} onNovaVenda={() => setConfirmation(null)} />;
  }

  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] items-start">
        <div>
          <div className="flex gap-3 pb-5 border-b border-border-strong">
            <Select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex-1"
              aria-label="Adicionar produto"
            >
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

          {cart.length === 0 ? (
            <Vazio titulo="Carrinho vazio" descricao="Adicione um produto para começar." />
          ) : (
            <>
              <p className="text-label uppercase text-muted pt-5 pb-1">Itens</p>
              <div className="divide-y divide-border">
                {cart.map((line) => (
                  <div key={line.productId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-foreground truncate">{line.name}</p>
                      <p className="text-caption text-muted">{formatCurrency(line.unitPrice)} / un.</p>
                      {line.quantity > line.stock && (
                        <p className="text-caption text-danger-ink">Só há {line.stock} em estoque.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={line.stock}
                        value={line.quantity}
                        onChange={(e) => updateQuantity(line.productId, Number(e.target.value))}
                        aria-label={`Quantidade de ${line.name}`}
                        className="w-16 h-9 rounded-sm border border-border-strong bg-surface px-2 text-input text-foreground text-center tabular-nums"
                      />
                      <span className="text-body-sm text-foreground tabular-nums w-20 text-right">
                        {formatCurrency(line.unitPrice * line.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.productId)}
                        aria-label={`Remover ${line.name}`}
                        className="text-danger-ink hover:underline text-caption alvo-toque"
                      >
                        remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative isolate lg:sticky lg:top-24">
          <GlassSurface as="aside" tone="decision" className="relative overflow-hidden rounded-lg p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full transition-colors duration-fast ease-standard"
                  style={{ backgroundColor: clientId ? "var(--neutral-ink)" : "rgb(4 23 35 / 28%)" }}
                />
                <label htmlFor="pdv-cliente" className="text-label uppercase">
                  Cliente
                </label>
              </div>
              <Select id="pdv-cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Sem cliente identificado</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-label uppercase text-decision-muted block mb-1.5">Desconto</label>
              <MoneyInput
                value={discount}
                onValueChange={(v) => setDiscount(Math.min(v, subtotal))}
                className="w-full"
                aria-label="Desconto"
              />
            </div>

            <div className="border-t pt-5" style={{ borderColor: "rgb(4 23 35 / 18%)" }}>
              <p className="text-label uppercase text-decision-muted mb-1">Total</p>
              <p className="text-[2.5rem] sm:text-[2.75rem] font-heading font-semibold tracking-[-0.015em] tabular-nums leading-none truncate">
                {formatCurrency(total)}
              </p>
            </div>

            <button
              type="button"
              onClick={openPayment}
              disabled={cart.length === 0}
              className="w-full h-11 rounded-sm text-button font-medium inline-flex items-center justify-center gap-2 transition-[opacity,transform] duration-fast ease-standard active:scale-[0.98] motion-reduce:active:scale-100 alvo-toque disabled:pointer-events-none"
              style={
                cart.length === 0
                  ? { backgroundColor: "rgb(4 23 35 / 14%)", color: "rgb(4 23 35 / 45%)" }
                  : { backgroundColor: "var(--neutral-ink)", color: "var(--neutral-warm-white)" }
              }
            >
              Ir para pagamento
            </button>
          </GlassSurface>
        </div>
      </div>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Pagamento">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="text-body-sm text-muted">Valor da venda</span>
            <span className="text-section-title text-foreground tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="space-y-2">
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
              onClick={() => setPayments((prev) => [...prev, { method: metodos[0] ?? "cash", amount: Math.max(remaining, 0) }])}
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

          <AuthorizationCodeField
            value={authorizationCode}
            onChange={setAuthorizationCode}
            visible={requiresAuthorization && discount > 0}
            operation="discount"
          />

          {error && <Aviso tom="erro">{error}</Aviso>}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentOpen(false)}>
              Voltar
            </Button>
            <BotaoDeAcaoClique
              pending={pending}
              rotuloPendente="Finalizando…"
              disabled={linhasSemEstoque.length > 0 || semFormaDePagamento}
              onClick={handleConfirm}
            >
              Finalizar venda
            </BotaoDeAcaoClique>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function VendaConcluida({
  conclusao,
  onNovaVenda,
}: {
  conclusao: Conclusao;
  onNovaVenda: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg p-8 sm:p-12 animate-confirmar motion-reduce:animate-none"
      style={{ backgroundColor: "var(--brand-blue)", color: "var(--neutral-ink)" }}
    >
      <div className="relative max-w-sm">
        <svg
          className="mb-5"
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--neutral-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" opacity="0.15" fill="var(--neutral-ink)" stroke="none" />
          <path d="M7 12.5l3 3 7-7" />
        </svg>
        <p className="text-label uppercase opacity-70 mb-1.5">Venda concluída</p>
        <p className="text-[2.75rem] sm:text-[3.25rem] font-heading font-semibold tracking-[-0.02em] leading-none tabular-nums mb-8">
          {formatCurrency(conclusao.total)}
        </p>

        <dl className="text-left divide-y mb-8" style={{ borderColor: "rgb(4 23 35 / 18%)" }}>
          <LinhaConclusao rotulo={conclusao.items === 1 ? "Item" : "Itens"} valor={String(conclusao.items)} />
          {conclusao.payments.map((p, i) => (
            <LinhaConclusao key={i} rotulo={PAYMENT_METHOD_LABEL[p.method]} valor={formatCurrency(p.amount)} />
          ))}
          <LinhaConclusao rotulo="Estoque" valor="atualizado" />
        </dl>

        <button
          type="button"
          onClick={onNovaVenda}
          className="w-full h-11 rounded-md text-button font-medium inline-flex items-center justify-center transition-[opacity,transform] duration-fast ease-standard active:scale-[0.98] alvo-toque"
          style={{ backgroundColor: "var(--neutral-ink)", color: "var(--brand-blue)" }}
        >
          Nova venda
        </button>
      </div>
    </div>
  );
}

function LinhaConclusao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-body-sm" style={{ borderColor: "rgb(4 23 35 / 18%)" }}>
      <dt className="opacity-70">{rotulo}</dt>
      <dd className="tabular-nums font-medium">{valor}</dd>
    </div>
  );
}
