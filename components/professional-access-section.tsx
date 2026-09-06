"use client";

import { useActionState, useState } from "react";
import { enableProfessionalAccess, disableProfessionalAccess, resetProfessionalAccess, getProfessionalAccessStatus } from "@/actions/profissional-acesso";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function ProfessionalAccessSection({ professionalId, companyId, professionalName, initialStatus }: ProfessionalAccessSectionProps) {
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
    }
    return result.ok ? null : result.error;
  }, null as string | null);

  const [disableState, disableAction, disablePending] = useActionState(async () => {
    const result = await disableProfessionalAccess(professionalId, companyId);
    if (result.ok) await refreshStatus();
    return result.ok ? null : result.error;
  }, null as string | null);

  const [resetState, resetAction, resetPending] = useActionState(async () => {
    const result = await resetProfessionalAccess(professionalId, companyId);
    if (result.ok && result.data) {
      setCredentials(result.data);
      setShowCredentialsModal(true);
      await refreshStatus();
    }
    return result.ok ? null : result.error;
  }, null as string | null);

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
  };

  const copyBoth = async () => {
    if (!credentials) return;
    await copyToClipboard(`Identificador: ${credentials.access_identifier}\nSenha: ${credentials.temporary_password}`);
    setCopied("both"); setTimeout(() => setCopied(null), 2000);
  };
  const copyIdentifier = async () => {
    if (!credentials) return;
    await copyToClipboard(credentials.access_identifier);
    setCopied("identifier"); setTimeout(() => setCopied(null), 2000);
  };
  const copyPassword = async () => {
    if (!credentials) return;
    await copyToClipboard(credentials.temporary_password);
    setCopied("password"); setTimeout(() => setCopied(null), 2000);
  };

  const isLoading = enablePending || disablePending || resetPending;
  const lastUpdate = status?.updated_at ? formatDistanceToNow(new Date(status.updated_at), { addSuffix: true, locale: ptBR }) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Acesso ao FADE.OS</h2>
        {!status?.has_access ? (
          <div className="space-y-4">
            <p className="text-body-sm text-muted">Este profissional ainda não possui acesso ao FADE.OS. Ative o acesso para permitir que ele faça login no sistema.</p>
            <form action={enableAction}>
              <Button type="submit" disabled={isLoading} pending={enablePending} className="w-full">{enablePending ? "Ativando acesso…" : "Ativar Acesso"}</Button>
            </form>
            {enableState && <p className="text-body-sm text-danger">{enableState}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-body-sm text-muted">Status do Acesso</p>
                <Badge variant={status.is_access_enabled ? "success" : "secondary"}>{status.is_access_enabled ? "Ativo" : "Inativo"}</Badge>
              </div>
              {lastUpdate && <p className="text-body-xs text-muted-foreground">Atualizado {lastUpdate}</p>}
            </div>
            {status.is_access_enabled && status.access_identifier && (
              <div className="space-y-2 rounded border border-border bg-secondary/30 p-3">
                <p className="text-body-xs font-medium text-muted-foreground">IDENTIFICADOR DE LOGIN</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-sm font-semibold text-foreground">{status.access_identifier}</code>
                  <Button type="button" variant="ghost" size="sm" onClick={copyIdentifier}>{copied === "identifier" ? "Copiado" : "Copiar"}</Button>
                </div>
              </div>
            )}
            {status.password_set_at ? <div className="text-body-xs text-success">✓ Senha definida</div> : <div className="rounded border border-warning/30 bg-warning/10 p-3"><p className="text-body-xs font-medium text-warning">⚠ Profissional deve trocar a senha no primeiro acesso</p></div>}
            <div className="flex gap-2 pt-2">
              <form action={resetAction} className="flex-1"><Button type="submit" variant="secondary" disabled={isLoading} pending={resetPending} className="w-full">{resetPending ? "Resetando…" : "Resetar Acesso"}</Button></form>
              <form action={disableAction} className="flex-1"><Button type="submit" variant="outline" disabled={isLoading} pending={disablePending} className="w-full">{disablePending ? "Desativando…" : "Desativar"}</Button></form>
            </div>
            {disableState && <p className="text-body-sm text-danger">{disableState}</p>}
            {resetState && <p className="text-body-sm text-danger">{resetState}</p>}
          </div>
        )}
      </div>

      <Modal open={showCredentialsModal} onOpenChange={setShowCredentialsModal} title="Acesso Ativado" description={`Compartilhe essas credenciais com ${professionalName}`}>
        <div className="space-y-4">
          <div className="rounded border border-warning/30 bg-warning/10 p-3"><p className="text-body-xs font-medium text-warning">⚠ Essas informações aparecem apenas agora. Compartilhe com segurança.</p></div>
          <div className="space-y-2">
            <label className="text-body-xs font-medium text-muted-foreground">IDENTIFICADOR DE LOGIN</label>
            <div className="flex items-center justify-between gap-2 rounded border border-border bg-secondary/50 p-3"><code className="flex-1 font-mono text-sm font-bold text-foreground">{credentials?.access_identifier}</code><Button type="button" variant="ghost" size="sm" onClick={copyIdentifier} className={cn(copied === "identifier" && "text-success")}>{copied === "identifier" ? "✓ Copiado" : "Copiar"}</Button></div>
          </div>
          <div className="space-y-2">
            <label className="text-body-xs font-medium text-muted-foreground">SENHA TEMPORÁRIA</label>
            <div className="flex items-center justify-between gap-2 rounded border border-border bg-secondary/50 p-3"><code className="flex-1 font-mono text-sm font-bold text-foreground">{credentials?.temporary_password}</code><Button type="button" variant="ghost" size="sm" onClick={copyPassword} className={cn(copied === "password" && "text-success")}>{copied === "password" ? "✓ Copiado" : "Copiar"}</Button></div>
          </div>
          <div className="space-y-2 rounded bg-surface-secondary p-3"><p className="text-body-xs font-medium text-foreground">Instruções:</p><ul className="list-inside list-disc space-y-1 text-body-xs text-muted-foreground"><li>Compartilhe o identificador e a senha com {professionalName}</li><li>Ele deve fazer login com esses dados</li><li>No primeiro acesso, será obrigado a criar uma nova senha</li><li>Não compartilhe por SMS ou mensagens inseguras</li></ul></div>
          <div className="flex gap-2 pt-4"><Button type="button" variant="secondary" onClick={copyBoth} className={cn("flex-1", copied === "both" && "text-success")}>{copied === "both" ? "✓ Copiado" : "Copiar Ambos"}</Button><Button type="button" onClick={() => setShowCredentialsModal(false)} className="flex-1">Fechar</Button></div>
        </div>
      </Modal>
    </div>
  );
}
