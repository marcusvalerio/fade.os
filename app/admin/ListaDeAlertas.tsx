import Link from "next/link";
import { ROTULO_DO_NIVEL, type Alerta, type NivelDoAlerta } from "@/lib/admin-alertas";
import { cn } from "@/lib/cn";

// Mesmo vocabulário do Pulso do produto: forma + palavra, nunca só cor.
export const MARCA_DO_NIVEL: Record<NivelDoAlerta, string> = {
  critico: "bg-danger",
  importante: "bg-warning",
  atencao: "border-[1.5px] border-warning",
  info: "bg-primary",
};
const TEXTO_DO_NIVEL: Record<NivelDoAlerta, string> = {
  critico: "text-danger-ink",
  importante: "text-warning-ink",
  atencao: "text-warning-ink",
  info: "text-muted",
};

export function ListaDeAlertas({ alertas, limite }: { alertas: Alerta[]; limite?: number }) {
  const lista = limite ? alertas.slice(0, limite) : alertas;
  return (
    <ul className="divide-y divide-border">
      {lista.map((a) => (
        <li key={a.chave}>
          <Link href={a.href} className="group grid grid-cols-[0.625rem_minmax(0,1fr)_auto] gap-x-3 px-5 py-3.5 hover:bg-surface-muted/50 transition-colors duration-fast ease-standard">
            <span aria-hidden className={cn("mt-1.5 size-2.5", MARCA_DO_NIVEL[a.nivel])} />
            <span className="min-w-0">
              <span className={cn("block font-subtitle text-micro uppercase tracking-label", TEXTO_DO_NIVEL[a.nivel])}>{ROTULO_DO_NIVEL[a.nivel]}</span>
              <span className="block text-body-sm text-foreground font-medium mt-0.5 break-words">{a.titulo}</span>
              <span className="block text-caption text-muted mt-0.5">{a.detalhe}</span>
            </span>
            <span aria-hidden className="text-muted group-hover:text-foreground self-center">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
