"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { regenerateBetaTemporaryPassword, type BetaPasswordResetResult } from "@/actions/platform-admin";
import { cn } from "@/lib/cn";
import { firstName, whatsAppUrl, buildCredentialsClipboardText } from "@/lib/beta-credentials-message";

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
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BetaPasswordResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const response = await regenerateBetaTemporaryPassword(id);
    setPending(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    show("Nova senha temporária gerada.", "success");
    setResult(response.data);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setResult(null);
    setError(null);
    setCopied(false);
  }

  async function copyCredentials() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        buildCredentialsClipboardText({ email: result.email, temporaryPassword: result.temporaryPassword, accessUrl: result.accessUrl })
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível — sem crash, só não marca "copiado".
    }
  }

  const waUrl = result ? whatsAppUrl(phone, buildWhatsAppMessage(name, result)) : null;

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Gerar nova senha temporária
      </Button>
      <Modal open={open} onClose={close} title={result ? "Nova senha temporária gerada" : "Gerar nova senha temporária"}>
        {result ? (
          <div className="space-y-4">
            <Aviso tom="sucesso">Senha provisória renovada. A anterior parou de funcionar agora.</Aviso>

            <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
              <p className="text-caption font-medium text-muted">EMPRESA</p>
              <p className="text-sm font-semibold text-foreground">{result.companyName ?? "—"}</p>
            </div>

            <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
              <p className="text-caption font-medium text-muted">E-MAIL DE ACESSO</p>
              <code className="block font-mono text-sm font-semibold text-foreground break-all">{result.email}</code>
            </div>

            <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
              <p className="text-caption font-medium text-muted">NOVA SENHA PROVISÓRIA</p>
              <code className="block font-mono text-sm font-semibold text-foreground">{result.temporaryPassword}</code>
              <p className="text-caption text-muted">Aparece só agora — não é possível recuperá-la depois. No próximo acesso, a pessoa será obrigada a criar uma nova senha.</p>
            </div>

            <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
              <p className="text-caption font-medium text-muted">ACESSO</p>
              <code className="block font-mono text-sm text-foreground break-all">{result.accessUrl}</code>
            </div>

            <Button type="button" variant="secondary" className={cn("w-full", copied && "text-success-ink")} onClick={copyCredentials}>
              {copied ? "✓ Copiado" : "Copiar credenciais"}
            </Button>

            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer" className="block">
                <Button type="button" variant="primary" className="w-full">
                  Avisar pelo WhatsApp
                </Button>
              </a>
            ) : (
              <p className="text-body-sm text-muted">
                Nenhum WhatsApp informado nesta solicitação — avise por e-mail, com o texto de &quot;Copiar credenciais&quot; acima.
              </p>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={close} className="w-full">
              Fechar
            </Button>
          </div>
        ) : (
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
        )}
      </Modal>
    </>
  );
}
