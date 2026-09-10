import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 disabled:opacity-40",
  secondary:
    "bg-transparent text-foreground border border-border-strong hover:bg-surface-muted active:bg-surface-muted disabled:opacity-40",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-muted active:bg-surface-muted disabled:opacity-40",
  danger:
    "bg-transparent text-danger border border-danger/30 hover:bg-danger/10 active:bg-danger/15 disabled:opacity-40",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-button rounded-sm gap-1.5",
  md: "h-10 px-4 text-button rounded-sm gap-2",
};

/** Compartilhado com <Link> estilizado como botão (ex.: "Novo agendamento"). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap",
    // Em toque, a área clicável cresce para 44px sem mudar a altura visual.
    "alvo-toque",
    "transition-[opacity,background-color,transform] duration-fast ease-standard",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "disabled:pointer-events-none",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", pending, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || pending}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {pending && (
          <span
            aria-hidden
            className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
