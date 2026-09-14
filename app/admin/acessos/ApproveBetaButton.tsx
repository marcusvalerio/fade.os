"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { approveBetaRequest } from "@/actions/platform-admin";

const PERIODOS = [1, 2, 3, 6, 12];

/**
 * P0.7 — "LIBERAR E ABRIR WHATSAPP", não "enviar mensagem": não existe
 * integração oficial de WhatsApp neste ambiente, então o CORTEX nunca finge
 * que mandou algo — ele monta a mensagem com dados reais da solicitação e
 * abre o WhatsApp Web/app já preenchido, quem manda de fato é o fundador.
 */
function buildWhatsAppMessage(name: string, periodMonths: number): string {
  const primeiroNome = name.trim().split(/\s+/)[0] || name;
  const periodo = periodMonths === 1 ? "1 mês" : `${periodMonths} meses`;
  return [
    `Oi, ${primeiroNome}! Aqui é o Marcus, fundador do CORTEX.OS.`,
    ``,
    `Seu acesso ao Beta foi liberado, por ${periodo}.`,
    ``,
    `O Beta existe para evoluir o produto ao lado das primeiras barbearias — então é bem provável que eu entre em contato em algum momento para entender como está sendo a experiência.`,
    ``,
    `Bem-vindo ao CORTEX.OS.`,
  ].join("\n");
}

function whatsAppUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function ApproveBetaButton({
  id,
  name,
  phone,
}: {
  id: string;
  name: string;
  phone: string | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(2);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const result = await approveBetaRequest(id, reason.trim() || undefined, period);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    show("Solicitação aprovada.", "success");
    setApproved(true);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setApproved(false);
    setReason("");
    setPeriod(2);
    setError(null);
  }

  const waUrl = whatsAppUrl(phone ?? "", buildWhatsAppMessage(name, period));

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        Aprovar
      </Button>
      <Modal open={open} onClose={close} title={approved ? "Beta liberado" : "Aprovar solicitação de Beta"}>
        {approved ? (
          <div className="space-y-4">
            <Aviso tom="sucesso">
              Acesso Beta liberado por {period === 1 ? "1 mês" : `${period} meses`}.
            </Aviso>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer" className="block">
                <Button type="button" variant="primary" className="w-full">
                  Avisar pelo WhatsApp
                </Button>
              </a>
            ) : (
              <p className="text-body-sm text-muted">
                Nenhum WhatsApp informado nesta solicitação — avise por e-mail.
              </p>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={close} className="w-full">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field name="period" label="Período do Beta">
              <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                {PERIODOS.map((p) => (
                  <option key={p} value={p}>
                    {p === 1 ? "1 mês" : `${p} meses`}
                    {p === 2 ? " (padrão)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="reason" label="Motivo (opcional)" helper="Fica registrado na auditoria da plataforma.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
            {error && <Aviso tom="erro">{error}</Aviso>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Voltar
              </Button>
              <BotaoDeAcaoClique variant="primary" size="sm" pending={pending} rotuloPendente="Aprovando…" onClick={handleConfirm}>
                Aprovar
              </BotaoDeAcaoClique>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
