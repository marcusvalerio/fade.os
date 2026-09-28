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

/**
 * P1.23: controle de expandir/recolher a sidebar — um painel com uma seta.
 * A seta aponta para a esquerda (recolher); `rotate-180` no uso expandido
 * gira o desenho inteiro, então a seta passa a apontar para a direita
 * (expandir), sem precisar de um segundo desenho.
 */
export function IconeExpandir({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="4" width="14" height="12" rx="1.8" {...STROKE} />
      <path d="M8 4v12" {...STROKE} />
      <path d="M6 8.5 4 10l2 1.5" {...STROKE} />
    </svg>
  );
}

/* Ícones por destino — o shell agora lista cada tela, não grupos
   recolhidos, então cada uma precisa de um traço próprio (visível quando
   a sidebar está recolhida). Mesma receita: 20×20, traço 1.6, sem
   preenchimento. */

export function IconeAtendimento({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M6 3.5v6.2a4 4 0 0 0 8 0V3.5" {...STROKE} />
      <path d="M10 13.7v2.8M7 16.5h6" {...STROKE} />
    </svg>
  );
}

export function IconeVenda({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 4.5h1.8l1.6 8.2h8.1l1.5-6H7" {...STROKE} />
      <path d="M8.5 16h.01M14.5 16h.01" {...STROKE} strokeWidth={2.4} />
    </svg>
  );
}

export function IconeRecibo({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5 3.5h10v13l-2-1.3-1.7 1.3-1.3-1.3-1.3 1.3L7 15.2l-2 1.3z" {...STROKE} />
      <path d="M7.5 7.5h5M7.5 10.5h5" {...STROKE} />
    </svg>
  );
}

export function IconeCaixa({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="9" width="14" height="7.5" rx="1.4" {...STROKE} />
      <path d="M6 9V4.5h8V9" {...STROKE} />
      <path d="M8 12.5h4" {...STROKE} />
    </svg>
  );
}

export function IconeServicos({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="6" cy="14" r="2.3" {...STROKE} />
      <circle cx="14" cy="14" r="2.3" {...STROKE} />
      <path d="M7.6 12.3 14 3.5M12.4 12.3 6 3.5" {...STROKE} />
    </svg>
  );
}

export function IconeProdutos({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="6.5" y="7" width="7" height="10" rx="1.4" {...STROKE} />
      <path d="M8 7V4.5h4V7" {...STROKE} />
    </svg>
  );
}

export function IconeEstoque({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z" {...STROKE} />
      <path d="M3 6.5 10 10l7-3.5M10 10v7" {...STROKE} />
    </svg>
  );
}

export function IconeComissoes({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 15.5 15.5 4" {...STROKE} />
      <rect x="4" y="4.5" width="3.5" height="3.5" rx="0.8" {...STROKE} />
      <rect x="12.5" y="12" width="3.5" height="3.5" rx="0.8" {...STROKE} />
    </svg>
  );
}

export function IconeAjuda({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" {...STROKE} />
      <path d="M8.2 8.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6" {...STROKE} />
      <path d="M10 14h.01" {...STROKE} strokeWidth={2.2} />
    </svg>
  );
}

export function IconeSino({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.5 2H4l1.5-2Z" {...STROKE} />
      <path d="M8.3 17.5a1.9 1.9 0 0 0 3.4 0" {...STROKE} />
    </svg>
  );
}

export function IconeProduto({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="4" y="4" width="12" height="12" rx="1.6" {...STROKE} />
      <path d="M7.5 10.5 9.3 12.3 12.8 8" {...STROKE} />
    </svg>
  );
}
