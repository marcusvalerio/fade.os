"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitBetaAccessRequest } from "@/actions/beta";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import type { ActionResult } from "@/actions/onboarding";

const initialState: ActionResult<null> = { ok: false, error: "" };

/**
 * Porta pública de entrada do Beta — sem login, sem CORTEX ADMIN.
 * LANDING → solicitar acesso → registro em beta_access_requests → fila do
 * platform admin em /admin/acessos.
 */
export default function BetaPage() {
  const [state, action, pending] = useActionState(submitBetaAccessRequest, initialState);
  const showError = !state.ok && state.error;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-rise-in">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="CORTEX.OS — voltar para o início">
            <Wordmark tamanho="lg" />
          </Link>
        </div>
        <div className="material-solid rounded-md p-7">
          {state.ok ? (
            <>
              <h1 className="text-section-title text-foreground">Pedido recebido</h1>
              <p className="text-body-sm text-muted mt-1">
                Cada pedido é lido por uma pessoa. A gente responde pelo e-mail informado — ou pelo WhatsApp, se
                você deixou o número.
              </p>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center mt-3 text-body-sm text-foreground underline underline-offset-4"
              >
                Voltar para o início
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-section-title text-foreground">Pedir acesso ao Beta</h1>
              <p className="text-body-sm text-muted mt-1 mb-6">
                Conte o nome da barbearia e como falar com você. A gente responde e combina a sua entrada.
              </p>
              <form action={action} className="space-y-4">
                <Field name="barbershop_name" label="Nome da barbearia">
                  <Input id="barbershop_name" name="barbershop_name" required autoFocus />
                </Field>
                <Field name="name" label="Seu nome">
                  <Input id="name" name="name" required />
                </Field>
                <Field name="email" label="E-mail">
                  <Input id="email" name="email" type="email" required />
                </Field>
                <Field name="region" label="Região (opcional)">
                  <Input id="region" name="region" placeholder="Cidade/UF" />
                </Field>
                <Field name="phone" label="WhatsApp (opcional)">
                  <Input id="phone" name="phone" type="tel" />
                </Field>
                {showError && <p className="text-body-sm text-danger-ink">{state.error}</p>}
                <Button type="submit" pending={pending} className="w-full">
                  {pending ? "Enviando…" : "Pedir acesso"}
                </Button>
              </form>
            </>
          )}
        </div>
        {!state.ok && (
          <p className="text-center mt-5">
            <Link href="/" className="inline-flex min-h-11 items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              ← Voltar para o início
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
