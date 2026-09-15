/**
 * Peças compartilhadas entre ApproveBetaButton e RegenerateBetaPasswordButton
 * — as duas telas que mostram uma credencial provisória de Beta ao platform
 * admin. O texto de cada mensagem continua específico de cada fluxo (uma é
 * "Beta liberado", a outra é "nova senha gerada"); o que se repete é só a
 * mecânica: primeiro nome, link de wa.me e o texto de "copiar credenciais".
 */

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function whatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function buildCredentialsClipboardText(params: {
  email: string;
  temporaryPassword: string | null;
  accessUrl: string;
}): string {
  const lines = [`CORTEX.OS — Acesso Beta`, `E-mail: ${params.email}`];
  if (params.temporaryPassword) lines.push(`Senha provisória: ${params.temporaryPassword}`);
  lines.push(`Acesso: ${params.accessUrl}`);
  return lines.join("\n");
}
