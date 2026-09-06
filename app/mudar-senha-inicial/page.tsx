"use client";

import { useActionState } from "react";
import { redirect } from "next/navigation";
import { changeProfessionalPassword } from "@/actions/profissional-acesso";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };

type PasswordState = typeof initialState;

async function submitPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password !== confirmation) return { error: "As senhas não coincidem." };

  const result = await changeProfessionalPassword(password);
  if (!result.ok) return { error: result.error };

  redirect("/");
}

export default function InitialPasswordPage() {
  const [state, action, pending] = useActionState(submitPassword, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-rise-in">
        <p className="font-logo font-[777] text-2xl tracking-tight text-foreground mb-8 text-center">FADE OS</p>
        <div className="rounded-md border border-border bg-surface p-7">
          <h1 className="text-section-title text-foreground">Crie sua senha</h1>
          <p className="text-body-sm text-muted mt-1 mb-6">Por segurança, defina uma nova senha antes de continuar.</p>
          <form action={action} className="space-y-4">
            <Field name="password" label="Nova senha" helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial">
              <Input id="password" name="password" type="password" minLength={8} required autoFocus />
            </Field>
            <Field name="confirmation" label="Confirme a senha">
              <Input id="confirmation" name="confirmation" type="password" minLength={8} required />
            </Field>
            {state.error && <p className="text-body-sm text-danger">{state.error}</p>}
            <Button type="submit" pending={pending} className="w-full">{pending ? "Salvando…" : "Definir senha"}</Button>
          </form>
        </div>
      </div>
    </main>
  );
}
