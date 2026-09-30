"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { cn } from "@/lib/cn";
import { buildCredentialsClipboardText } from "@/lib/beta-credentials-message";

/**
 * O resultado de uma ação sobre um pedido de Beta mora AQUI, acima da lista —
 * não dentro da linha que disparou a ação.
 *
 * Antes, cada botão guardava o próprio resultado. Aprovar um pedido muda o
 * status dele; a lista recarrega, a linha troca de "pendente" para
 * "aprovado", o botão de aprovar deixa de existir e leva junto o modal com a
 * senha provisória — que só aparece uma vez. Era o "pisca e some".
 *
 * Agora o botão só executa e entrega o resultado para este provedor, que
 * não depende do estado de nenhuma linha. O modal fica aberto até a pessoa
 * clicar em Fechar: clique fora e Esc não fecham quando há credencial na
 * tela.
 */

export type ResultadoDaAcao =
  | {
      tipo: "credenciais";
      titulo: string;
      confirmacao: string;
      alerta?: string;
      empresa?: string | null;
      email: string;
      senha: string | null;
      rotuloSenha: string;
      notaSenha: string;
      acesso: string;
      whatsapp: string | null;
    }
  | {
      tipo: "confirmacao";
      titulo: string;
      mensagem: string;
      tom: "sucesso" | "atencao";
    };

const Contexto = createContext<((r: ResultadoDaAcao) => void) | null>(null);

export function useResultadoDaAcao() {
  const mostrar = useContext(Contexto);
  if (!mostrar) throw new Error("useResultadoDaAcao fora de ProvedorDeResultado");
  return mostrar;
}

export function ProvedorDeResultado({ children }: { children: React.ReactNode }) {
  const [resultado, setResultado] = useState<ResultadoDaAcao | null>(null);
  const [copiado, setCopiado] = useState(false);
  const mostrar = useCallback((r: ResultadoDaAcao) => {
    setCopiado(false);
    setResultado(r);
  }, []);

  function fechar() {
    setResultado(null);
    setCopiado(false);
  }

  async function copiar() {
    if (resultado?.tipo !== "credenciais") return;
    try {
      await navigator.clipboard.writeText(
        buildCredentialsClipboardText({ email: resultado.email, temporaryPassword: resultado.senha, accessUrl: resultado.acesso })
      );
      setCopiado(true);
    } catch {
      // Clipboard indisponível (contexto não seguro): as credenciais
      // continuam na tela para copiar à mão.
    }
  }

  const comCredencial = resultado?.tipo === "credenciais" && resultado.senha !== null;

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      <Modal open={resultado !== null} onClose={fechar} title={resultado?.titulo ?? ""} fechamentoExplicito={comCredencial}>
        {resultado?.tipo === "credenciais" ? (
          <div className="space-y-4">
            <Aviso tom="sucesso">{resultado.confirmacao}</Aviso>
            {resultado.alerta && <Aviso tom="atencao">{resultado.alerta}</Aviso>}

            {resultado.empresa !== undefined && (
              <Campo rotulo="EMPRESA">
                <p className="text-sm font-semibold text-foreground">{resultado.empresa ?? "—"}</p>
              </Campo>
            )}
            <Campo rotulo="E-MAIL DE ACESSO">
              <code className="block font-mono text-sm font-semibold text-foreground break-all">{resultado.email}</code>
            </Campo>
            {resultado.senha && (
              <Campo rotulo={resultado.rotuloSenha}>
                <code className="block font-mono text-sm font-semibold text-foreground">{resultado.senha}</code>
                <p className="text-caption text-muted">{resultado.notaSenha}</p>
              </Campo>
            )}
            <Campo rotulo="ACESSO">
              <code className="block font-mono text-sm text-foreground break-all">{resultado.acesso}</code>
            </Campo>

            <Button type="button" variant="secondary" className={cn("w-full", copiado && "text-success-ink")} onClick={copiar}>
              {copiado ? "✓ Copiado" : "Copiar credenciais"}
            </Button>
            {resultado.whatsapp ? (
              <a href={resultado.whatsapp} target="_blank" rel="noreferrer" className="block">
                <Button type="button" variant="primary" className="w-full">
                  Avisar pelo WhatsApp
                </Button>
              </a>
            ) : (
              <p className="text-body-sm text-muted">
                Nenhum WhatsApp informado nesta solicitação — avise por e-mail, com o texto de &quot;Copiar credenciais&quot; acima.
              </p>
            )}
            {comCredencial && !copiado && (
              <p className="text-caption text-muted">A senha não aparece de novo depois de fechar. Copie ou envie antes.</p>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={fechar} className="w-full">
              {comCredencial && !copiado ? "Já enviei, fechar" : "Fechar"}
            </Button>
          </div>
        ) : resultado ? (
          <div className="space-y-4">
            <Aviso tom={resultado.tom}>{resultado.mensagem}</Aviso>
            <div className="flex justify-end">
              <Button type="button" variant="primary" size="sm" onClick={fechar}>
                Entendi
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Contexto.Provider>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded border border-border bg-surface-muted p-3">
      <p className="text-caption font-medium text-muted">{rotulo}</p>
      {children}
    </div>
  );
}
