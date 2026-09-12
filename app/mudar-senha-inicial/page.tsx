"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changeProfessionalPassword } from "@/actions/profissional-acesso";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

const initialState = { error: null as string | null, success: false };
type PasswordState = typeof initialState;

async function submitPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password !== confirmation) return { error: "As senhas não coincidem.", success: false };

  const result = await changeProfessionalPassword(password);
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
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-rise-in">
        {/* Wordmark compartilhada (R19): a marca reimplementava a própria
            tipografia aqui, com o nome antigo do produto ("FADE OS") — a
            última tela onde isso ainda acontecia. Sem a animação de digitação
            da Abertura: esta não é a primeira impressão do produto, é um
            passo no meio de um fluxo. */}
        <div className="flex justify-center mb-8">
          <Wordmark tamanho="lg" />
        </div>
        <div className="material-solid rounded-md p-7">
          <h1 className="text-section-title text-foreground">Crie sua senha</h1>
          <p className="text-body-sm text-muted mt-1 mb-6">Por segurança, defina uma nova senha antes de continuar.</p>
          <form action={action} className="space-y-4">
            <Field name="password" label="Nova senha" helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial">
              <Input id="password" name="password" type="password" minLength={8} required autoFocus />
            </Field>
            <Field name="confirmation" label="Confirme a senha">
              <Input id="confirmation" name="confirmation" type="password" minLength={8} required />
            </Field>
            {state.error && <p className="text-body-sm text-danger-ink">{state.error}</p>}
            <Button type="submit" pending={pending} className="w-full">{pending ? "Salvando…" : "Definir senha"}</Button>
          </form>
        </div>
      </div>
    </main>
  );
}
