"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  PainelBase,
  DashboardConteudo,
  AgendaConteudo,
  AtendimentoAbertoConteudo,
  DinheiroConteudo,
} from "./landing-panels";

const AGENDA_DATA = "2026-09-18";

const FATURAMENTO = 12480;
const RECEBIDO = 11200;
const TICKET_MEDIO = 78;
const ATENDIMENTOS = 142;

const PASSOS = [
  { titulo: "Início · últimos 7 dias", acessorio: "Terça a segunda" },
  { titulo: "Agenda · hoje", acessorio: "Sexta-feira" },
  { titulo: "Atendimento · Marcos Ferreira", acessorio: "Em andamento" },
  { titulo: "Financeiro · período", acessorio: undefined },
] as const;

const DURACAO_PASSO_MS = 4200;
/** Descanso mais longo no último passo (Resultado) antes de recomeçar —
 *  evita a sensação de loop frenético; a pessoa termina de ler o resultado
 *  antes do ciclo voltar ao início. */
const DURACAO_DESCANSO_MS = 5200;

/**
 * Um contador que anima de 0 até `alvo` quando `ativo` vira true, com
 * easing suave (ease-out cúbico) — sem lib nova, só requestAnimationFrame.
 * Fora de `ativo` (ou com prefers-reduced-motion), mostra o valor final
 * direto, sem animar. Isolado aqui porque só o Hero — não as seções
 * estáticas abaixo — precisa de contagem.
 */
function useContagem(alvo: number, ativo: boolean, duracaoMs = 900): number {
  const [valor, setValor] = useState(alvo);

  useEffect(() => {
    if (!ativo) {
      setValor(alvo);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValor(alvo);
      return;
    }

    let frame: number;
    const inicio = performance.now();

    function passo(agora: number) {
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      const suavizado = 1 - Math.pow(1 - t, 3);
      setValor(Math.round(alvo * suavizado));
      if (t < 1) frame = requestAnimationFrame(passo);
    }

    setValor(0);
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [alvo, ativo, duracaoMs]);

  return valor;
}

/**
 * Live Product Preview — o momento de assinatura do Hero.
 *
 * Um painel só (mesmo chrome, mesma superfície — `PainelBase`) percorre
 * quatro telas reais já reconstruídas em landing-panels.tsx: Início →
 * Agenda → Atendimento → Financeiro. "A mesma superfície permanece": é
 * sempre o mesmo cartão, só o conteúdo interno faz crossfade (opacidade +
 * leve translação, via CSS em app/globals.css); a barra de janela nunca
 * é trocada por outra.
 *
 * Autoplay temporal, não scroll-driven: prender a rolagem da página
 * dentro do Hero para sincronizar com a posição do scroll é exatamente o
 * tipo de coisa que quebra a navegação natural no celular — a própria
 * direção do pedido já previa cair para autoplay se isso comprometesse a
 * experiência. Sequência única por ciclo (Início → Agenda → Atendimento →
 * Financeiro → descanso mais longo → recomeça), nunca disparando de novo
 * enquanto a pessoa ainda está lendo o resultado.
 *
 * prefers-reduced-motion: o efeito de checar a preferência acontece uma
 * vez por passo (barato) e, se ativo, nunca agenda o próximo — o painel
 * congela no Início (a tela que já reúne mais indicadores de uma vez) e
 * fica assim. Nenhum conteúdo se perde: Agenda/Atendimento/Financeiro
 * continuam integralmente visíveis, estáticos, nas seções abaixo do Hero.
 */
export function HeroProductPreview() {
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ultimo = passo === PASSOS.length - 1;
    const espera = ultimo ? DURACAO_DESCANSO_MS : DURACAO_PASSO_MS;
    const id = setTimeout(() => setPasso((p) => (p + 1) % PASSOS.length), espera);
    return () => clearTimeout(id);
  }, [passo]);

  const valoresDashboard = {
    faturamento: useContagem(FATURAMENTO, passo === 0),
    recebido: useContagem(RECEBIDO, passo === 0),
    ticketMedio: useContagem(TICKET_MEDIO, passo === 0),
    atendimentos: useContagem(ATENDIMENTOS, passo === 0),
  };

  const { titulo, acessorio } = PASSOS[passo];

  return (
    <PainelBase titulo={titulo} acessorio={acessorio}>
      <div className="hero-preview-stack">
        <div className={cn("hero-preview-tela", passo === 0 && "hero-preview-tela--ativa")} aria-hidden={passo !== 0}>
          <DashboardConteudo valores={valoresDashboard} />
        </div>
        <div className={cn("hero-preview-tela", passo === 1 && "hero-preview-tela--ativa")} aria-hidden={passo !== 1}>
          <AgendaConteudo selectedDate={AGENDA_DATA} />
        </div>
        <div className={cn("hero-preview-tela", passo === 2 && "hero-preview-tela--ativa")} aria-hidden={passo !== 2}>
          <AtendimentoAbertoConteudo />
        </div>
        <div className={cn("hero-preview-tela", passo === 3 && "hero-preview-tela--ativa")} aria-hidden={passo !== 3}>
          <DinheiroConteudo />
        </div>
      </div>
      {/* Equivalente textual da troca de tela, para quem usa leitor de tela
          — sem repetir o conteúdo inteiro do painel a cada passo. */}
      <span className="sr-only" aria-live="polite">
        {titulo}
      </span>
    </PainelBase>
  );
}
