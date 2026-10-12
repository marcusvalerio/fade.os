"use client";

import { useEffect, useState } from "react";
import {
  COOKIE_CONSENTIMENTO,
  ambienteDoHost,
  aparelhoDoUserAgent,
  caminhoLimpo,
  canalDaVisita,
  consentimentoEfetivo,
  deveMostrarFaixa,
  dominioDeReferencia,
  ehPaginaDeAquisicao,
  ehRobo,
  eventoDoClique,
  lerUtm,
  type Ambiente,
  type Consentimento,
  type NomeDoEvento,
} from "@/lib/analytics/regras";

/**
 * Medição de aquisição — só em /, /beta e /login, nunca no produto.
 *
 * Monta o evento com o que as regras permitem (caminho sem query, domínio de
 * referência, UTM, categoria de aparelho) e o identificador de SESSÃO (na
 * aba, some ao fechar). Identificador de VISITANTE só com consentimento, e
 * nunca com GPC/DNT.
 *
 * PENDENTE — REQUER ACESSO AO SUPABASE: a coleta persistente (rota de
 * recebimento + tabelas do schema `analytics` + retenção). Até lá:
 *   - produção: nada sai do navegador;
 *   - Preview/local: os eventos ficam em `window.__cortexAquisicao`, para
 *     conferir o que seria enviado, marcados como ambiente de teste.
 */

export const EVENTO_AQUISICAO = "cortex:aquisicao";
const COLETA_PERSISTENTE = false;
const SESSAO = "cortex-sessao";
const INATIVIDADE_MS = 30 * 60 * 1000;

type Evento = {
  evento: NomeDoEvento;
  pagina: string;
  ambiente: Ambiente;
  sessao: string;
  visitante: string | null;
  canal: ReturnType<typeof canalDaVisita>;
  referencia: string | null;
  utm: ReturnType<typeof lerUtm>;
  aparelho: ReturnType<typeof aparelhoDoUserAgent>;
  em: string;
};

declare global {
  interface Window {
    __cortexAquisicao?: Evento[];
  }
}

function lerCookie(nome: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function consentimentoAtual(): Consentimento {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return consentimentoEfetivo(lerCookie(COOKIE_CONSENTIMENTO), {
    gpc: nav.globalPrivacyControl === true,
    dnt: navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack ?? null,
  });
}

/** Sessão da aba: nova depois de 30 min parada. `nova` diz se acabou de nascer. */
function sessaoDaAba(): { id: string; nova: boolean } {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(SESSAO) ?? "null") as { id: string; ultima: number } | null;
    const agora = Date.now();
    const nova = !salvo || agora - salvo.ultima > INATIVIDADE_MS;
    const id = nova ? crypto.randomUUID() : salvo!.id;
    sessionStorage.setItem(SESSAO, JSON.stringify({ id, ultima: agora }));
    return { id, nova };
  } catch {
    return { id: crypto.randomUUID(), nova: true };
  }
}

// O mesmo evento na mesma página em menos de 1 s é o mesmo acontecimento
// (efeito montado duas vezes, clique duplo): conta uma vez.
let ultimo: { chave: string; em: number } | null = null;

function registrar(nome: NomeDoEvento, ambiente: Ambiente) {
  if (ehRobo(navigator.userAgent)) return;
  const pagina = caminhoLimpo(location.pathname);
  if (!ehPaginaDeAquisicao(pagina)) return;
  const chave = `${nome}:${pagina}`;
  if (ultimo && ultimo.chave === chave && Date.now() - ultimo.em < 1000) return;
  ultimo = { chave, em: Date.now() };
  const { id } = sessaoDaAba();
  const referencia = dominioDeReferencia(document.referrer, location.host);
  const utm = lerUtm(location.search);
  const evento: Evento = {
    evento: nome,
    pagina,
    ambiente,
    sessao: id,
    // Identificador de visitante: só existirá com a coleta ativa e o aceite.
    visitante: null,
    canal: canalDaVisita(referencia, utm),
    referencia,
    utm,
    aparelho: aparelhoDoUserAgent(navigator.userAgent),
    em: new Date().toISOString(),
  };
  if (COLETA_PERSISTENTE && ambiente === "producao") {
    // PENDENTE — REQUER ACESSO AO SUPABASE: navigator.sendBeacon("/api/a", ...)
    return;
  }
  if (ambiente !== "producao") (window.__cortexAquisicao ??= []).push(evento);
}

export function MedicaoDeAquisicao() {
  const [consentimento, setConsentimento] = useState<Consentimento | null>(null);

  useEffect(() => {
    const ambiente = ambienteDoHost(location.host);
    setConsentimento(consentimentoAtual());

    const { nova } = sessaoDaAba();
    if (nova) registrar("session_start", ambiente);
    registrar("page_view", ambiente);

    const iniciados = new Set<string>();
    function aoClicar(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const nome = eventoDoClique(link?.getAttribute("href"));
      if (nome) registrar(nome, ambiente);
    }
    function aoFocar(e: FocusEvent) {
      const tipo = (e.target as Element | null)?.closest?.("form[data-aquisicao]")?.getAttribute("data-aquisicao");
      const nome: NomeDoEvento | null = tipo === "beta" ? "beta_request_started" : tipo === "cadastro" ? "signup_started" : null;
      if (nome && !iniciados.has(nome)) {
        iniciados.add(nome);
        registrar(nome, ambiente);
      }
    }
    function aoConcluir(e: Event) {
      const nome = (e as CustomEvent<{ evento?: string }>).detail?.evento;
      if (nome === "beta_request_completed") registrar(nome, ambiente);
    }
    document.addEventListener("click", aoClicar, { capture: true });
    document.addEventListener("focusin", aoFocar);
    window.addEventListener(EVENTO_AQUISICAO, aoConcluir);
    return () => {
      document.removeEventListener("click", aoClicar, { capture: true });
      document.removeEventListener("focusin", aoFocar);
      window.removeEventListener(EVENTO_AQUISICAO, aoConcluir);
    };
  }, []);

  if (!consentimento || !deveMostrarFaixa(consentimento)) return null;
  return <FaixaDeConsentimento aoEscolher={setConsentimento} />;
}

function FaixaDeConsentimento({ aoEscolher }: { aoEscolher: (c: Consentimento) => void }) {
  function escolher(c: "aceito" | "recusado") {
    // 13 meses, o mesmo prazo das sessões. Só a escolha — nenhum identificador.
    document.cookie = `${COOKIE_CONSENTIMENTO}=${c}; Max-Age=${60 * 60 * 24 * 395}; Path=/; SameSite=Lax`;
    aoEscolher(c);
  }
  return (
    <div
      role="region"
      aria-label="Privacidade"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-md border border-border bg-surface/95 backdrop-blur px-4 py-3 shadow-lg sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[26rem] animate-rise-in"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <p className="text-caption text-muted">
        Medimos visitas a este site com ferramenta própria, sem anúncios e sem vender dados. Aceitando, lembramos que
        você já esteve aqui; recusando, a visita só entra na contagem, sem identificar você.
      </p>
      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => escolher("recusado")}
          className="min-h-11 rounded-sm px-3.5 text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => escolher("aceito")}
          className="min-h-11 rounded-sm bg-primary px-3.5 text-body-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity duration-fast ease-standard"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
