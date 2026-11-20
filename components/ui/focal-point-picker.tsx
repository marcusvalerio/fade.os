"use client";

import { useRef, useState } from "react";
import { FocalImage } from "@/components/ui/focal-point-image";
import { enviarFoto } from "@/lib/enviar-foto";
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
 *
 * A foto entra pelo botão "Enviar foto" (galeria/câmera no celular, arquivo no
 * computador) — nunca por link colado (decisão do produto, nov/2026).
 */
export function FocalPointPicker({
  companyId,
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
  companyId: string;
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
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnviando(true);
    setErro(null);
    try {
      onUrlChange(await enviarFoto(companyId, file));
      onFocalChange(0.5, 0.5);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-body-sm font-medium text-foreground">{label}</p>
          <p className="text-caption text-muted">
            {url ? "Toque na foto para escolher a área importante." : "Envie uma foto do celular ou do computador."}
          </p>
        </div>
        <div className="flex gap-2">
          {url && (
            <button
              type="button"
              onClick={() => onUrlChange("")}
              className="min-h-11 rounded-sm px-3 text-body-sm text-muted hover:text-foreground"
            >
              Remover
            </button>
          )}
          <button
            type="button"
            onClick={() => arquivoRef.current?.click()}
            disabled={enviando}
            className="min-h-11 rounded-sm border border-border-strong px-3.5 text-body-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            {enviando ? "Enviando…" : url ? "Trocar foto" : "Enviar foto"}
          </button>
        </div>
        <input ref={arquivoRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={aoEscolher} />
        <input type="hidden" name={urlName} value={url} />
      </div>
      {erro && <p role="alert" className="text-caption text-danger-ink">{erro}</p>}

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
            className="absolute size-4 rounded-full border-2 border-brand-blue bg-neutral-ink/60 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${focalX * 100}%`, top: `${focalY * 100}%` }}
          />
        )}
      </div>

      <input type="hidden" name={focalXName} value={focalX} />
      <input type="hidden" name={focalYName} value={focalY} />
    </div>
  );
}
