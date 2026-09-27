"use client";

import { Suspense, useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { updatePasswordAfterRecovery, type UpdatePasswordState } from "@/actions/auth";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { LayoutAcesso } from "@/components/layout-acesso";

const initialState: UpdatePasswordState = { error: null, success: false };

function RedefinirSenhaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkInvalido = searchParams.get("error") === "invalid";
  const [state, action, pending] = useActionState(updatePasswordAfterRecovery, initialState);

  useEffect(() => {
    if (state.success) router.replace("/");
  }, [state.success, router]);

  return (
    <div>
      {linkInvalido ? (
        <>
          <h1 className="text-page-title font-heading text-foreground">Link expirado</h1>
          <p className="text-body-sm text-muted mt-1.5 mb-7">
            Este link de recuperação não é mais válido — links de redefinição de senha expiram por segurança. Solicite
            um novo para continuar.
          </p>
          <Link
            href="/esqueci-senha"
            className="min-h-11 w-full inline-flex items-center justify-center rounded-sm bg-primary text-primary-foreground text-button font-medium hover:opacity-90 transition-opacity duration-fast ease-standard"
          >
            Solicitar novo link
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-page-title font-heading text-foreground">Defina sua nova senha</h1>
          <p className="text-body-sm text-muted mt-1.5 mb-7">Escolha uma nova senha para entrar no CORTEX.OS.</p>
          <form action={action} className="space-y-4">
            <Field
              name="password"
              label="Nova senha"
              helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial"
            >
              <PasswordInput id="password" name="password" minLength={8} required autoFocus />
            </Field>
            <Field name="confirmation" label="Confirme a senha">
              <PasswordInput id="confirmation" name="confirmation" minLength={8} required />
            </Field>
            {state.error && <p className="text-body-sm text-danger-ink">{state.error}</p>}
            <Button type="submit" pending={pending} className="w-full">
              {pending ? "Salvando…" : "Definir nova senha"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <LayoutAcesso>
      <div className="animate-rise-in">
        {/* useSearchParams() exige um limite de Suspense em build estático —
            o conteúdo real fica isolado aqui para o Next não tentar
            pré-renderizar a página inteira sem esse parâmetro. */}
        <Suspense fallback={null}>
          <RedefinirSenhaConteudo />
        </Suspense>
      </div>
    </LayoutAcesso>
  );
}
