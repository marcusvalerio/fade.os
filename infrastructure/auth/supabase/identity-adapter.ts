import { createClient } from "@/lib/supabase/server";
import type { Identity } from "@/domain/identity/identity";
import { toIdentity } from "./to-identity";

export { toIdentity } from "./to-identity";

/**
 * Único lugar, junto com auth-provider.ts, que chama `supabase.auth.*`
 * para resolver identidade. `lib/tenancy.ts` (`getSessionUser`) continua
 * sendo o seam que o resto do app chama — isto só isola a chamada real ao
 * Supabase Auth atrás dele, sem mudar comportamento nem memoização (a
 * memoização por request continua em `lib/tenancy.ts`, via React `cache`).
 */
export async function fetchCurrentIdentity(): Promise<Identity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? toIdentity(user) : null;
}
