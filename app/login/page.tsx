import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { MedicaoDeAquisicao } from "@/components/aquisicao/medicao";

export const metadata: Metadata = {
  title: "Entrar — CORTEX.OS",
};

/**
 * Login da operação — dono, gerência, recepção e profissional. Só e-mail e
 * senha (ou identificador + senha). O Google é do cliente final da barbearia
 * e mora no acesso do cliente (/[slug]/entrar), nunca aqui: a conta de quem
 * administra a barbearia não nasce de um clique social.
 *
 * O middleware manda de volta para cá com um motivo — a pessoa precisa saber
 * por que voltou: `?error=access_disabled` quando o acesso de um profissional
 * foi desativado; `?error=metodo` quando uma sessão aberta pelo Google (na
 * área do cliente) tentou entrar na gestão.
 */
const AVISOS: Record<string, string> = {
  access_disabled: "Seu acesso foi desativado pela barbearia. Fale com o responsável.",
  metodo: "A gestão da barbearia entra só com e-mail e senha. O acesso pelo Google é da área do cliente.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const aviso = (error && AVISOS[error]) || null;
  return (
    <>
      <LoginForm aviso={aviso} />
      <MedicaoDeAquisicao />
    </>
  );
}
