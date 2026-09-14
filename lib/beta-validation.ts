import { z } from "zod";

export const betaAccessRequestSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  name: z.string().min(2, "Informe seu nome"),
  barbershop_name: z.string().min(2, "Informe o nome da barbearia"),
  region: z.string().optional(),
  phone: z.string().optional(),
});
