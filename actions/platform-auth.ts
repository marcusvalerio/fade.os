"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAuthProvider } from "@/infrastructure/auth/supabase/auth-provider";

const authProvider = createSupabaseAuthProvider();

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export type PlatformAuthState = { error: string | null };

export async function signInPlatformAdmin(
  _prevState: PlatformAuthState,
  formData: FormData
): Promise<PlatformAuthState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await authProvider.signInWithPassword(parsed.data);
  if (!result.ok) return { error: "E-mail ou senha incorretos" };

  const supabase = await createClient();
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_platform_admin");

  if (adminError || isAdmin !== true) {
    await authProvider.signOut();
    return { error: "Esta conta não possui acesso ao CORTEX ADMIN" };
  }

  redirect("/admin");
}
