import { randomInt } from "crypto";

/**
 * Senha provisória para uma conta criada pelo platform admin (aprovação de
 * Beta) — mesma regra de lib/auth-validation.ts:passwordSchema (maiúscula,
 * minúscula, número, caractere especial, mínimo 8), gerada com CSPRNG
 * (crypto.randomInt), nunca Math.random(). Existe só pelo tempo necessário
 * para criar a conta no Supabase Auth e ser mostrada uma vez ao admin —
 * nunca é persistida em texto puro em nenhuma tabela.
 */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits;

  const pick = (chars: string) => chars[randomInt(chars.length)];

  let body = "";
  for (let i = 0; i < 8; i++) body += pick(all);

  // Garante as quatro classes exigidas por passwordSchema sem depender da
  // sorte do sorteio do corpo.
  return pick(upper) + pick(lower) + pick(digits) + pick(symbols) + body;
}
