import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Admin client. Server-only: the service role key must never reach
 * the browser or a client component.
 */
/**
 * Falha de configuração do ambiente, não do que o usuário tentou fazer.
 * Existe como classe própria para o tradutor de erros distinguir "tente de
 * novo" (transitório) de "isto nunca vai funcionar até alguém configurar" —
 * o teste operacional pegou uma chave de serviço com valor de placeholder
 * respondendo "Invalid API key" e a tela dizendo "Tente novamente", o que
 * fazia o operador repetir para sempre.
 */
export class ConfigurationError extends Error {}

/** Valores que aparecem em .env de exemplo e não são chave nenhuma. */
const PLACEHOLDER_KEYS = new Set([
  "your-service-role-key",
  "service-role-key",
  "changeme",
  "",
]);

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || PLACEHOLDER_KEYS.has(serviceRoleKey.trim())) {
    // Sem detalhe do valor: a mensagem diz o que está faltando, nunca o que
    // está lá.
    throw new ConfigurationError(
      "O acesso de profissionais não está configurado neste ambiente. Fale com quem cuida da instalação do FADE OS."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
