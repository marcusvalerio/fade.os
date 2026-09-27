"use client";

import { useState } from "react";
import { pagarPendentes } from "@/actions/comissoes";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";

/** Paga todo o pendente de uma pessoa — com confirmação do valor exato. */
export function PagarPendentes({
  companyId,
  professionalId,
  nome,
  ids,
  total,
}: {
  companyId: string;
  professionalId: string;
  nome: string;
  ids: string[];
  total: number;
}) {
  const { show } = useToast();
  const [aberto, setAberto] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    setPendente(true);
    const r = await pagarPendentes(companyId, professionalId, ids);
    setPendente(false);
    if (!r.ok) return setErro(r.error);
    setAberto(false);
    show(
      r.data.pagas === ids.length
        ? `${formatCurrency(r.data.total)} pagos a ${nome}.`
        : `${r.data.pagas} de ${ids.length} comissões pagas (${formatCurrency(r.data.total)}). As outras já tinham mudado.`,
      "success"
    );
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setAberto(true)}>
        Pagar {formatCurrency(total)}
      </Button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={`Pagar ${nome}`}>
        <div className="space-y-4">
          <p className="text-body-sm text-foreground">
            Registrar o pagamento de <strong className="numero">{formatCurrency(total)}</strong> em {ids.length}{" "}
            {ids.length === 1 ? "comissão" : "comissões"}. O CORTEX registra; o dinheiro sai por fora (Pix, dinheiro, transferência).
          </p>
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button type="button" onClick={confirmar} pending={pendente}>
              {pendente ? "Registrando…" : "Registrar pagamento"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
