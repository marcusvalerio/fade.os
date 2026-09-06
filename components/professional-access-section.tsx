"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  enableProfessionalAccess,
  disableProfessionalAccess,
  resetProfessionalAccess,
  getProfessionalAccessStatus,
} from "@/actions/profissional-acesso";
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

export default function ProfessionalAccessSection({
  professionalId,
  companyId,
  professionalName,
  initialStatus,
}: ProfessionalAccessSectionProps) {
  const router = useRouter();
  const [status, setStatus] = useState<AccessStatus | null>(initialStatus || null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{
    access_identifier: string;
    temporary_password: string;
  } | null>(null);
  const [copied, setCopied] = useState<"both" | "identifier" | "password" | null>(null);

  // State para ativar acesso
  const [enableState, enableAction, enablePending] = useActionState(
    async () => {
      const result = await enableProfessionalAccess(professionalId, companyId);
      if (result.ok && result.data) {
        setCredentials(result.data);
        setShowCredentialsModal(true);
        const statusResult = await getProfessionalAccessStatus(professionalId, companyId);
        if (statusResult.ok && statusResult.data) {
          setStatus(statusResult.data);
        }
      }
      return result.ok ? null : result.error;
    },
    null as string | null
  );

  // State para desativar acesso
  const [disableState, disableAction, disablePending] = useActionState(
    async () => {
      const result = await disableProfessionalAccess(professionalId, companyId);
      if (result.ok) {
        const statusResult = await getProfessionalAccessStatus(professionalId, companyId);
        if (statusResult.ok && statusResult.data) {
          setStatus(statusResult.data);
        }
      }
      return result.ok ? null : result.error;
    },
    null as string | null
  );

  // State para resetar acesso
  const [resetState, resetAction, resetPending] = useActionState(
    async () => {
      const result = await resetProfessionalAccess(professionalId, companyId);
      if (result.ok && result.data) {
        setCredentials(result.data);
        setShowCredentialsModal(true);
        const statusResult = await getProfessionalAccessStatus(professionalId, companyId);
        if (statusResult.ok && statusResult.data) {
          setStatus(statusResult.data);
        }
      }
      return result.ok ? null : result.error;
    },
    null as string | null
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyBoth = () => {
    if (credentials) {
      navigator.clipboard.writeText(
        `Identificador: ${credentials.access_identifier}\nSenha: ${credentials.temporary_password}`
      );
      setCopied("both");
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const copyIdentifier = () => {
    if (credentials) {
      copyToClipboard(credentials.access_identifier);
      setCopied("identifier");
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const copyPassword = () => {
    if (credentials) {
      copyToClipboard(credentials.temporary_password);
      setCopied("password");
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const isLoading = enablePending || disablePending || resetPending;
  const lastUpdate = status?.updated_at
    ? formatDistanceToNow(new Date(status.updated_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Seção: Acesso ao FADE.OS */}
      <div className="rounded-md border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Acesso ao FADE.OS</h2>

        {!status?.has_access ? (
          // Profissional sem acesso
          <div className="space-y-4">
            <p className="text-body-sm text-muted">
              Este profissional ainda não possui acesso ao FADE.OS. Ative o acesso para permitir que ele faça login
              no sistema.
            </p>
            <form action={enableAction}>
              <Button
                type="submit"
                disabled={isLoading}
                pending={enablePending}
                className="w-full"
              >
                {enablePending ? "Ativando acesso…" : "Ativar Acesso"}
              </Button>
            </form>
            {enableState && <p className="text-body-sm text-danger">{enableState}</p>}
          </div>
        ) : (
          // Profissional com acesso
          <div className="space-y-4">
            {/* Status do Acesso */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body-sm text-muted mb-2">Status do Acesso</p>
                <Badge
                  variant={status.is_access_enabled ? "success" : "secondary"}
                  className="capitalize"
                >
                  {status.is_access_enabled ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {lastUpdate && (
                <p className="text-body-xs text-muted-foreground">Atualizado {lastUpdate}</p>
              )}
            </div>

            {/* Identificador de Login */}
            {status.is_access_enabled && status.access_identifier && (
              <div className="bg-secondary/30 rounded p-3 space-y-2 border border-border">
                <p className="text-body-xs text-muted-foreground font-medium">IDENTIFICADOR DE LOGIN</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono font-semibold text-foreground">
                    {status.access_identifier}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyIdentifier}
                    className={cn(
                      copied === "identifier" && "text-success"
                    )}
                  >
                    {copied === "identifier" ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}

            {/* Status da Senha */}
            {status.password_set_at ? (
              <div className="text-body-xs text-success">
                ✓ Senha definida
              </div>
            ) : (
              <div className="bg-warning/10 border border-warning/30 rounded p-3">
                <p className="text-body-xs text-warning font-medium">
                  ⚠ Profissional deve trocar a senha no primeiro acesso
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 pt-2">
              <form action={resetAction} className="flex-1">
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isLoading}
                  pending={resetPending}
                  className="w-full"
                >
                  {resetPending ? "Resetando…" : "Resetar Acesso"}
                </Button>
              </form>
              <form action={disableAction} className="flex-1">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isLoading}
                  pending={disablePending}
                  className="w-full"
                >
                  {disablePending ? "Desativando…" : "Desativar"}
                </Button>
              </form>
            </div>

            {disableState && <p className="text-body-sm text-danger">{disableState}</p>}
            {resetState && <p className="text-body-sm text-danger">{resetState}</p>}
          </div>
        )}
      </div>

      {/* Modal: Credenciais Geradas */}
      <Modal
        open={showCredentialsModal}
        onOpenChange={setShowCredentialsModal}
        title="Acesso Ativado"
        description={`Compartilhe essas credenciais com ${professionalName}`}
      >
        <div className="space-y-4">
          {/* Aviso importante */}
          <div className="bg-warning/10 border border-warning/30 rounded p-3">
            <p className="text-body-xs text-warning font-medium">
              ⚠ Essas informações aparecem apenas agora. Compartilhe com segurança.
            </p>
          </div>

          {/* Identificador */}
          <div className="space-y-2">
            <label className="text-body-xs font-medium text-muted-foreground">
              IDENTIFICADOR DE LOGIN
            </label>
            <div className="bg-secondary/50 rounded p-3 flex items-center justify-between gap-2 border border-border">
              <code className="text-sm font-mono font-bold text-foreground flex-1">
                {credentials?.access_identifier}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyIdentifier}
                className={cn(copied === "identifier" && "text-success")}
              >
                {copied === "identifier" ? "✓ Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          {/* Senha Temporária */}
          <div className="space-y-2">
            <label className="text-body-xs font-medium text-muted-foreground">
              SENHA TEMPORÁRIA
            </label>
            <div className="bg-secondary/50 rounded p-3 flex items-center justify-between gap-2 border border-border">
              <code className="text-sm font-mono font-bold text-foreground flex-1">
                {credentials?.temporary_password}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyPassword}
                className={cn(copied === "password" && "text-success")}
              >
                {copied === "password" ? "✓ Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-surface-secondary rounded p-3 space-y-2">
            <p className="text-body-xs font-medium text-foreground">Instruções:</p>
            <ul className="text-body-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Compartilhe o identificador e a senha com {professionalName}</li>
              <li>Ele deve fazer login com esses dados</li>
              <li>No primeiro acesso, será obrigado a criar uma nova senha</li>
              <li>Não compartilhe por SMS ou mensagens inseguras</li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={copyBoth}
              className="flex-1"
              className={cn(copied === "both" && "text-success")}
            >
              {copied === "both" ? "✓ Copiado" : "Copiar Ambos"}
            </Button>
            <Button
              type="button"
              onClick={() => setShowCredentialsModal(false)}
              className="flex-1"
            >
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
