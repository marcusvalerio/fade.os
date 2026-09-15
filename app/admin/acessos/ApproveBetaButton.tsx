"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BotaoDeAcaoClique } from "@/components/ui/botao-de-acao";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { approveBetaRequest, type BetaApprovalResult } from "@/actions/platform-admin";
import { cn } from "@/lib/cn";
import { firstName, whatsAppUrl, buildCredentialsClipboardText } from "@/lib/beta-credentials-message";

const PERIODOS = [1, 2, 3, 6, 12];

function periodoLabel(months: number): string {
  return months === 1 ? "1 mês" : `${months} meses`;
}

function formatExpiryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * P0.7 — "LIBERAR E ABRIR WHATSAPP", não "enviar mensagem": não existe
 * integração oficial de WhatsApp neste ambiente, então o CORTEX nunca finge
 * que mandou algo — ele monta a mensagem com dados reais da aprovação (a
 * senha provisória que o backend acabou de gerar, não uma reconstruída no
 * cliente) e abre o WhatsApp Web/app já preenchido, quem manda de fato é o
 * fundador.
 */
function buildWhatsAppMessage(result: BetaApprovalResult): string {
  const credentialLines = result.temporaryPassword
    ? [``, `Acesso: ${result.accessUrl}`, `E-mail: ${result.email}`, `Senha provisória: ${result.temporaryPassword}`, ``, `No primeiro acesso, você vai ser levado a criar uma nova senha.`]
    : [``, `Acesso: ${result.accessUrl}`, `E-mail: ${result.email}`, ``, `Use a senha que você já tem nessa conta (ou "Esqueci minha senha" na tela de login).`];

  return [
    `Oi, ${firstName(result.name)}! Aqui é o Marcus, fundador do CORTEX.OS.`,
    ``,
    `Seu acesso ao Beta foi liberado, por ${periodoLabel(result.periodMonths)}.`,
    ...credentialLines,
    ``,
    `O Beta existe para evoluir o produto ao lado das primeiras barbearias. Então é bem provável que eu entre em contato em algum momento para entender como está sendo a experiência.`,
    ``,
    `Bem-vindo ao CORTEX.OS.`,
  ].join("\n");
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
  const [result, setResult] = useState<BetaApprovalResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const response = await approveBetaRequest(id, reason.trim() || undefined, period);
    setPending(false);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    show("Solicitação aprovada.", "success");
    setResult(response.data);
    router.refresh();
  }

  function close() {
    setOpen(false);
    setResult(null);
    setReason("");
    setPeriod(2);
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
      // Clipboard indisponível (ex.: contexto não seguro) — sem crash, só
      // não marca "copiado". As credenciais continuam visíveis na tela.
    }
  }

  const waUrl = result ? whatsAppUrl(phone ?? "", buildWhatsAppMessage(result)) : null;

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
        Aprovar
      </Button>
      <Modal open={open} onClose={close} title={result ? "Beta liberado" : "Aprovar solicitação de Beta"}>
        {result ? (
          <div className="space-y-4">
            <Aviso tom="sucesso">
              {result.barbershopName} liberada por {periodoLabel(result.periodMonths)}, até {formatExpiryDate(result.betaExpiresAt)}.
            </Aviso>

            {result.accountReused && (
              <Aviso tom="atencao">
                Já existia uma conta com este e-mail — o Beta foi vinculado a ela. A senha não foi alterada; se a pessoa não lembrar a senha, ela pode usar &quot;Esqueci minha senha&quot; na tela de login.
              </Aviso>
            )}

            <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-medium text-muted">E-MAIL</p>
              </div>
              <code className="block font-mono text-sm font-semibold text-foreground break-all">{result.email}</code>
            </div>

            {result.temporaryPassword && (
              <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
                <p className="text-caption font-medium text-muted">SENHA PROVISÓRIA</p>
                <code className="block font-mono text-sm font-semibold text-foreground">{result.temporaryPassword}</code>
                <p className="text-caption text-muted">Aparece só agora — não é possível recuperá-la depois. No primeiro acesso, a pessoa será obrigada a criar uma nova senha.</p>
              </div>
            )}

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
