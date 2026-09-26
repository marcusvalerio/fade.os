"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "success" | "danger";
type Toast = { id: number; message: string; tone: Tone };
type ToastContextValue = { show: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}

const TONE_BORDER: Record<Tone, string> = {
  default: "",
  success: "border-success/40",
  danger: "border-danger/40",
};

/** O sinal do CORTEX na cor do resultado: azul (informação), verde (feito), vermelho (falhou). */
const TONE_SINAL: Record<Tone, string> = {
  default: "bg-[var(--brand-blue)]",
  success: "bg-success",
  danger: "bg-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "default") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-[var(--z-toast)] flex flex-col gap-2 sm:items-end pointer-events-none"
        // No iPhone o bottom-4 sozinho encosta no indicador de home.
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-sm border border-border bg-surface-elevated",
              "px-4 py-3 text-body-sm text-foreground shadow-md animate-rise-in",
              "sm:max-w-sm",
              TONE_BORDER[t.tone]
            )}
          >
            <span aria-hidden className={cn("sinal-toast mt-[0.4em] size-2 shrink-0", TONE_SINAL[t.tone])} />
            <span className="min-w-0">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
