/**
 * Web Push via Firebase Cloud Messaging — configuração pública.
 *
 * A VAPID key é a chave PÚBLICA do par gerado em Firebase → Configurações do
 * projeto → Cloud Messaging → Certificados push da Web. Ela vai para o
 * navegador de qualquer jeito (é com ela que o navegador assina a inscrição),
 * então não é segredo e pode ficar no código. Se o par for trocado no
 * Firebase, basta definir NEXT_PUBLIC_FIREBASE_VAPID_KEY na Vercel — a
 * variável tem precedência sobre o valor abaixo.
 *
 * O que ainda NÃO está aqui (ver docs/beta-e-pesquisas.md §3):
 *   - configuração do app Web do Firebase (apiKey, projectId,
 *     messagingSenderId, appId) — também pública, necessária para o
 *     navegador pedir o token;
 *   - conta de serviço (JSON com private_key) — SECRETA, só no servidor,
 *     necessária para enviar. Nunca no código nem com prefixo NEXT_PUBLIC_.
 */
const VAPID_KEY_PADRAO = "BMx__ly4Eurj731biT5rCjfmXzzg8uKdbcBVCIQ9oYm6iVMQ7Xfkm6YAFT_1C5e5HFLcW5ztD9iGdul9RMTRaww";

export const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || VAPID_KEY_PADRAO;
