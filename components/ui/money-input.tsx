"use client";

import { forwardRef, useEffect, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border-strong bg-surface px-3 h-10 text-input text-foreground " +
  "placeholder:text-muted outline-none transition-colors duration-fast ease-standard " +
  "focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-danger tabular-nums";

function digitsToNumber(digits: string): number {
  return digits ? Number(digits) / 100 : 0;
}

function numberToDisplay(value: number, formatter: Intl.NumberFormat): string {
  return formatter.format(value);
}

/**
 * Input monetário real (seção 8): digitação por centavos, sempre exibindo
 * "R$ 49,90" — nunca um <input type=number> genérico para dinheiro. O
 * valor reportado via onValueChange é sempre um number em reais (não em
 * centavos), pronto para gravar direto numa coluna numeric.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: number;
    onValueChange: (value: number) => void;
  }
>(({ value, onValueChange, className, name, id, ...props }, ref) => {
  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const [digits, setDigits] = useState(() => Math.round(value * 100).toString());

  useEffect(() => {
    const nextDigits = Math.round(value * 100).toString();
    if (digitsToNumber(nextDigits) !== digitsToNumber(digits)) setDigits(nextDigits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      ref={ref}
      id={id ?? name}
      inputMode="decimal"
      className={cn(CONTROL_CLASSES, className)}
      value={numberToDisplay(digitsToNumber(digits), formatter)}
      onChange={(e) => {
        const nextDigits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        setDigits(nextDigits);
        onValueChange(digitsToNumber(nextDigits));
      }}
      {...props}
    />
  );
});

MoneyInput.displayName = "MoneyInput";

/**
 * Input percentual real (seção 8): "40,00 %", edição por dígitos igual ao
 * MoneyInput, valor reportado sempre como number (0-100).
 */
export const PercentageInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: number;
    onValueChange: (value: number) => void;
    max?: number;
  }
>(({ value, onValueChange, max = 100, className, name, id, ...props }, ref) => {
  const [digits, setDigits] = useState(() => Math.round(value * 100).toString());

  useEffect(() => {
    const nextDigits = Math.round(value * 100).toString();
    if (digitsToNumber(nextDigits) !== digitsToNumber(digits)) setDigits(nextDigits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const displayValue = digitsToNumber(digits).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <input
      ref={ref}
      id={id ?? name}
      inputMode="decimal"
      className={cn(CONTROL_CLASSES, className)}
      value={`${displayValue} %`}
      onChange={(e) => {
        const nextDigits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        const clamped = Math.min(digitsToNumber(nextDigits), max);
        setDigits(Math.round(clamped * 100).toString());
        onValueChange(clamped);
      }}
      {...props}
    />
  );
});

PercentageInput.displayName = "PercentageInput";
