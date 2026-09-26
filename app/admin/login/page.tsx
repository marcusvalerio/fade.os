"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInPlatformAdmin, type PlatformAuthState } from "@/actions/platform-auth";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

const initialState: PlatformAuthState = { error: null };

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(signInPlatformAdmin, initialState);

  return (
    <main className="min-h-screen bg-neutral-ink text-[var(--neutral-bone)] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link href="/login" className="text-caption text-white/55 hover:text-white transition-colors">
            CORTEX.OS
          </Link>
          <p className="mt-8 text-label uppercase tracking-label text-white/45">Plataforma</p>
          <h1 className="mt-2 font-heading text-3xl sm:text-4xl tracking-tight">CORTEX ADMIN</h1>
          <p className="mt-3 text-body-sm text-white/60 max-w-sm">
            Entre com a sua conta de administrador da plataforma para gerenciar empresas, acessos, usuários e auditoria.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <Field name="email" label="E-mail">
            <Input id="admin-email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field name="password" label="Senha">
            <PasswordInput id="admin-password" name="password" autoComplete="current-password" required />
          </Field>

          {state.error && (
            <p className="text-body-sm text-danger-ink" role="alert">
              {state.error}
            </p>
          )}

          <Button type="submit" pending={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar no Admin"}
          </Button>
        </form>

        <p className="mt-6 text-caption text-white/40">
          Esta entrada é exclusiva da administração da plataforma. Ser proprietário, gerente ou profissional de uma barbearia não concede acesso ao Admin.
        </p>
      </div>
    </main>
  );
}
