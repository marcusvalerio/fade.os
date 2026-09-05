"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthActionState } from "@/actions/auth";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState
  );

  const state = mode === "signin" ? signInState : signUpState;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-dusty-cotton)] px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-2xl mb-1">FADE OS</h1>
        <p className="text-sm text-[var(--color-midnight-smoke)] mb-6">
          {mode === "signin"
            ? "Entre na sua conta"
            : "Crie sua conta para começar"}
        </p>

        {mode === "signin" ? (
          <form action={signInAction} className="space-y-4">
            <Field name="email" label="E-mail" type="email" />
            <Field name="password" label="Senha" type="password" />
            {state.error && <ErrorText message={state.error} />}
            <SubmitButton pending={signInPending} label="Entrar" />
          </form>
        ) : (
          <form action={signUpAction} className="space-y-4">
            <Field name="name" label="Seu nome" type="text" />
            <Field name="email" label="E-mail" type="email" />
            <Field
              name="password"
              label="Senha"
              type="password"
              helper="Mínimo de 8 caracteres"
            />
            {state.error && <ErrorText message={state.error} />}
            <SubmitButton pending={signUpPending} label="Criar conta" />
          </form>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-[var(--color-red-gravy)] underline"
        >
          {mode === "signin"
            ? "Ainda não tem uma barbearia cadastrada? Criar conta"
            : "Já tem uma conta? Entrar"}
        </button>
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  type,
  helper,
}: {
  name: string;
  label: string;
  type: string;
  helper?: string;
}) {
  return (
    <div>
      <label className="block text-sm mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        className="w-full border border-[var(--color-midnight-smoke)]/20 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-red-gravy)]"
      />
      {helper && (
        <p className="text-xs text-[var(--color-midnight-smoke)]/70 mt-1">
          {helper}
        </p>
      )}
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-sm text-[var(--color-otan-red)]">{message}</p>;
}

function SubmitButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-[var(--color-cobblestone)] text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
    >
      {pending ? "Aguarde..." : label}
    </button>
  );
}
