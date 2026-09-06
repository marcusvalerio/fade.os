"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthActionState } from "@/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  const state = mode === "signin" ? signInState : signUpState;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-rise-in">
        <p className="font-logo font-[777] text-2xl tracking-tight text-foreground mb-8 text-center">
          FADE OS
        </p>

        <div className="rounded-md border border-border bg-surface p-7">
          <h1 className="text-section-title text-foreground">
            {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
          </h1>
          <p className="text-body-sm text-muted mt-1 mb-6">
            {mode === "signin"
              ? "Sua operação está esperando."
              : "Leva menos de dois minutos para começar."}
          </p>

          <div key={mode} className="animate-fade-in">
            {mode === "signin" ? (
              <form action={signInAction} className="space-y-4">
                <Field name="email" label="E-mail">
                  <Input id="email" name="email" type="email" required autoFocus />
                </Field>
                <Field name="password" label="Senha">
                  <Input id="password" name="password" type="password" required />
                </Field>
                {state.error && <p className="text-body-sm text-danger">{state.error}</p>}
                <Button type="submit" pending={signInPending} className="w-full">
                  {signInPending ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            ) : (
              <form action={signUpAction} className="space-y-4">
                <Field name="name" label="Seu nome">
                  <Input id="name" name="name" required autoFocus />
                </Field>
                <Field name="email" label="E-mail">
                  <Input id="email" name="email" type="email" required />
                </Field>
                <Field
                  name="password"
                  label="Senha"
                  helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial"
                >
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={8}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}"
                    title="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial"
                    required
                  />
                </Field>
                {state.error && <p className="text-body-sm text-danger">{state.error}</p>}
                <Button type="submit" pending={signUpPending} className="w-full">
                  {signUpPending ? "Criando…" : "Criar conta"}
                </Button>
              </form>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className={cn(
            "mt-5 w-full text-center text-body-sm text-muted hover:text-foreground",
            "transition-colors duration-fast ease-standard"
          )}
        >
          {mode === "signin"
            ? "Ainda não tem uma conta? Criar conta"
            : "Já tem uma conta? Entrar"}
        </button>
      </div>
    </main>
  );
}
