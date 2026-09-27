"use client";

import { useEffect } from "react";

/**
 * Dirige o palco da seção "Um cliente, do celular ao caixa".
 *
 * O palco e os passos são HTML do servidor; esta ilha só observa qual passo
 * cruza a faixa central da tela e escreve `data-step` no palco (a tela muda
 * de estado por CSS) e `data-current` no texto do passo. Não prende a
 * rolagem, não recalcula layout a cada frame: um IntersectionObserver com
 * uma faixa fina no meio da viewport.
 */
export function StoryScroller({ stageId, stepsId }: { stageId: string; stepsId: string }) {
  useEffect(() => {
    const stage = document.getElementById(stageId);
    const container = document.getElementById(stepsId);
    if (!stage || !container || typeof IntersectionObserver === "undefined") return;

    const passos = Array.from(container.querySelectorAll<HTMLElement>("[data-story-step]"));

    function ativar(el: HTMLElement) {
      const passo = el.dataset.storyStep;
      if (!passo || stage!.dataset.step === passo) return;
      stage!.dataset.step = passo;
      for (const p of passos) {
        if (p === el) p.setAttribute("data-current", "");
        else p.removeAttribute("data-current");
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) ativar(entry.target as HTMLElement);
        }
      },
      { rootMargin: "-48% 0px -48% 0px", threshold: 0 }
    );
    for (const p of passos) observer.observe(p);
    return () => observer.disconnect();
  }, [stageId, stepsId]);

  return null;
}
