"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        // material-elevated (R19): o modal reimplementava a mesma receita
        // (superfície elevada + borda + sombra) por conta própria, escrita
        // antes do sistema de materiais existir. O backdrop continua um
        // scrim sólido — modal não precisa de glass para se separar do
        // conteúdo, a camada de foco do navegador já faz isso.
        "material-elevated m-auto w-[min(var(--container-moment),calc(100vw-2rem))] rounded-lg",
        "p-0 backdrop:bg-[rgb(var(--shadow-color)/45%)]",
        // dvh e não vh: com o teclado aberto no iOS o modal precisa caber na
        // altura que sobrou, senão o botão de confirmar fica fora da tela.
        "max-h-[85dvh] overflow-y-auto overscroll-contain",
        "open:animate-scale-in",
        className
      )}
    >
      <div
        className="p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <h2 className="text-section-title font-heading text-foreground mb-3">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
