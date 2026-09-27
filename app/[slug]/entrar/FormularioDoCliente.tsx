"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { entrarComoCliente, criarContaDeCliente, prepararEntradaGoogle, type ClienteAuthState } from "@/actions/cliente";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { cn } from "@/lib/cn";

const inicial: ClienteAuthState = { error: null };

export function FormularioDoCliente({
  slug,
  google,
  modoInicial,
  erroInicial,
}: {
  slug: string;
  google: boolean;
  modoInicial: "entrar" | "cadastro";
  erroInicial: string | null;
}) {
  const [modo, setModo] = useState(modoInicial);
  const [entrarState, entrarAction, entrando] = useActionState(entrarComoCliente.bind(null, slug), inicial);
  const [cadastroState, cadastroAction, cadastrando] = useActionState(criarContaDeCliente.bind(null, slug), inicial);
  const [googleErro, setGoogleErro] = useState<string | null>(null);
  const [googlePendente, setGooglePendente] = useState(false);
  // O React 19 limpa o formulário depois da action: o e-mail fica em estado
  // para não sumir quando a senha estiver errada.
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const state = modo === "entrar" ? entrarState : cadastroState;
  const pendente = modo === "entrar" ? entrando : cadastrando;
  const erro = state.error ?? googleErro ?? erroInicial;

  async function entrarComGoogle() {
    setGoogleErro(null);
    setGooglePendente(true);
    const preparo = await prepararEntradaGoogle(slug);
    let falhou = !preparo.ok;
    if (!falhou) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { error } = await createClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/oauth-callback` },
        });
        falhou = Boolean(error);
      } catch {
        falhou = true;
      }
    }
    if (falhou) {
      setGooglePendente(false);
      setGoogleErro("Não foi possível abrir o login com o Google. Tente de novo ou use e-mail e senha.");
    }
  }

  if (cadastroState.enviadoPara && modo === "cadastro") {
    return (
      <div className="mt-2" role="status">
        <h1 className="text-page-title font-heading text-foreground">Confirme o seu e-mail</h1>
        <p className="text-body-sm text-muted mt-2">
          Enviamos um link para <strong className="text-foreground">{cadastroState.enviadoPara}</strong>. Abra o link
          para ativar a conta — ele traz você de volta para cá.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-page-title font-heading text-foreground mt-2">
        {modo === "entrar" ? "Seus horários" : "Criar conta"}
      </h1>
      <p className="text-body-sm text-muted mt-1.5">
        {modo === "entrar"
          ? "Entre para ver, remarcar ou cancelar os seus horários."
          : "Com a conta, seus horários ficam num lugar só — sem precisar do link de cada agendamento."}
      </p>

      {erro && (
        <div className="mt-5">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      )}

      <form action={modo === "entrar" ? entrarAction : cadastroAction} className="mt-6 space-y-4">
        <fieldset disabled={pendente || googlePendente} className={cn("space-y-4", pendente && "opacity-60")}>
          {modo === "cadastro" && (
            <>
              <Field name="name" label="Seu nome">
                <Input id="name" name="name" autoComplete="name" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </Field>
              <Field name="phone" label="Telefone / WhatsApp" helper="Com DDD. Opcional.">
                <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </Field>
            </>
          )}
          <Field name="email" label="E-mail">
            <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field
            name="password"
            label="Senha"
            helper={modo === "cadastro" ? "Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial" : undefined}
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              required
            />
          </Field>
          <Button type="submit" pending={pendente} className="w-full h-11">
            {modo === "entrar" ? (pendente ? "Entrando…" : "Entrar") : pendente ? "Criando…" : "Criar conta"}
          </Button>
        </fieldset>
      </form>

      {modo === "entrar" && (
        <p className="mt-3 text-right">
          <Link href="/esqueci-senha" className="alvo-toque text-body-sm text-muted hover:text-foreground">
            Esqueceu a senha?
          </Link>
        </p>
      )}

      {google && (
        <>
          <div className="my-5 flex items-center gap-3 text-caption text-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={entrarComGoogle}
            disabled={googlePendente || pendente}
            className="alvo-toque h-11 w-full inline-flex items-center justify-center gap-2.5 rounded-sm border border-border-strong bg-surface text-button text-foreground transition-[opacity,background-color] duration-fast ease-standard hover:bg-surface-muted disabled:opacity-60"
          >
            {googlePendente ? <span aria-hidden className="sinal-carregando" /> : <IconeGoogle />}
            Continuar com o Google
          </button>
        </>
      )}

      <p className="mt-7 text-center text-body-sm text-muted">
        {modo === "entrar" ? "Primeira vez por aqui?" : "Já tem conta?"}{" "}
        <button
          type="button"
          onClick={() => setModo(modo === "entrar" ? "cadastro" : "entrar")}
          className="alvo-toque font-medium text-foreground underline underline-offset-4 decoration-border-strong hover:decoration-current"
        >
          {modo === "entrar" ? "Criar conta" : "Entrar"}
        </button>
      </p>
      <p className="mt-3 text-center text-caption text-muted">
        Não precisa de conta para marcar:{" "}
        <Link href={`/${slug}/agendar`} className="underline underline-offset-4">
          agendar sem entrar
        </Link>
        .
      </p>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.89c2.27-2.09 3.56-5.17 3.56-8.83Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3c-1.08.73-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.31A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.58.38-2.31v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.41l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.59l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}
