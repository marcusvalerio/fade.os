"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/field";

const OPTIONS: { value: string; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "mes", label: "Este mês" },
];

export function PeriodPicker({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams);
        params.set("periodo", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="w-44"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
