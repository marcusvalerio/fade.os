"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AberturaDaMarca } from "./AberturaDaMarca";
import { signIn, signUp, type AuthActionState } from "@/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { CortexMark } from "@/components/ui/cortex-mark";
import { cn } from "@/lib/cn";

const initialState: AuthActionState = { error: null };

type LoginMode = "signin" | "signup" | "professional";

const TITULO: Record<LoginMode, string> = {
  signin: "Entre na sua conta",
  signup: "Crie sua conta",
  professional: "Acesso profissional",
};

const SUBTITULO: Record<LoginMode, string> = {
  signin: "Sua operação está esperando.",
  signup: "Leva menos de dois minutos para começar.",
  professional: "Entre com o identificador da sua barbearia.",
};

/**
 * P1.1 — um login só, para administrador, profissional, dono-que-também-
 * atende e demais usuários autorizados. "Sou profissional da barbearia"
 * troca o modo do MESMO formulário — nunca existiram (e não passam a
 * existir agora) duas telas ou dois sistemas de autenticação.
 *
 * Direção visual: CAMPO → BLOCO, não card-centralizado-sobre-fundo-genérico.
 * Duas colunas — identidade (CORTEX, silenciosa, Creeping Depth) e tarefa
 * (o formulário, em primeiro plano). Em telas estreitas a identidade vira
 * uma faixa curta acima do formulário, nunca a maior parte da tela: quem
 * abre o login está ali para entrar, não para admirar a marca.
 *
 * Fechamento pré-piloto: paleta reduzida a 3 cores (Bright White, Kahu
 * Blue, Creeping Depth) — `.auth-scope` redefine só localmente os tokens
 * --primary/--signal para Kahu Blue (nunca o token global, que continua
 * amarelo no resto do produto operacional). Google removido da UI: sem
 * beta aberto para esse provedor, o botão e o divisor "ou" só criavam uma
 * opção que não faz nada.
 */
export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);
  const state = mode === "signup" ? signUpState : signInState;

  return (
    <main className="auth-scope min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <PainelIdentidade />

      <div className="flex items-center justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="animate-rise-in">
            <h1 className="text-page-title font-heading text-foreground">{TITULO[mode]}</h1>
            <p className="text-body-sm text-muted mt-1.5 mb-7">{SUBTITULO[mode]}</p>

            <div key={mode} className="animate-fade-in">
              {mode === "professional" ? (
                <form action={signInAction} className="space-y-4">
                  <input type="hidden" name="mode" value="professional" />
                  <Field name="identifier" label="Identificador">
                    <Input
                      id="identifier"
                      name="identifier"
                      maxLength={6}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      required
                      autoFocus
                    />
                  </Field>
                  <Field name="password" label="Senha">
                    <PasswordInput id="professional-password" name="password" autoComplete="current-password" required />
                  </Field>
                  {state.error && <p className="text-body-sm text-danger-ink" role="alert">{state.error}</p>}
                  <Button type="submit" pending={signInPending} className="w-full">
                    {signInPending ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              ) : mode === "signin" ? (
                <form action={signInAction} className="space-y-4">
                  <input type="hidden" name="mode" value="signin" />
                  <Field name="email" label="E-mail">
                    <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
                  </Field>
                  <Field name="password" label="Senha">
                    <PasswordInput id="password" name="password" autoComplete="current-password" required />
                  </Field>
                  <div className="flex justify-end -mt-1">
                    <Link
                      href="/esqueci-senha"
                      className="min-h-11 inline-flex items-center text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
                    >
                      Esqueceu sua senha?
                    </Link>
                  </div>
                  {state.error && <p className="text-body-sm text-danger-ink" role="alert">{state.error}</p>}
                  <Button type="submit" pending={signInPending} className="w-full">
                    {signInPending ? "Entrando…" : "Entrar"}
                  </Button>
                </form>
              ) : (
                <form action={signUpAction} className="space-y-4">
                  <Field name="name" label="Seu nome">
                    <Input id="name" name="name" autoComplete="name" required autoFocus />
                  </Field>
                  <Field name="email" label="E-mail">
                    <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                  </Field>
                  <Field
                    name="password"
                    label="Senha"
                    helper="Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial"
                  >
                    <PasswordInput
                      id="signup-password"
                      name="password"
                      autoComplete="new-password"
                      minLength={8}
                      pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}"
                      required
                    />
                  </Field>
                  {state.error && <p className="text-body-sm text-danger-ink" role="alert">{state.error}</p>}
                  <Button type="submit" pending={signUpPending} className="w-full">
                    {signUpPending ? "Criando…" : "Criar conta"}
                  </Button>
                </form>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-1 text-center text-body-sm">
              {mode !== "professional" && (
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="min-h-11 text-muted hover:text-foreground transition-colors duration-fast ease-standard"
                >
                  {mode === "signin" ? "Ainda não tem uma conta? Criar conta" : "Já tem uma conta? Entrar"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode(mode === "professional" ? "signin" : "professional")}
                className="min-h-11 text-muted hover:text-foreground transition-colors duration-fast ease-standard"
              >
                {mode === "professional" ? "Voltar para acesso administrativo" : "Sou profissional da barbearia"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Painel de identidade — Creeping Depth, sempre, independente do tema do
 * visitante: é a mesma moldura escura do shell operacional (ver
 * --shell-*), não um "hero" que muda de cor. Em mobile vira uma faixa
 * curta acima do formulário; em desktop ocupa a coluna inteira.
 *
 * O motivo geométrico ("O Corte") deixou de ser protagonista nítido —
 * fechamento pré-piloto pediu atmosfera, não "olha para este círculo":
 * blur pesado, opacidade baixa, tons de azul/branco (nunca mais amarelo
 * aqui), grande o bastante para sugerir profundidade atrás da interface
 * sem competir com o wordmark ou o formulário.
 */
function PainelIdentidade() {
  return (
    <div className="relative overflow-hidden bg-[var(--neutral-ink)] text-[var(--neutral-bone)] px-8 py-10 sm:px-12 sm:py-14 lg:px-16 lg:py-0 lg:flex lg:flex-col lg:justify-center lg:min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 lg:-right-48 lg:top-1/2 lg:-translate-y-1/2 opacity-40 blur-3xl motion-reduce:blur-2xl"
      >
        <CortexMark size={380} angle={26} toneA="rgb(0 147 214 / 55%)" toneB="rgb(246 242 241 / 30%)" className="sm:hidden" />
        <CortexMark size={620} angle={26} toneA="rgb(0 147 214 / 55%)" toneB="rgb(246 242 241 / 30%)" className="hidden sm:block" />
      </div>

      <div className="relative max-w-sm animate-entra-origem">
        <AberturaDaMarca tamanho="lg" align="start" className="mb-6 lg:mb-10" />
        <p className="font-heading text-[1.5rem] sm:text-[1.75rem] leading-[1.15] tracking-[-0.01em]">
          A operação inteira da sua barbearia, num só lugar.
        </p>
        <p className="text-body-sm mt-4 max-w-xs" style={{ color: "rgb(232 230 221 / 68%)" }}>
          Agenda, atendimento, venda, caixa, comissão e financeiro — um sistema, não seis planilhas.
        </p>
      </div>
    </div>
  );
}
