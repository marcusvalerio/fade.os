"use client";

import { useRef, useState, useTransition } from "react";
import { setPaymentMethodActive } from "@/actions/pagamentos";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_KEYS } from "@/lib/payment-methods";
import { Checkbox } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { PaymentMethodKey } from "@/lib/types";

/**
 * Formas de pagamento aceitas.
 *
 * A marcação era aplicada só DEPOIS da resposta do servidor, então entre o
 * toque e o visual havia a latência inteira da ida ao Supabase — meio segundo
 * de nada acontecendo, que na prática faz a pessoa tocar de novo. Agora o
 * estado muda na hora e o servidor confirma em seguida; se recusar, volta ao
 * que era e o erro aparece.
 *
 * Sem toast de sucesso: a própria marcação já é a confirmação, e um aviso a
 * cada toque em lista de checkbox vira ruído. Erro continua aparecendo.
 */
export function PaymentMethodsPanel({
  companyId,
  activeMethods,
}: {
  companyId: string;
  activeMethods: PaymentMethodKey[];
}) {
  const { show } = useToast();
  const [active, setActive] = useState(new Set(activeMethods));
  const [, startTransition] = useTransition();
  // Um toque por método por vez: sem isso, dois toques rápidos poderiam ter
  // as respostas chegando fora de ordem e o visual terminar invertido.
  const emVoo = useRef(new Set<PaymentMethodKey>());

  function aplicar(method: PaymentMethodKey, ativo: boolean) {
    setActive((prev) => {
      const next = new Set(prev);
      if (ativo) next.add(method);
      else next.delete(method);
      return next;
    });
  }

  function toggle(method: PaymentMethodKey) {
    if (emVoo.current.has(method)) return;
    const willBeActive = !active.has(method);

    emVoo.current.add(method);
    aplicar(method, willBeActive);

    startTransition(async () => {
      const result = await setPaymentMethodActive(companyId, method, willBeActive);
      emVoo.current.delete(method);
      if (!result.ok) {
        aplicar(method, !willBeActive);
        show(result.error, "danger");
      }
    });
  }

  return (
    <div className="material-solid rounded-md divide-y divide-border">
      {PAYMENT_METHOD_KEYS.map((method) => (
        <label
          key={method}
          className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer"
        >
          <span className="text-body-sm text-foreground">{PAYMENT_METHOD_LABEL[method]}</span>
          <Checkbox checked={active.has(method)} onChange={() => toggle(method)} />
        </label>
      ))}
    </div>
  );
}
