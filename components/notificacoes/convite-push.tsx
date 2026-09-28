"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { EstadoDoPush } from "@/lib/notificacoes/push-navegador";
import type { Area } from "@/lib/notificacoes/catalogo";

/**
 * Convite para ligar as notificações neste aparelho. Nunca aparece sozinho
 * ao entrar: só dentro da central de notificações e das preferências, e o
 * pedido de permissão do navegador só sai do clique em "Permitir".
 * "Agora não" esconde o convite por 14 dias neste navegador.
 */

const TEXTO = {
  equipe: "Quer receber lembretes de agenda e avisos importantes do CORTEX?",
  cliente: "Quer receber o lembrete do seu horário e os avisos da barbearia?",
  plataforma: "Quer receber neste aparelho os avisos que pedem ação: pedidos de Beta, incidentes e falhas?",
};

export function comoReativar(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "No iPhone: Ajustes → Notificações → CORTEX → Permitir Notificações.";
  if (/Android/.test(ua)) return "No Android: toque em ⋮ → Configurações → Configurações do site → Notificações e permita este site.";
  if (/Firefox\//.test(ua)) return "Clique no ícone à esquerda do endereço do site → Permissões → Notificações → Permitir. Depois recarregue a página.";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari → Ajustes → Sites → Notificações → escolha Permitir para este site.";
  return "Clique no ícone à esquerda do endereço do site → Notificações → Permitir. Depois recarregue a página.";
}

export function ConvitePush({
  publico = "equipe",
  modo = "convite",
  aoMudar,
  className,
}: {
  publico?: Area;
  /** convite: some quando ativo/adiado/indisponível. status: sempre explica o estado (preferências). */
  modo?: "convite" | "status";
  aoMudar?: (estado: EstadoDoPush) => void;
  className?: string;
}) {
  // null até montar: o estado depende do navegador e não pode entrar no HTML
  // do servidor (hidratação).
  const [estado, setEstado] = useState<EstadoDoPush | null>(null);
  const [adiado, setAdiado] = useState(false);
  const [ios, setIos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void import("@/lib/notificacoes/push-navegador").then((p) => {
      if (!vivo) return;
      setEstado(p.estadoAtual());
      setAdiado(p.conviteAdiado());
      setIos(p.ehIosForaDaTelaDeInicio());
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (estado === null) return null;
  if (modo === "convite" && (estado === "ativo" || estado === "nao_configurado" || (estado === "pendente" && adiado))) return null;
  if (modo === "convite" && estado === "indisponivel" && !ios) return null;

  async function permitir() {
    setOcupado(true);
    setMensagem(null);
    const p = await import("@/lib/notificacoes/push-navegador");
    const r = await p.ativarPush();
    const novo = r.ok ? "ativo" : r.estado;
    setEstado(novo);
    if (!r.ok) setMensagem(r.mensagem);
    setOcupado(false);
    aoMudar?.(novo);
  }

  async function agoraNao() {
    const p = await import("@/lib/notificacoes/push-navegador");
    p.adiarConvite();
    setAdiado(true);
  }

  const base = "rounded-md border border-border bg-surface p-4";

  if (estado === "bloqueado") {
    return (
      <div className={cn(base, className)} role="note">
        <p className="text-body-sm font-medium text-foreground">As notificações estão bloqueadas neste navegador.</p>
        <p className="text-caption text-muted mt-1">
          Você continua vendo tudo aqui no CORTEX. Para receber também no aparelho: {comoReativar()}
        </p>
      </div>
    );
  }

  if (estado === "indisponivel") {
    return (
      <div className={cn(base, className)} role="note">
        <p className="text-body-sm font-medium text-foreground">
          {ios ? "No iPhone, as notificações funcionam com o CORTEX na Tela de Início." : "Este navegador não recebe notificações no aparelho."}
        </p>
        <p className="text-caption text-muted mt-1">
          {ios
            ? "Toque em Compartilhar → Adicionar à Tela de Início, abra o CORTEX por lá e ative. Enquanto isso, tudo aparece aqui no sino."
            : "Tudo continua aparecendo aqui no sino do CORTEX."}
        </p>
      </div>
    );
  }

  if (estado === "nao_configurado") {
    return (
      <div className={cn(base, className)} role="note">
        <p className="text-body-sm font-medium text-foreground">Notificações no aparelho ainda não estão disponíveis.</p>
        <p className="text-caption text-muted mt-1">Tudo continua aparecendo aqui no sino do CORTEX.</p>
      </div>
    );
  }

  if (estado === "ativo") {
    return (
      <div className={cn(base, "flex items-start gap-3", className)} role="status">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 bg-success" />
        <p className="text-body-sm text-foreground">Este aparelho recebe as notificações do CORTEX.</p>
      </div>
    );
  }

  return (
    <div className={cn(base, className)}>
      <p className="font-subtitle text-micro uppercase tracking-label text-muted flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 bg-brand-blue" />
        Notificações no aparelho
      </p>
      <p className="text-body-sm text-foreground mt-1.5">{TEXTO[publico]}</p>
      {mensagem && (
        <p role="alert" className="text-caption text-danger-ink mt-2">
          {mensagem}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={permitir} disabled={ocupado}>
          {ocupado ? "Aguardando o navegador…" : "Permitir notificações"}
        </Button>
        {modo === "convite" && (
          <Button type="button" size="sm" variant="ghost" onClick={agoraNao} disabled={ocupado}>
            Agora não
          </Button>
        )}
      </div>
    </div>
  );
}
