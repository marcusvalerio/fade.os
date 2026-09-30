"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { regenerateBetaTemporaryPassword, type BetaPasswordResetResult } from "@/actions/platform-admin";
import { firstName, whatsAppUrl } from "@/lib/beta-credentials-message";
import { useResultadoDaAcao } from "./ResultadoDaAcao";

/**
 * Mesma regra do WhatsApp da aprovação (ApproveBetaButton): nunca finge que
 * mandou algo — monta a mensagem com a senha nova de verdade e abre o
 * WhatsApp já preenchido, quem manda é o fundador.
 */
function buildWhatsAppMessage(name: string, result: BetaPasswordResetResult): string {
  return [
    `Oi, ${firstName(name)}! Aqui é o Marcus, do CORTEX.OS.`,
    ``,
    `Gerei uma nova senha provisória para o seu acesso${result.companyName ? ` da ${result.companyName}` : ""}.`,
    ``,
    `Acesso: ${result.accessUrl}`,
    `E-mail: ${result.email}`,
    `Nova senha provisória: ${result.temporaryPassword}`,
    ``,
    `No próximo acesso, você vai ser levado a criar uma nova senha.`,
  ].join("\n");
}

export function RegenerateBetaPasswordButton({
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
  const mostrarResultado = useResultadoDaAcao();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const response = await regenerateBetaTemporaryPassword(id);
    setPending(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    const result = response.data;
    mostrarResultado({
      tipo: "credenciais",
      titulo: "Nova senha temporária gerada",
      confirmacao: "Senha provisória renovada. A anterior parou de funcionar agora.",
      empresa: result.companyName,
      email: result.email,
      senha: result.temporaryPassword,
      rotuloSenha: "NOVA SENHA PROVISÓRIA",
      notaSenha: "Aparece só agora — não é possível recuperá-la depois. No próximo acesso, a pessoa será obrigada a criar uma nova senha.",
      acesso: result.accessUrl,
      whatsapp: whatsAppUrl(phone, buildWhatsAppMessage(name, result)),
    });
    show("Nova senha temporária gerada.", "success");
    close();
    router.refresh();
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Gerar nova senha temporária
      </Button>
      <Modal open={open} onClose={close} title="Gerar nova senha temporária">
        <div className="space-y-4">
          <Aviso tom="atencao">
            Isso substitui a senha atual desta conta por uma nova, gerada agora. A senha anterior para de funcionar imediatamente — use quando o admin ou o dono perderam a senha mostrada na aprovação.
          </Aviso>
          {error && <Aviso tom="erro">{error}</Aviso>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Voltar
            </Button>
            <BotaoDeAcaoClique variant="primary" size="sm" pending={pending} rotuloPendente="Gerando…" onClick={handleConfirm}>
              Gerar nova senha
            </BotaoDeAcaoClique>
          </div>
        </div>
      </Modal>
    </>
  );
}
