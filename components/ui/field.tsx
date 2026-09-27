import { Children, Fragment, cloneElement, forwardRef, isValidElement, useId } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border-strong bg-surface px-3 text-input text-foreground " +
  "placeholder:text-muted outline-none transition-colors duration-fast ease-standard " +
  "focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(CONTROL_CLASSES, "h-10", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(CONTROL_CLASSES, "py-2 resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(CONTROL_CLASSES, "h-10 w-full appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-caption"
      >
        ▾
      </span>
    </div>
  )
);
Select.displayName = "Select";

type PropsDoControle = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

/**
 * Rótulo, controle e mensagem ligados de verdade: o rótulo aponta para o id
 * do controle (o do próprio controle, se ele tiver; senão um id único gerado
 * aqui — o `name` sozinho não liga nada e se repete entre formulários da mesma
 * tela), e o erro ou a ajuda são lidos junto com o campo (aria-describedby).
 * Com mais de um filho (grupos, listas), o rótulo continua só como título.
 */
export function Field({
  name,
  label,
  required,
  error,
  helper,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string | null;
  helper?: string;
  children: ReactNode;
}) {
  const gerado = useId();
  const controle =
    Children.count(children) === 1 && isValidElement<PropsDoControle>(children) && children.type !== Fragment
      ? children
      : null;
  const id = controle?.props.id ?? `${name}-${gerado.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ajudaId = error || helper ? `${id}-ajuda` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={controle ? id : name} className="block text-label uppercase text-muted">
        {label}
        {required && <span className="text-danger-ink"> *</span>}
      </label>
      {controle
        ? cloneElement(controle, {
            id,
            "aria-describedby": controle.props["aria-describedby"] ?? ajudaId,
            ...(error ? { "aria-invalid": true } : {}),
          })
        : children}
      {error ? (
        <p id={ajudaId} className="text-helper text-danger-ink">{error}</p>
      ) : helper ? (
        <p id={ajudaId} className="text-helper text-muted">{helper}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 rounded-sm border border-border-strong accent-primary",
        "focus-visible:outline-2 focus-visible:outline-focus",
        className
      )}
      {...props}
    />
  );
}
