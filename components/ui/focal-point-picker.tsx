"use client";

import { useRef } from "react";
import { FocalImage } from "@/components/ui/focal-point-image";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * P1.4 — o painel de configuração escolhe a ÁREA IMPORTANTE da foto sem
 * nenhum processamento de imagem: clicar/arrastar no preview move o ponto
 * focal (0..1, 0..1), que é exatamente o mesmo par de números que
 * `FocalImage` usa para renderizar na página pública. Um clique aqui é a
 * mesma verdade que o cliente final vê — não existe preview enganoso.
 *
 * Reutilizado por capa, imagem de apresentação e imagem de diferenciais:
 * um padrão só, nunca quatro ferramentas de crop diferentes.
 */
export function FocalPointPicker({
  label,
  urlName,
  focalXName,
  focalYName,
  url,
  focalX,
  focalY,
  onUrlChange,
  onFocalChange,
  aspectRatio = "16 / 9",
}: {
  label: string;
  urlName: string;
  focalXName: string;
  focalYName: string;
  url: string;
  focalX: number;
  focalY: number;
  onUrlChange: (value: string) => void;
  onFocalChange: (x: number, y: number) => void;
  aspectRatio?: string;
}) {
  const previewRef = useRef<HTMLDivElement>(null);

  function handlePointer(e: React.PointerEvent<HTMLDivElement>) {
    const el = previewRef.current;
    if (!el || !url) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onFocalChange(Number(x.toFixed(3)), Number(y.toFixed(3)));
  }

  return (
    <div className="space-y-3">
      <Field name={urlName} label={label} helper="Cole a URL da imagem. Clique no preview para escolher a área importante.">
        <Input
          id={urlName}
          name={urlName}
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <div
        ref={previewRef}
        role="button"
        tabIndex={url ? 0 : -1}
        aria-label="Clique para escolher o ponto focal da imagem"
        onPointerDown={handlePointer}
        className={cn(
          "relative rounded-sm border border-border-strong",
          url ? "cursor-crosshair" : "cursor-default"
        )}
      >
        <FocalImage src={url || null} alt="" focalX={focalX} focalY={focalY} aspectRatio={aspectRatio} className="rounded-sm w-full" />
        {url && (
          <span
            aria-hidden
            className="absolute size-4 rounded-full border-2 border-[var(--brand-blue)] bg-[var(--neutral-ink)]/60 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${focalX * 100}%`, top: `${focalY * 100}%` }}
          />
        )}
      </div>

      <input type="hidden" name={focalXName} value={focalX} />
      <input type="hidden" name={focalYName} value={focalY} />
    </div>
  );
}
