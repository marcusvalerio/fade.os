"use client";

import { useActionState, useState } from "react";
import { enableProfessionalAccess, disableProfessionalAccess, resetProfessionalAccess, getProfessionalAccessStatus } from "@/actions/profissional-acesso";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Aviso } from "@/components/ui/estado";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

interface AccessStatus {
  has_access: boolean;
  access_identifier?: string;
  is_access_enabled?: boolean;
  password_set_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ProfessionalAccessSectionProps {
  professionalId: string;
  companyId: string;
  professionalName: string;
  initialStatus?: AccessStatus;
}

function relativeTime(iso?: string) {
  if (!iso) return null;
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export default function ProfessionalAccessSection({ professionalId, companyId, professionalName, initialStatus }: ProfessionalAccessSectionProps) {
  const { show } = useToast();
  const [status, setStatus] = useState<AccessStatus | null>(initialStatus || null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ access_identifier: string; temporary_password: string } | null>(null);
  const [copied, setCopied] = useState<"both" | "identifier" | "password" | null>(null);

  const refreshStatus = async () => {
    const result = await getProfessionalAccessStatus(professionalId, companyId);
    if (result.ok && result.data) setStatus(result.data);
  };

  const [enableState, enableAction, enablePending] = useActionState(async () => {
    const result = await enableProfessionalAccess(professionalId, companyId);
    if (result.ok && result.data) {
      setCredentials(result.data);
      setShowCredentialsModal(true);
      await refreshStatus();
      show("Acesso ativado.", "success");
    } else if (!result.ok) {
      show(result.error, "danger");
    }
    return result.ok ? null : result.error;
  }, null as string | null);

  const [disableState, disableAction, disablePending] = useActionState(async () => {
    const result = await disableProfessionalAccess(professionalId, companyId);
    if (result.ok) {
      await refreshStatus();
      show("Acesso desativado.", "success");
    } else {
      show(result.error, "danger");
    }
    return result.ok ? null : result.error;
  }, null as string | null);

  const [resetState, resetAction, resetPending] = useActionState(async () => {
    const result = await resetProfessionalAccess(professionalId, companyId);
    if (result.ok && result.data) {
      setCredentials(result.data);
      setShowCredentialsModal(true);
      await refreshStatus();
      show("Acesso resetado.", "success");
    } else if (!result.ok) {
      show(result.error, "danger");
    }
    return result.ok ? null : result.error;
  }, null as string | null);

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
  };
  const markCopied = (kind: "both" | "identifier" | "password") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };
  const copyBoth = async () => {
    if (!credentials) return;
    await copyToClipboard(`Identificador: ${credentials.access_identifier}\nSenha: ${credentials.temporary_password}`);
    markCopied("both");
  };
  const copyIdentifier = async () => {
    if (!credentials) return;
    await copyToClipboard(credentials.access_identifier);
    markCopied("identifier");
  };
  const copyPassword = async () => {
    if (!credentials) return;
    await copyToClipboard(credentials.temporary_password);
    markCopied("password");
  };

  const isLoading = enablePending || disablePending || resetPending;
  const lastUpdate = relativeTime(status?.updated_at);

