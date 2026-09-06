"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyAuthMessage } from "@/lib/errors";

const PASSWORD_MESSAGE = "A senha precisa ter pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial";
const passwordSchema = z.string().min(8, PASSWORD_MESSAGE).regex(/[a-z]/, PASSWORD_MESSAGE).regex(/[A-Z]/, PASSWORD_MESSAGE).regex(/[0-9]/, PASSWORD_MESSAGE).regex(/[^a-zA-Z0-9]/, PASSWORD_MESSAGE);
const signUpSchema = z.object({ name: z.string().min(2, "Informe seu nome"), email: z.string().email("E-mail inválido"), password: passwordSchema });
const signInSchema = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(1, "Informe sua senha") });
const identifierSchema = z.string().regex(/^[A-Za-z0-9]{6}$/, "Identificador inválido");

export type AuthActionState = { error: string | null };

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { name: parsed.data.name } } });
  if (error) { console.error("[fade-os] erro no signup:", error.message); return { error: friendlyAuthMessage(error.message) }; }
  redirect("/onboarding");
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const mode = formData.get("mode");
  const password = String(formData.get("password") ?? "");
  if (mode === "professional") {
    const identifier = identifierSchema.safeParse(String(formData.get("identifier") ?? "").trim().toUpperCase());
    if (!identifier.success || !password) return { error: "Identificador ou senha incorretos" };
    const supabase = await createClient();
    const { data: access } = await supabase.from("professional_access").select("access_identifier, is_access_enabled, password_set_at").eq("access_identifier", identifier.data).maybeSingle();
    if (!access?.is_access_enabled) return { error: "Identificador ou senha incorretos" };
    const { error } = await supabase.auth.signInWithPassword({ email: `${identifier.data.toLowerCase()}@login.fade.os`, password });
    if (error) return { error: "Identificador ou senha incorretos" };
    if (!access.password_set_at) redirect("/mudar-senha-inicial");
    redirect("/");
  }

  const parsed = signInSchema.safeParse({ email: formData.get("email"), password });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos" };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
