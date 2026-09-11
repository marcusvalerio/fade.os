"use client";

import { useMemo, useState } from "react";
import { createPdvSale } from "@/actions/pdv";
import { AuthorizationCodeField } from "@/components/ui/authorization-code-field";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/ui/modal";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, selectablePaymentMethods } from "@/lib/payment-methods";
import { cn } from "@/lib/cn";
import type { PaymentMethodKey } from "@/lib/types";

/**
 * Nova venda — nenhuma regra mudou aqui, só a leitura da tela.
 *
 * A sequência continua sendo composição → total → pagamento → conclusão,
 * mas antes ela vivia espalhada em três caixas empilhadas (seletor de
 * produto, carrinho, e depois cliente+desconto+total juntos num quarto
 * bloco) — quatro decisões com o mesmo peso visual. Aqui a composição e o
 * resumo dividem UMA superfície só, com o resumo como rodapé dela — o gesto
 * de conferir o total antes de pagar, que é como funciona um caixa de
 * verdade.
 *
 * `createPdvSale`, os cálculos de subtotal/total/restante e a proteção
 * contra clique duplo (o `pending` que desabilita o botão) são exatamente os
 * de antes.
 */
type ProductOption = { id: string; name: string; sale_price: number; current_stock: number };
// O nome já chega pronto para exibir: `rotularHomonimos` acrescenta um
// identificador só quando dois clientes se chamam igual.
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
  // O que a pessoa pode escolher agora — dinheiro sai da lista quando não há
  // caixa aberto, porque o banco recusaria o pagamento de qualquer forma.
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
  }

  if (confirmation) {
    return <VendaConcluida conclusao={confirmation} onNovaVenda={() => setConfirmation(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Contexto — cliente é a única informação de contexto que o PDV tem:
          não há atendimento nem profissional para vincular numa venda
          avulsa, por isso a tela não finge tê-los. */}
      <div className="flex items-center gap-3">
        <label htmlFor="pdv-cliente" className="text-label uppercase text-muted shrink-0">
          Cliente
        </label>
        <Select
          id="pdv-cliente"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="max-w-xs"
        >
          <option value="">Sem cliente identificado</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Composição + resumo — uma superfície só. O seletor de produto é a
          primeira linha; o resumo é o rodapé, tonalizado, do mesmo bloco —
          não uma quarta caixa separada. */}
      <div className="rounded-md border border-border bg-surface">
        <div className="flex gap-2 p-4 border-b border-border">
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
          <div className="px-5 py-10 text-center">
            <p className="text-body-sm text-muted">Carrinho vazio — adicione um produto para começar.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {cart.map((line) => (
                <div key={line.productId} className="flex items-center justify-between gap-3 px-4 py-3">
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

            {/* Resumo — o rodapé do carrinho, não um quinto bloco. O total é
                a única linha em corpo grande da tela inteira: é a única
                pergunta que precisa de resposta antes de ir ao pagamento. */}
            <div className="px-4 py-4 bg-surface-muted rounded-b-md space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-label uppercase text-muted">Desconto</span>
                <MoneyInput
                  value={discount}
                  onValueChange={(v) => setDiscount(Math.min(v, subtotal))}
                  className="w-32"
                  aria-label="Desconto"
                />
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-body-sm text-muted">Total</span>
                <span className="text-page-title text-foreground tabular-nums">{formatCurrency(total)}</span>
              </div>
              <Button type="button" onClick={openPayment} className="w-full">
                Ir para pagamento
              </Button>
            </div>
          </>
        )}
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

/**
 * A conclusão — o momento, não só um aviso.
 *
 * Antes eram três linhas (selo, total, botão). Agora a tela responde às
 * mesmas três perguntas que o pagamento levantou: quanto, como, e o que
 * aconteceu por baixo — sem inventar dado nenhum: "estoque atualizado" só é
 * dito porque o PDV vende produto, e comissão nem aparece, porque venda
 * avulsa de PDV não tem profissional para comissionar.
 */
function VendaConcluida({
  conclusao,
  onNovaVenda,
}: {
  conclusao: Conclusao;
  onNovaVenda: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-8 text-center animate-confirmar motion-reduce:animate-none">
      <div
        aria-hidden="true"
        className="mx-auto size-14 rounded-full bg-signal flex items-center justify-center text-signal-foreground text-section-title mb-4"
      >
        ✓
      </div>
      <p className="text-label uppercase text-muted mb-1.5">Venda concluída</p>
      <p className="text-page-title text-foreground tabular-nums mb-6">{formatCurrency(conclusao.total)}</p>

      <dl className="max-w-xs mx-auto text-left divide-y divide-border border-y border-border mb-6">
        <LinhaConclusao rotulo={conclusao.items === 1 ? "Item" : "Itens"} valor={String(conclusao.items)} />
        {conclusao.payments.map((p, i) => (
          <LinhaConclusao key={i} rotulo={PAYMENT_METHOD_LABEL[p.method]} valor={formatCurrency(p.amount)} />
        ))}
        <LinhaConclusao rotulo="Estoque" valor="atualizado" />
      </dl>

      <Button type="button" onClick={onNovaVenda} className="w-full max-w-xs mx-auto">
        Nova venda
      </Button>
    </div>
  );
}

function LinhaConclusao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className={cn("flex items-center justify-between py-2 text-body-sm")}>
      <dt className="text-muted">{rotulo}</dt>
      <dd className="tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}
