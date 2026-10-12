"use client";

import { Suspense, useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { updatePasswordAfterRecovery, type UpdatePasswordState } from "@/actions/auth";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { EntradaDoAdmin } from "../EntradaDoAdmin";

const initialState: UpdatePasswordState = { error: null, success: false };

/**
 * Nova senha depois do link pedido na entrada do Admin. A troca é a mesma do
 * app (updatePasswordAfterRecovery); depois dela, a pessoa vai para o Admin —
 * e o middleware confere, como sempre, se ela administra a plataforma.
 */
function Conteudo() {
  const router = useRouter();
  const linkInvalido = useSearchParams().get("error") === "invalid";
  const [state, action, pending] = useActionState(updatePasswordAfterRecovery, initialState);

  useEffect(() => {
    if (state.success) router.replace("/admin");
  }, [state.success, router]);

  if (linkInvalido) {
    return (
      <EntradaDoAdmin
        titulo="Link expirado"
        descricao="Este link de recuperação não é mais válido — links de redefinição de senha expiram por segurança."
      >
        <Link
          href="/admin/esqueci-senha"
          className="min-h-11 w-full inline-flex items-center justify-center rounded-sm bg-primary text-primary-foreground text-button font-medium hover:opacity-90 transition-opacity duration-fast ease-standard"
        >
          Solicitar novo link
        </Link>
      </EntradaDoAdmin>
    );
  }

  return (
    <EntradaDoAdmin titulo="Nova senha" descricao="Escolha uma nova senha para a sua conta. Ela vale para o Admin e para o CORTEX.OS.">
      <form action={action} className="space-y-4">
        <Field name="password" label="Nova senha" helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial">
          <PasswordInput id="admin-nova-senha" name="password" minLength={8} required autoFocus />
        </Field>
        <Field name="confirmation" label="Confirme a senha">
          <PasswordInput id="admin-confirmacao" name="confirmation" minLength={8} required />
        </Field>
        {state.error && (
          <p className="text-body-sm text-danger-ink" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" pending={pending} className="w-full">
          {pending ? "Salvando…" : "Definir nova senha"}
        </Button>
      </form>
    </EntradaDoAdmin>
  );
}

export default function AdminRedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}
