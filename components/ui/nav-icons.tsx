/**
 * Ícones da navegação principal (R23.4 — shell com sidebar).
 *
 * Redesenho (nov/2026): família duotom própria do CORTEX — a forma em cinza
 * (a cor do texto a 35%) diz o que é; o detalhe em tinta cheia diz o que
 * importa. Grade 24, traço 2. Cartela no canvas "CORTEX.OS — redesenho".
 * Capa é atender, tesoura é serviço, pote é produto, moeda é caixa.
 */
type Props = { className?: string };
const BASE = { viewBox: "0 0 20 20", fill: "none", "aria-hidden": true } as const;
const STROKE = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconeInicio({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M5 10.6 12 4.8l7 5.8v7.4A2.5 2.5 0 0 1 16.5 20.5h-9A2.5 2.5 0 0 1 5 18z" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 11.6 12 4l9 7.6" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 15v5.5" />
    </svg>
  );
}

export function IconeAgenda({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect fill="currentColor" opacity=".35" x="3" y="5" width="18" height="16" rx="4.5" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M16 3v4" /><circle fill="currentColor" cx="8" cy="13" r="1.4" /><circle fill="currentColor" cx="12" cy="13" r="1.4" /><circle fill="currentColor" cx="16" cy="13" r="1.4" /><circle fill="currentColor" cx="8" cy="17" r="1.4" /><circle fill="currentColor" cx="12" cy="17" r="1.4" />
    </svg>
  );
}

export function IconeClientes({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect fill="currentColor" opacity=".35" x="2.5" y="4.5" width="19" height="15" rx="4" /><circle fill="currentColor" cx="8.5" cy="10.5" r="2.4" /><path fill="currentColor" d="M4.8 16.2a3.8 3 0 0 1 7.4 0z" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14.5 10h4M14.5 14h3" />
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
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M1.8 19.5a6.2 5 0 0 1 12.4 0zM12.2 19.5h10a6 5 0 0 0-8.4-4.6" /><circle fill="currentColor" cx="8" cy="8.5" r="3.4" /><circle fill="currentColor" opacity=".35" cx="16.5" cy="8.5" r="3" />
    </svg>
  );
}

export function IconeFinanceiro({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect fill="currentColor" opacity=".35" x="3" y="3" width="18" height="18" rx="5" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m7 15 3.5-4 3 2.5L17 9" />
    </svg>
  );
}

export function IconeConfiguracoes({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5h17M3.5 16.5h17" /><circle fill="currentColor" opacity=".35" cx="9" cy="7.5" r="3.4" /><circle fill="currentColor" opacity=".35" cx="15" cy="16.5" r="3.4" /><circle fill="currentColor" cx="9" cy="7.5" r="1.6" /><circle fill="currentColor" cx="15" cy="16.5" r="1.6" />
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
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M3.5 21 7 12.5h10l3.5 8.5z" /><circle fill="currentColor" cx="12" cy="7" r="3.6" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 12.5 12 15l2-2.5" />
    </svg>
  );
}

export function IconeVenda({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M4.5 8.5h15l-1.1 10.3A2.5 2.5 0 0 1 15.9 21H8.1a2.5 2.5 0 0 1-2.5-2.2z" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
    </svg>
  );
}

export function IconeRecibo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M5.5 4.5A1.5 1.5 0 0 1 7 3h10a1.5 1.5 0 0 1 1.5 1.5V21l-3-2-3.5 2-3.5-2-3 2z" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function IconeCaixa({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle fill="currentColor" opacity=".35" cx="12" cy="12" r="9.5" /><path d="M12 7.6v8.8M14.3 9.6c-.3-.9-1.2-1.4-2.3-1.4-1.3 0-2.3.7-2.3 1.7 0 2.4 4.8 1.3 4.8 3.9 0 1-1.1 1.8-2.5 1.8-1.2 0-2.2-.6-2.5-1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconeServicos({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M9.6 13.2 19.8 4.1a.8.8 0 0 1 1.1 1.1l-8.3 10.5zM14.4 13.2 4.2 4.1a.8.8 0 0 0-1.1 1.1l8.3 10.5z" /><circle fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" cx="7" cy="17.5" r="3" /><circle fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" cx="17" cy="17.5" r="3" />
    </svg>
  );
}

export function IconeProdutos({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect fill="currentColor" opacity=".35" x="5" y="9.5" width="14" height="11.5" rx="3.5" /><rect fill="currentColor" x="5.5" y="4" width="13" height="3.6" rx="1.8" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 14h6" />
    </svg>
  );
}

export function IconeEstoque({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect fill="currentColor" opacity=".35" x="4" y="9" width="7" height="12" rx="2.5" /><rect fill="currentColor" x="5.5" y="5" width="4" height="3.4" rx="1" /><rect fill="currentColor" opacity=".35" x="13" y="13.5" width="8" height="7.5" rx="2.2" /><rect fill="currentColor" x="12.5" y="10.5" width="9" height="2.6" rx="1.3" />
    </svg>
  );
}

export function IconeComissoes({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle fill="currentColor" opacity=".35" cx="12" cy="12" r="9" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m9.2 14.8 5.6-5.6" /><circle fill="currentColor" cx="9.3" cy="9.3" r="1.5" /><circle fill="currentColor" cx="14.7" cy="14.7" r="1.5" />
    </svg>
  );
}

export function IconeAjuda({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle fill="currentColor" opacity=".35" cx="12" cy="12" r="9" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.3" /><circle fill="currentColor" cx="12" cy="17" r="1.2" />
    </svg>
  );
}

export function IconeSino({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="currentColor" opacity=".35" d="M5.5 16.5V11a6.5 6.5 0 0 1 13 0v5.5l1.3 1.8H4.2z" /><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10 21h4" /><circle fill="currentColor" cx="18" cy="5" r="2.6" />
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
