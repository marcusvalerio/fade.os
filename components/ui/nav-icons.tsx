/**
 * Ícones da navegação principal (R23.4 — shell com sidebar).
 *
 * Linha simples, sem biblioteca nova — a mesma lógica dos ícones de KPI do
 * Início: stroke fino, sem preenchimento, um traço por conceito.
 */
type Props = { className?: string };
const BASE = { viewBox: "0 0 20 20", fill: "none", "aria-hidden": true } as const;
const STROKE = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconeInicio({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 9.5 10 3l7 6.5" {...STROKE} />
      <path d="M4.5 8.5V17h11V8.5" {...STROKE} />
      <path d="M8 17v-4.5h4V17" {...STROKE} />
    </svg>
  );
}

export function IconeAgenda({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="4.5" width="13" height="12" rx="1.6" {...STROKE} />
      <path d="M3.5 8.5h13" {...STROKE} />
      <path d="M7 3v3M13 3v3" {...STROKE} />
    </svg>
  );
}

export function IconeClientes({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="7.5" cy="7" r="2.6" {...STROKE} />
      <path d="M3 16.5c0-2.7 2-4.4 4.5-4.4s4.5 1.7 4.5 4.4" {...STROKE} />
      <circle cx="14.5" cy="7.5" r="1.9" {...STROKE} />
      <path d="M13 12.5c1.9.1 3.5 1.6 3.5 4" {...STROKE} />
    </svg>
  );
}

export function IconeNegocio({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="7" width="14" height="9" rx="1.6" {...STROKE} />
      <path d="M7 7V5.3c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3V7" {...STROKE} />
      <path d="M3 11h14" {...STROKE} />
    </svg>
  );
}

export function IconeCatalogo({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" {...STROKE} />
      <rect x="11" y="3" width="6" height="6" rx="1.2" {...STROKE} />
      <rect x="3" y="11" width="6" height="6" rx="1.2" {...STROKE} />
      <rect x="11" y="11" width="6" height="6" rx="1.2" {...STROKE} />
    </svg>
  );
}

export function IconeEquipe({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="4" y="3.5" width="12" height="13" rx="1.8" {...STROKE} />
      <circle cx="10" cy="8" r="2" {...STROKE} />
      <path d="M6.5 13.5c.4-1.6 1.8-2.5 3.5-2.5s3.1.9 3.5 2.5" {...STROKE} />
    </svg>
  );
}

export function IconeFinanceiro({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="5.5" width="14" height="9" rx="1.6" {...STROKE} />
      <path d="M3 8.5h14" {...STROKE} />
      <path d="M5.5 11.5h3" {...STROKE} />
    </svg>
  );
}

export function IconeConfiguracoes({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="10" cy="10" r="2.6" {...STROKE} />
      <path
        d="M10 3.3v1.8M10 14.9v1.8M16.7 10h-1.8M5.1 10H3.3M14.7 5.3l-1.3 1.3M6.6 13.4l-1.3 1.3M14.7 14.7l-1.3-1.3M6.6 6.6 5.3 5.3"
        {...STROKE}
      />
    </svg>
  );
}
