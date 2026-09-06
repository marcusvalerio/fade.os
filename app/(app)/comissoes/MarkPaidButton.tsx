"use client";

import { useTransition } from "react";
import { markCommissionPaid } from "@/actions/comissoes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function MarkPaidButton({ commissionId }: { commissionId: string }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      pending={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markCommissionPaid(commissionId);
          if (!result.ok) return show(result.error, "danger");
          show("Comissão marcada como paga.", "success");
        });
      }}
    >
      Marcar paga
    </Button>
  );
}
