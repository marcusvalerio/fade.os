"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { completeMandatoryPasswordChange } from "@/actions/auth";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { LayoutAcesso } from "@/components/layout-acesso";

const initialState = { error: null as string | null, success: false };
type PasswordState = typeof initialState;

async function submitPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password !== confirmation) return { error: "As senhas não coincidem.", success: false };

  const result = await completeMandatoryPasswordChange(password);
  if (!result.ok) return { error: result.error, success: false };

  return { error: null, success: true };
}

export default function InitialPasswordPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitPassword, initialState);

  useEffect(() => {
    if (state.success) router.replace("/");
  }, [state.success, router]);

  return (
    <LayoutAcesso>
      <div className="animate-rise-in">
        <div>
          <h1 className="text-page-title font-heading text-foreground">Crie sua senha</h1>
          <p className="text-body-sm text-muted mt-1.5 mb-7">
            Por segurança, defina uma nova senha antes de continuar.
          </p>
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
              {pending ? "Salvando…" : "Definir senha"}
            </Button>
          </form>
        </div>
      </div>
    </LayoutAcesso>
  );
}