  return (
    <div className="space-y-6">
      <div className="material-solid rounded-md p-6">
        <h2 className="mb-4 text-section-title text-foreground">Acesso ao CORTEX.OS</h2>
        {!status?.has_access ? (
          <div className="space-y-4">
            <p className="text-body-sm text-muted">Este profissional ainda não possui acesso ao CORTEX.OS. Ative o acesso para permitir que ele faça login no sistema.</p>
            <form action={enableAction}>
              <Button type="submit" disabled={isLoading} pending={enablePending} className="w-full">{enablePending ? "Ativando acesso…" : "Ativar Acesso"}</Button>
            </form>
            {enableState && <p className="text-body-sm text-danger-ink">{enableState}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-body-sm text-muted">Status do Acesso</p>
                <Badge tone={status.is_access_enabled ? "success" : "neutral"}>{status.is_access_enabled ? "Ativo" : "Inativo"}</Badge>
              </div>
              {lastUpdate && <p className="text-caption text-muted">Atualizado {lastUpdate}</p>}
            </div>
            {status.is_access_enabled && status.access_identifier && (
              <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
                <p className="text-caption font-medium text-muted">IDENTIFICADOR DE LOGIN</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-semibold text-foreground">{status.access_identifier}</code>
                  <Button type="button" variant="ghost" size="sm" onClick={copyIdentifier}>{copied === "identifier" ? "Copiado" : "Copiar"}</Button>
                </div>
              </div>
            )}
            {status.password_set_at ? (
              <p className="text-caption text-success-ink">Senha definida</p>
            ) : (
              <Aviso tom="atencao">Profissional deve trocar a senha no primeiro acesso.</Aviso>
            )}
            <div className="flex gap-2 pt-2">
              <form action={resetAction} className="flex-1"><Button type="submit" variant="secondary" disabled={isLoading} pending={resetPending} className="w-full">{resetPending ? "Resetando…" : "Resetar Acesso"}</Button></form>
              <form action={disableAction} className="flex-1"><Button type="submit" variant="danger" disabled={isLoading} pending={disablePending} className="w-full">{disablePending ? "Desativando…" : "Desativar"}</Button></form>
            </div>
            {disableState && <p className="text-body-sm text-danger-ink">{disableState}</p>}
            {resetState && <p className="text-body-sm text-danger-ink">{resetState}</p>}
          </div>
        )}
      </div>

      <Modal open={showCredentialsModal} onClose={() => setShowCredentialsModal(false)} title="Acesso Ativado">
        <div className="space-y-4">
          <p className="text-body-sm text-muted">Compartilhe essas credenciais com {professionalName}.</p>
          <Aviso tom="atencao">Essas informações aparecem apenas agora. Compartilhe com segurança.</Aviso>
          <div className="space-y-2">
            <label className="text-caption font-medium text-muted">IDENTIFICADOR DE LOGIN</label>
            <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-muted p-3"><code className="flex-1 font-mono text-sm font-bold text-foreground">{credentials?.access_identifier}</code><Button type="button" variant="ghost" size="sm" onClick={copyIdentifier} className={cn(copied === "identifier" && "text-success-ink")}>{copied === "identifier" ? "✓ Copiado" : "Copiar"}</Button></div>
          </div>
          <div className="space-y-2">
            <label className="text-caption font-medium text-muted">SENHA TEMPORÁRIA</label>
            <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-muted p-3"><code className="flex-1 font-mono text-sm font-bold text-foreground">{credentials?.temporary_password}</code><Button type="button" variant="ghost" size="sm" onClick={copyPassword} className={cn(copied === "password" && "text-success-ink")}>{copied === "password" ? "✓ Copiado" : "Copiar"}</Button></div>
          </div>
          <div className="space-y-2 rounded bg-surface-muted p-3"><p className="text-caption font-medium text-foreground">Instruções:</p><ul className="list-inside list-disc space-y-1 text-caption text-muted"><li>Compartilhe o identificador e a senha com {professionalName}</li><li>Ele deve fazer login com esses dados</li><li>No primeiro acesso, será obrigado a criar uma nova senha</li><li>Não compartilhe por SMS ou mensagens inseguras</li></ul></div>
          <div className="flex gap-2 pt-4"><Button type="button" variant="secondary" onClick={copyBoth} className={cn("flex-1", copied === "both" && "text-success-ink")}>{copied === "both" ? "✓ Copiado" : "Copiar Ambos"}</Button><Button type="button" onClick={() => setShowCredentialsModal(false)} className="flex-1">Fechar</Button></div>
        </div>
      </Modal>
    </div>
  );
}