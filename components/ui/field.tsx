import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-foreground " +
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
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-label uppercase text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-helper text-danger">{error}</p>
      ) : helper ? (
        <p className="text-helper text-muted">{helper}</p>
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
