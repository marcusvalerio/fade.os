"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ResetRequestState } from "@/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

const initialState: ResetRequestState = { error: null, success: false };

/**
 * Passo intermediário, não a porta de entrada — mesma razão de
 * mudar-senha-inicial para não repetir a animação de abertura da marca
 * aqui: quem chega nesta tela já viu o CORTEX.OS antes.
 */
export default function EsqueciSenhaPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-rise-in">
        <div className="flex justify-center mb-8">
          <Wordmark tamanho="lg" />
        </div>
        <div className="material-solid rounded-md p-7">
          {state.success ? (
            <>
              <h1 className="text-section-title text-foreground">Verifique seu e-mail</h1>
              <p className="text-body-sm text-muted mt-1">
                Se esse e-mail tiver uma conta no CORTEX.OS, enviamos um link para redefinir a
                senha. Ele expira em pouco tempo — se não chegar em alguns minutos, confira o
                spam ou peça um novo.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-section-title text-foreground">Esqueceu sua senha?</h1>
              <p className="text-body-sm text-muted mt-1 mb-6">
                Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
              </p>
              <form action={action} className="space-y-4">
                <Field name="email" label="E-mail">
                  <Input id="email" name="email" type="email" required autoFocus />
                </Field>
                {state.error && <p className="text-body-sm text-danger-ink">{state.error}</p>}
                <Button type="submit" pending={pending} className="w-full">
                  {pending ? "Enviando…" : "Enviar link de recuperação"}
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="mt-5 text-center text-body-sm">
          <Link
            href="/login"
            className="min-h-11 inline-flex items-center text-muted hover:text-foreground transition-colors duration-fast ease-standard"
          >
            Voltar para o login
          </Link>
        </div>

        {/* Profissionais (acesso por identificador) não têm e-mail próprio —
            o caminho deles é sempre o gerente resetar o acesso em Equipe. */}
        <p className="mt-3 text-center text-caption text-muted">
          É profissional e não tem e-mail cadastrado? Peça ao responsável pela barbearia para
          resetar seu acesso em Configurações → Equipe.
        </p>
      </div>
    </main>
  );
}
