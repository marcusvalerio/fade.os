"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInPlatformAdmin, type PlatformAuthState } from "@/actions/platform-auth";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

const initialState: PlatformAuthState = { error: null };

export function FormularioDoAdmin({ proximo, emailPadrao }: { proximo: string | null; emailPadrao?: string }) {
  const [state, action, pending] = useActionState(signInPlatformAdmin, initialState);

  return (
    <form action={action} className="space-y-4">
      {proximo && <input type="hidden" name="proximo" value={proximo} />}
      <Field name="email" label="E-mail">
        <Input id="admin-email" name="email" type="email" autoComplete="username" required autoFocus={!emailPadrao} defaultValue={emailPadrao} />
      </Field>
      <Field name="password" label="Senha">
        <PasswordInput id="admin-password" name="password" autoComplete="current-password" required autoFocus={!!emailPadrao} />
      </Field>

      {state.error && (
        <p className="text-body-sm text-danger-ink" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar no Admin"}
      </Button>
      <div className="text-center">
        <Link
          href="/admin/esqueci-senha"
          className="min-h-11 inline-flex items-center text-body-sm text-white/55 hover:text-white transition-colors duration-fast ease-standard"
        >
          Esqueci minha senha
        </Link>
      </div>
    </form>
  );
}
