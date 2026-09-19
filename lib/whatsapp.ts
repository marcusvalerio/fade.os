/**
 * Versão 1, deliberadamente simples: nenhuma API oficial do WhatsApp,
 * nenhum token, nenhum envio automático. `whatsAppUrl` só monta um link
 * `wa.me` com o texto pré-preenchido — quem decide se envia é sempre uma
 * pessoa, clicando. Extraído de app/admin (fluxo de aprovação de Beta,
 * onde esse padrão já roda em produção) para ser reaproveitado também
 * pela Agenda, em vez de reescrito.
 */

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * `null` quando o telefone não tem dígitos suficientes para ser um número
 * válido — o chamador decide o que fazer (normalmente: não mostrar o
 * botão de WhatsApp). Nunca lança, nunca finge um link que não abre nada.
 */
export function whatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
