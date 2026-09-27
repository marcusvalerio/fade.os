"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthActionState } from "@/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { marcarEntrada, desmarcarEntrada } from "@/lib/entrada";
import type { ProvedoresOAuth } from "@/lib/auth-provedores";
import { BotaoGoogle } from "./BotaoGoogle";
import { cn } from "@/lib/cn";
import { LayoutAcesso } from "@/components/layout-acesso";

const initialState: AuthActionState = { error: null };

type Modo = "email" | "profissional" | "cadastro";

/**
 * Um login só, para dono, gerente, recepção e profissional (P1.1) — os modos
 * trocam o MESMO formulário, nunca existiram dois sistemas de autenticação.
 * O que muda nesta versão é a apresentação e o caminho de volta ao produto;
 * as Server Actions (signIn/signUp) e as regras delas são as mesmas.
 *
 * Duas colunas: a marca (o painel escuro, o mesmo Creeping Depth do shell do
 * produto e das seções escuras da landing — com a mesma frase do Hero) e a
 * tarefa (o formulário, na superfície clara de trabalho). No celular a marca
 * vira uma faixa curta no topo: quem abre o login está ali para entrar.
 *
 * Ao enviar, o formulário entra em estado de transição (fica esmaecido, o
 * botão mostra o sinal do CORTEX) e marca a entrada: do outro lado, o produto
 * abre com a sequência da marca (components/entrada-cortex.tsx).
 */
export function LoginForm({ provedores, erroOAuth }: { provedores: ProvedoresOAuth; erroOAuth: boolean }) {
  const [modo, setModo] = useState<Modo>("email");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);
  const state = modo === "cadastro" ? signUpState : signInState;
  const pending = modo === "cadastro" ? signUpPending : signInPending;

  // O erro pertence ao modo que o enviou: trocar para "Sou profissional"
  // depois de errar a senha do e-mail não pode mostrar o erro do e-mail.
  // E o que foi digitado volta para o campo — o React 19 limpa o formulário
  // depois da action, então o valor enviado vira o defaultValue.
  const [envio, setEnvio] = useState<{ modo: Modo; email: string; identificador: string } | null>(null);

  const erro =
    (envio?.modo === modo ? state.error : null) ??
    (erroOAuth && modo === "email"
      ? "Não foi possível concluir o login pelo provedor. Tente de novo ou entre com e-mail."
      : null);

  // O erro recebe o foco: leitor de tela anuncia, e quem digita volta a
  // enxergar o que deu errado sem procurar. O login falhou, então a entrada
  // marcada no envio é desfeita.
  const erroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.error) return;
    desmarcarEntrada();
    erroRef.current?.focus();
  }, [state]);

  // Voltou do Google sem sessão (cancelou ou o provedor recusou): a entrada
  // marcada no clique é desfeita, como no erro de senha.
  useEffect(() => {
    if (erroOAuth) desmarcarEntrada();
  }, [erroOAuth]);

  const titulo = modo === "cadastro" ? "Criar conta" : "Entrar";
  const subtitulo =
    modo === "cadastro"
      ? "Leva menos de dois minutos para começar."
      : modo === "profissional"
        ? "Use o identificador que a barbearia criou para você."
        : "Sua operação continua de onde parou.";

  const campoInvalido = erro ? { "aria-invalid": true, "aria-describedby": "login-erro" } : {};

  return (
    <LayoutAcesso>
      <h1 className="text-page-title font-heading text-foreground">{titulo}</h1>
      <p className="text-body-sm text-muted mt-1.5">{subtitulo}</p>

      {modo !== "cadastro" && (
        <div
          className="mt-7 grid grid-cols-2 rounded-sm border border-border-strong p-0.5"
          role="group"
          aria-label="Como você entra"
        >
          {(
            [
              ["email", "Com e-mail"],
              ["profissional", "Sou profissional"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setModo(valor)}
              aria-pressed={modo === valor}
              className={cn(
                "alvo-toque h-9 rounded-xs text-body-sm font-medium transition-colors duration-interacao ease-standard",
                modo === valor ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      <div key={modo} className="mt-6 animate-fade-in">
        <form
          action={modo === "cadastro" ? signUpAction : signInAction}
          onSubmit={(evento) => {
            const dados = new FormData(evento.currentTarget);
            setEnvio({
              modo,
              email: String(dados.get("email") ?? ""),
              identificador: String(dados.get("identifier") ?? ""),
            });
            if (modo !== "cadastro") marcarEntrada();
          }}
        >
          <fieldset
            disabled={pending}
            className={cn("space-y-4 transition-opacity duration-interacao ease-standard", pending && "opacity-60")}
          >
            {modo === "profissional" ? (
              <>
                <input type="hidden" name="mode" value="professional" />
                <Field name="identifier" label="Identificador" helper="São 6 letras e números.">
                  <Input
                    id="identifier"
                    name="identifier"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    defaultValue={envio?.modo === "profissional" ? envio.identificador : undefined}
                    className="uppercase tracking-label"
                    required
                    autoFocus
                    {...campoInvalido}
                  />
                </Field>
                <Field name="professional-password" label="Senha">
                  <PasswordInput
                    id="professional-password"
                    name="password"
                    autoComplete="current-password"
                    required
                    {...campoInvalido}
                  />
                </Field>
              </>
            ) : modo === "email" ? (
              <>
                <input type="hidden" name="mode" value="signin" />
                <Field name="email" label="E-mail">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={envio?.modo === "email" ? envio.email : undefined}
                    required
                    autoFocus
                    {...campoInvalido}
                  />
                </Field>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="password" className="block text-label uppercase text-muted">
                      Senha
                    </label>
                    <Link
                      href="/esqueci-senha"
                      className="alvo-toque text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
                    >
                      Esqueceu?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    {...campoInvalido}
                  />
                </div>
              </>
            ) : (
              <>
                <Field name="name" label="Seu nome">
                  <Input id="name" name="name" autoComplete="name" required autoFocus />
                </Field>
                <Field name="signup-email" label="E-mail">
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={envio?.modo === "cadastro" ? envio.email : undefined}
                    required
                    {...campoInvalido}
                  />
                </Field>
                <Field
                  name="signup-password"
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
              </>
            )}

            {erro && (
              <div
                ref={erroRef}
                id="login-erro"
                role="alert"
                tabIndex={-1}
                className="flex items-start gap-2.5 rounded-sm border border-danger/35 bg-danger/5 px-3 py-2.5 text-body-sm text-danger-ink outline-none animate-rise-in"
              >
                <span aria-hidden className="mt-[0.45em] size-1.5 shrink-0 bg-current" />
                {erro}
              </div>
            )}

            <Button type="submit" pending={pending} className="w-full h-11">
              {modo === "cadastro" ? (pending ? "Criando…" : "Criar conta") : pending ? "Entrando…" : "Entrar"}
            </Button>
          </fieldset>
        </form>

        {modo !== "profissional" && provedores.google && (
          <>
            <div className="my-5 flex items-center gap-3 text-caption text-muted" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <BotaoGoogle />
          </>
        )}
      </div>

      <p className="mt-7 text-center text-body-sm text-muted">
        {modo === "cadastro" ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
        <button
          type="button"
          onClick={() => setModo(modo === "cadastro" ? "email" : "cadastro")}
          className="alvo-toque font-medium text-foreground underline underline-offset-4 decoration-border-strong hover:decoration-current"
        >
          {modo === "cadastro" ? "Entrar" : "Criar conta"}
        </button>
      </p>
    </LayoutAcesso>
  );
}
