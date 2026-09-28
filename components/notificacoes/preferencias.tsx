"use client";

import { useEffect, useId, useState } from "react";
import { definirPreferencia, definirPush, type MinhaPreferencia, type MeuAjuste } from "@/actions/notificacoes";
import { CATEGORIAS, PREFERENCIA_POR_CHAVE, descricaoDaPreferencia, type Area, type Publico } from "@/lib/notificacoes/catalogo";
import type { EstadoDoPush } from "@/lib/notificacoes/push-navegador";
import { comoReativar } from "@/components/notificacoes/convite-push";
import { cn } from "@/lib/cn";

/**
 * Configurações → Notificações (equipe) e Minha conta → Notificações
 * (cliente). As linhas vêm do banco (minhas_preferencias_notificacao), que
 * só devolve o que vale para o papel real da pessoa; aqui ainda recortamos
 * pela área da tela. Obrigatórias aparecem ligadas e travadas.
 *
 * Preferência é da PESSOA (vale em todas as barbearias e aparelhos). Push
 * tem duas camadas: "este aparelho" (token do navegador) e "todos os
 * aparelhos" (liga/desliga geral).
 */
export function PreferenciasDeNotificacao({
  preferencias,
  ajuste,
  publicos,
  area,
}: {
  preferencias: MinhaPreferencia[];
  ajuste: MeuAjuste;
  /** públicos da pessoa NESTA área (equipe: gestor/profissional; cliente: cliente) */
  publicos: Publico[];
  area: Area;
}) {
  const [estado, setEstado] = useState<Record<string, boolean>>(() => Object.fromEntries(preferencias.map((p) => [p.preferencia, p.ativa])));
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const visiveis = preferencias.filter((p) => p.publicos.some((x) => publicos.includes(x)) && PREFERENCIA_POR_CHAVE.has(p.preferencia));
  const porCategoria = CATEGORIAS.map((c) => ({
    ...c,
    linhas: visiveis
      .filter((p) => p.categoria === c.chave)
      .sort((a, b) => ordem(a.preferencia) - ordem(b.preferencia)),
  })).filter((c) => c.linhas.length > 0);

  async function alternar(p: MinhaPreferencia) {
    if (p.obrigatoria) return;
    const novo = !estado[p.preferencia];
    setEstado((e) => ({ ...e, [p.preferencia]: novo }));
    setErro(null);
    const r = await definirPreferencia(p.preferencia, novo);
    const rotulo = PREFERENCIA_POR_CHAVE.get(p.preferencia)?.rotulo ?? p.preferencia;
    if (!r.ok) {
      setEstado((e) => ({ ...e, [p.preferencia]: !novo }));
      setErro(r.error);
    } else {
      setAviso(`${rotulo}: ${novo ? "ligado" : "desligado"}.`);
    }
  }

  return (
    <div className="space-y-10">
      <SecaoPush ajuste={ajuste} area={area} />

      {porCategoria.map((c) => (
        <section key={c.chave} aria-labelledby={`cat-${c.chave}`}>
          <h2 id={`cat-${c.chave}`} className="font-subtitle text-micro uppercase tracking-label text-muted flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 bg-brand-blue" />
            {c.rotulo}
          </h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {c.linhas.map((p) => {
              const meta = PREFERENCIA_POR_CHAVE.get(p.preferencia)!;
              return (
                <li key={p.preferencia}>
                  <Interruptor
                    rotulo={meta.rotulo}
                    descricao={descricaoDaPreferencia(meta, publicos)}
                    ligado={p.obrigatoria ? true : !!estado[p.preferencia]}
                    travado={p.obrigatoria}
                    obrigatorio={p.obrigatoria}
                    aoAlternar={() => alternar(p)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {erro && (
        <p role="alert" className="text-body-sm text-danger-ink">
          {erro}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {aviso ?? ""}
      </p>
    </div>
  );
}

function ordem(chave: string) {
  const i = [...PREFERENCIA_POR_CHAVE.keys()].indexOf(chave);
  return i < 0 ? 999 : i;
}

function Interruptor({
  rotulo,
  descricao,
  ligado,
  travado = false,
  obrigatorio = false,
  ocupado = false,
  aoAlternar,
}: {
  rotulo: string;
  descricao: React.ReactNode;
  ligado: boolean;
  travado?: boolean;
  obrigatorio?: boolean;
  ocupado?: boolean;
  aoAlternar: () => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p id={`${id}-r`} className="text-body-sm font-medium text-foreground">
          {rotulo}
        </p>
        <p id={`${id}-d`} className="text-caption text-muted mt-0.5">
          {descricao}
          {textoDeObrigatoria(obrigatorio)}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-labelledby={`${id}-r`}
        aria-describedby={`${id}-d`}
        aria-disabled={travado || ocupado || undefined}
        onClick={() => !travado && !ocupado && aoAlternar()}
        className={cn(
          "alvo-toque relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-fast ease-standard",
          ligado ? "border-foreground bg-foreground" : "border-border-strong bg-surface-muted",
          (travado || ocupado) && "opacity-60 cursor-not-allowed"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block size-4.5 rounded-full shadow-sm transition-transform duration-fast ease-standard motion-reduce:transition-none",
            ligado ? "translate-x-[1.375rem] bg-background" : "translate-x-0.5 bg-muted"
          )}
        />
        <span className="sr-only">{ligado ? "Ligado" : "Desligado"}</span>
      </button>
    </div>
  );
}

function textoDeObrigatoria(obrigatorio: boolean) {
  return obrigatorio ? <span className="block text-foreground/80 mt-0.5">Essencial: sempre ligado.</span> : null;
}

function SecaoPush({ ajuste, area }: { ajuste: MeuAjuste; area: Area }) {
  const [estado, setEstado] = useState<EstadoDoPush | null>(null);
  const [ios, setIos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [geral, setGeral] = useState(ajuste.push_ativo);
  const [aparelhos, setAparelhos] = useState(ajuste.aparelhos);

  useEffect(() => {
    void import("@/lib/notificacoes/push-navegador").then((p) => {
      setEstado(p.estadoAtual());
      setIos(p.ehIosForaDaTelaDeInicio());
    });
  }, []);

  async function alternarEsteAparelho() {
    setOcupado(true);
    setMensagem(null);
    const p = await import("@/lib/notificacoes/push-navegador");
    if (estado === "ativo") {
      await p.desativarNesteAparelho();
      setEstado(p.estadoAtual());
      setAparelhos((n) => Math.max(0, n - 1));
      setMensagem("Este aparelho não recebe mais notificações. Você continua vendo tudo no sino.");
    } else {
      const r = await p.ativarPush();
      setEstado(r.ok ? "ativo" : r.estado);
      if (r.ok) {
        setGeral(true);
        setAparelhos((n) => n + 1);
        setMensagem("Pronto. Este aparelho vai receber as notificações do CORTEX.");
      } else setMensagem(r.mensagem);
    }
    setOcupado(false);
  }

  async function desligarTodos() {
    setOcupado(true);
    const r = await definirPush(false, typeof Notification !== "undefined" ? Notification.permission : null);
    if (r.ok) {
      setGeral(false);
      setMensagem("Nenhum aparelho recebe mais. Para voltar, ligue neste ou em outro aparelho.");
    } else setMensagem(r.error);
    setOcupado(false);
  }

  const descricao =
    estado === null
      ? "Verificando este navegador…"
      : estado === "bloqueado"
        ? `Bloqueado neste navegador. ${comoReativar()}`
        : estado === "indisponivel"
          ? ios
            ? "No iPhone, adicione o CORTEX à Tela de Início (Compartilhar → Adicionar à Tela de Início) e ative por lá."
            : "Este navegador não recebe notificações no aparelho."
          : estado === "nao_configurado"
            ? "Ainda não disponível neste ambiente. Tudo continua aparecendo no sino."
            : area === "cliente"
              ? "Lembrete do seu horário e avisos da barbearia, mesmo com o site fechado."
              : area === "plataforma"
                ? "Pedidos de Beta, incidentes e falhas que pedem ação, mesmo com o Admin fechado."
              : "Avisos importantes mesmo com o CORTEX fechado. Nunca pedimos isso sozinhos: só quando você liga aqui.";

  return (
    <section aria-labelledby="sec-push">
      <h2 id="sec-push" className="font-subtitle text-micro uppercase tracking-label text-muted flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 bg-brand-blue" />
        Push
      </h2>
      <div className="mt-2 border-y border-border">
        <Interruptor
          rotulo="Receber notificações neste aparelho"
          descricao={descricao}
          ligado={estado === "ativo"}
          travado={estado === null || estado === "bloqueado" || estado === "indisponivel" || estado === "nao_configurado"}
          ocupado={ocupado}
          aoAlternar={alternarEsteAparelho}
        />
        {geral && aparelhos > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
            <p className="text-caption text-muted">
              Ativo em {aparelhos} {aparelhos === 1 ? "aparelho" : "aparelhos"}.
            </p>
            <button
              type="button"
              onClick={desligarTodos}
              disabled={ocupado}
              className="alvo-toque text-caption text-muted underline underline-offset-4 hover:text-foreground disabled:opacity-60"
            >
              Desligar em todos os aparelhos
            </button>
          </div>
        )}
      </div>
      {mensagem && (
        <p role="status" className="mt-2 text-caption text-foreground">
          {mensagem}
        </p>
      )}
    </section>
  );
}
