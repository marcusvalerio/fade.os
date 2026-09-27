import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar — CORTEX.OS",
};

/**
 * Login da operação — dono, gerência, recepção e profissional. Só e-mail e
 * senha (ou identificador + senha). O Google é do cliente final da barbearia
 * e mora no acesso do cliente (/[slug]/entrar), nunca aqui: a conta de quem
 * administra a barbearia não nasce de um clique social.
 *
 * `?error=access_disabled` vem do middleware quando o acesso de um
 * profissional foi desativado pela barbearia — a pessoa precisa saber por que
 * voltou para cá.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const aviso =
    error === "access_disabled" ? "Seu acesso foi desativado pela barbearia. Fale com o responsável." : null;
  return <LoginForm aviso={aviso} />;
}
