"use client";

import { useActionState, useState } from "react";
import { AberturaDaMarca } from "./AberturaDaMarca";
import { signIn, signUp, type AuthActionState } from "@/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const initialState: AuthActionState = { error: null };

type LoginMode = "signin" | "signup" | "professional";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);
  const state = mode === "signup" ? signUpState : signInState;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <AberturaDaMarca>
        <div className="rounded-md border border-border bg-surface p-7">
          <h1 className="text-section-title text-foreground">
            {mode === "signup" ? "Crie sua conta" : mode === "professional" ? "Acesso profissional" : "Entre na sua conta"}
          </h1>
          <p className="text-body-sm text-muted mt-1 mb-6">
            {mode === "signup" ? "Leva menos de dois minutos para começar." : mode === "professional" ? "Entre com seu identificador de profissional." : "Sua operação está esperando."}
          </p>

          <div key={mode} className="animate-fade-in">
            {mode === "professional" ? (
              <form action={signInAction} className="space-y-4">
                <input type="hidden" name="mode" value="professional" />
                <Field name="identifier" label="Identificador">
                  <Input id="identifier" name="identifier" maxLength={6} autoCapitalize="characters" autoCorrect="off" spellCheck={false} required autoFocus />
                </Field>
                <Field name="password" label="Senha">
                  <Input id="professional-password" name="password" type="password" required />
                </Field>
                {state.error && <p className="text-body-sm text-danger">{state.error}</p>}
                <Button type="submit" pending={signInPending} className="w-full">{signInPending ? "Entrando…" : "Entrar"}</Button>
              </form>
            ) : mode === "signin" ? (
              <form action={signInAction} className="space-y-4">
                <input type="hidden" name="mode" value="signin" />
                <Field name="email" label="E-mail"><Input id="email" name="email" type="email" required autoFocus /></Field>
                <Field name="password" label="Senha"><Input id="password" name="password" type="password" required /></Field>
                {state.error && <p className="text-body-sm text-danger">{state.error}</p>}
                <Button type="submit" pending={signInPending} className="w-full">{signInPending ? "Entrando…" : "Entrar"}</Button>
              </form>
            ) : (
              <form action={signUpAction} className="space-y-4">
                <Field name="name" label="Seu nome"><Input id="name" name="name" required autoFocus /></Field>
                <Field name="email" label="E-mail"><Input id="signup-email" name="email" type="email" required /></Field>
                <Field name="password" label="Senha" helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial">
                  <Input id="signup-password" name="password" type="password" minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}" required />
                </Field>
                {state.error && <p className="text-body-sm text-danger">{state.error}</p>}
                <Button type="submit" pending={signUpPending} className="w-full">{signUpPending ? "Criando…" : "Criar conta"}</Button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 text-center text-body-sm">
          {mode !== "professional" && <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className={cn("min-h-11 text-muted hover:text-foreground transition-colors duration-fast ease-standard")}>{mode === "signin" ? "Ainda não tem uma conta? Criar conta" : "Já tem uma conta? Entrar"}</button>}
          <button type="button" onClick={() => setMode(mode === "professional" ? "signin" : "professional")} className={cn("min-h-11 text-muted hover:text-foreground transition-colors duration-fast ease-standard")}>{mode === "professional" ? "Voltar para acesso administrativo" : "Sou profissional da barbearia"}</button>
        </div>
      </AberturaDaMarca>
    </main>
  );
}
