import { z } from "zod";

export const PASSWORD_MESSAGE =
  "A senha precisa ter pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial";

/**
 * Regra de senha única do projeto — cadastro, primeiro acesso do
 * profissional e recuperação de senha usam exatamente este schema, nunca
 * uma cópia com regra diferente.
 */
export const passwordSchema = z
  .string()
  .min(8, PASSWORD_MESSAGE)
  .regex(/[a-z]/, PASSWORD_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_MESSAGE)
  .regex(/[0-9]/, PASSWORD_MESSAGE)
  .regex(/[^a-zA-Z0-9]/, PASSWORD_MESSAGE);

export const emailSchema = z.string().email("Informe um e-mail válido");

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation;
}
