"use client";

import { useEffect } from "react";

/**
 * Entrada ao rolar, para a landing inteira, numa ilha só.
 *
 * O servidor entrega tudo visível. Depois de hidratar, só o que ainda está
 * abaixo da dobra ganha `.lp-pending` (e portanto nunca "pisca": ninguém
 * estava olhando para ele) e é liberado ao cruzar a viewport. Sem JS, sem
 * IntersectionObserver ou com prefers-reduced-motion, nada é escondido.
 */
export function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const limite = window.innerHeight * 0.9;
    const pendentes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (el) => el.getBoundingClientRect().top > limite
    );
    for (const el of pendentes) el.classList.add("lp-pending");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("lp-pending");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    for (const el of pendentes) observer.observe(el);

    return () => {
      observer.disconnect();
      for (const el of pendentes) el.classList.remove("lp-pending");
    };
  }, []);

  return null;
}
