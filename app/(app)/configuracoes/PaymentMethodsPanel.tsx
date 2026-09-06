"use client";

import { useState, useTransition } from "react";
import { setPaymentMethodActive } from "@/actions/pagamentos";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_KEYS } from "@/lib/payment-methods";
import { Checkbox } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { PaymentMethodKey } from "@/lib/types";

export function PaymentMethodsPanel({
  companyId,
  activeMethods,
}: {
  companyId: string;
  activeMethods: PaymentMethodKey[];
}) {
  const { show } = useToast();
  const [active, setActive] = useState(new Set(activeMethods));
  const [pending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<PaymentMethodKey | null>(null);

  function toggle(method: PaymentMethodKey) {
    const willBeActive = !active.has(method);
    setPendingKey(method);
    startTransition(async () => {
      const result = await setPaymentMethodActive(companyId, method, willBeActive);
      setPendingKey(null);
      if (!result.ok) return show(result.error, "danger");
      setActive((prev) => {
        const next = new Set(prev);
        if (willBeActive) next.add(method);
        else next.delete(method);
        return next;
      });
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface divide-y divide-border">
      {PAYMENT_METHOD_KEYS.map((method) => (
        <label
          key={method}
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer",
            pending && pendingKey === method && "opacity-60"
          )}
        >
          <span className="text-body-sm text-foreground">{PAYMENT_METHOD_LABEL[method]}</span>
          <Checkbox
            checked={active.has(method)}
            disabled={pending && pendingKey === method}
            onChange={() => toggle(method)}
          />
        </label>
      ))}
    </div>
  );
}
