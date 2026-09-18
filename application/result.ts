/**
 * Contrato de resultado da Application layer (ARCH 1 — Foundation).
 *
 * Mesmo formato que `ActionResult<T>` já usava em boa parte do projeto —
 * `{ ok: true, data }` | `{ ok: false, error }` —, só que numa localização
 * neutra: `actions/onboarding.ts` era um lugar estranho para um tipo
 * compartilhado por dezenas de outras actions (achado da auditoria
 * arquitetural). `ActionResult<T>` continua existindo lá, agora como alias
 * deste tipo — nenhum import existente quebra.
 *
 * Não é o único formato de retorno do projeto (form actions com
 * `useActionState` têm seus próprios estados de formulário, e algumas
 * mutações continuam usando `throw`) — ARCH 1 não converte nada disso.
 * Este contrato é para os Use Cases/Services que ainda não existem
 * (ARCH 4+), não uma migração das Actions atuais.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
