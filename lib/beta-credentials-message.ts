/**
 * Peças compartilhadas entre ApproveBetaButton e RegenerateBetaPasswordButton
 * — as duas telas que mostram uma credencial provisória de Beta ao platform
 * admin. O texto de cada mensagem continua específico de cada fluxo (uma é
 * "Beta liberado", a outra é "nova senha gerada"); o que se repete é só a
 * mecânica: primeiro nome, link de wa.me e o texto de "copiar credenciais".
 *
 * `firstName`/`whatsAppUrl` moraram aqui sozinhas até a Agenda também
 * precisar delas (confirmação de agendamento via WhatsApp) — agora vivem em
 * lib/whatsapp.ts e são só reexportadas aqui para não quebrar quem já
 * importava deste arquivo.
 */

export { firstName, whatsAppUrl } from "@/lib/whatsapp";

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
