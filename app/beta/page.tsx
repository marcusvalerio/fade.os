"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FRASE_COMERCIAL } from "@/lib/beta";
import { ecoDoFormulario, type ValoresEnviados } from "@/lib/form-echo";
import { submitBetaAccessRequest } from "@/actions/beta";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LayoutAcesso } from "@/components/layout-acesso";
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
  // O React 19 limpa o formulário quando a action termina, mesmo quando o
  // pedido foi recusado. O que foi enviado volta como defaultValue: a pessoa
  // corrige só o campo errado.
  const [enviado, setEnviado] = useState<ValoresEnviados>({});

  return (
    <LayoutAcesso
      frase="Estamos abrindo o CORTEX uma barbearia de cada vez."
      apoio="Cada pedido é lido por uma pessoa. A gente conversa sobre a sua operação e acompanha a entrada da equipe."
    >
      <div className="animate-rise-in">
        <div>
          {state.ok ? (
            <>
              <h1 className="text-page-title font-heading text-foreground">Pedido recebido</h1>
              <p className="text-body-sm text-muted mt-1.5">
                Cada pedido é lido por uma pessoa. A gente responde pelo e-mail informado — ou pelo WhatsApp, se você
                deixou o número.
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
              <h1 className="text-page-title font-heading text-foreground">Pedir acesso ao Beta</h1>
              <p className="text-body-sm text-muted mt-1.5">
                Conte o nome da barbearia e como falar com você. A gente responde e combina a sua entrada.
              </p>
              <p className="text-caption text-muted mt-3 mb-7 flex gap-2">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-brand-blue" />
                {FRASE_COMERCIAL}
              </p>
              <form
                action={action}
                onSubmit={(e) => setEnviado(ecoDoFormulario(new FormData(e.currentTarget)))}
                className="space-y-4"
              >
                <Field name="barbershop_name" label="Nome da barbearia">
                  <Input id="barbershop_name" name="barbershop_name" required autoFocus defaultValue={enviado.barbershop_name} />
                </Field>
                <Field name="name" label="Seu nome">
                  <Input id="name" name="name" required defaultValue={enviado.name} />
                </Field>
                <Field name="email" label="E-mail">
                  <Input id="email" name="email" type="email" required defaultValue={enviado.email} />
                </Field>
                <Field name="region" label="Região (opcional)">
                  <Input id="region" name="region" placeholder="Cidade/UF" defaultValue={enviado.region} />
                </Field>
                <Field name="phone" label="WhatsApp (opcional)">
                  <Input id="phone" name="phone" type="tel" defaultValue={enviado.phone} />
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
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
            >
              ← Voltar para o início
            </Link>
          </p>
        )}
      </div>
    </LayoutAcesso>
  );
}
