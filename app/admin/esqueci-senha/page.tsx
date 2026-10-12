"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ResetRequestState } from "@/actions/auth";
import { solicitarRecuperacaoDoAdmin } from "@/actions/platform-auth";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EntradaDoAdmin } from "../EntradaDoAdmin";

const initialState: ResetRequestState = { error: null, success: false };

/**
 * Recuperação de senha pela entrada do Admin. Mesma conta e mesmo pedido do
 * app (não existe "senha do Admin" separada); a diferença é que o link volta
 * para /admin/redefinir-senha e, depois, para o Admin.
 */
export default function AdminEsqueciSenhaPage() {
  const [state, action, pending] = useActionState(solicitarRecuperacaoDoAdmin, initialState);

  return (
    <EntradaDoAdmin
      titulo={state.success ? "Verifique seu e-mail" : "Recuperar acesso"}
      descricao={
        state.success
          ? "Se esse e-mail tiver uma conta, enviamos um link para criar uma nova senha. Abra o link neste mesmo navegador para voltar direto ao Admin."
          : "Informe o e-mail da sua conta de administrador. Enviaremos um link para você criar uma nova senha."
      }
      rodape={
        <Link href="/admin/login" className="min-h-11 inline-flex items-center text-white/55 hover:text-white transition-colors">
          ← Voltar para a entrada do Admin
        </Link>
      }
    >
      {!state.success && (
        <form action={action} className="space-y-4">
          <Field name="email" label="E-mail">
            <Input id="admin-recuperacao-email" name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          {state.error && (
            <p className="text-body-sm text-danger-ink" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" pending={pending} className="w-full">
            {pending ? "Enviando…" : "Enviar link de recuperação"}
          </Button>
        </form>
      )}
    </EntradaDoAdmin>
  );
}
