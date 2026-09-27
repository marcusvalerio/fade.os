import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicCompany } from "@/actions/public";
import { provedoresOAuth } from "@/lib/auth-provedores";
import { getSessionUser } from "@/lib/tenancy";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { FormularioDoCliente } from "./FormularioDoCliente";

export const metadata: Metadata = { title: "Entrar — área do cliente" };

/**
 * Acesso do cliente final desta barbearia: e-mail e senha ou Google. É a
 * única porta do CORTEX em que o Google aparece — a equipe entra por /login,
 * só com e-mail e senha.
 */
export default async function EntrarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; modo?: string }>;
}) {
  const [{ slug }, { erro, modo }] = await Promise.all([params, searchParams]);
  const [empresa, provedores, user] = await Promise.all([getPublicCompany(slug), provedoresOAuth(), getSessionUser()]);
  const company = empresa.ok ? empresa.data : null;

  if (!company) {
    return (
      <div className="shell py-20">
        <EmptyState
          title="Barbearia não encontrada"
          description="Verifique o endereço que você recebeu."
          action={
            <Link href="/" className={buttonClasses({ variant: "secondary" })}>
              Ir para o CORTEX.OS
            </Link>
          }
        />
      </div>
    );
  }

  if (user) redirect(`/${slug}/minha-conta`);

  return (
    <div className="shell py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-label uppercase tracking-label text-muted">{company.name}</p>
        <FormularioDoCliente
          slug={slug}
          google={provedores.google}
          modoInicial={modo === "cadastro" ? "cadastro" : "entrar"}
          erroInicial={erro === "retorno" ? "Não foi possível concluir o acesso. Tente de novo." : null}
        />
      </div>
    </div>
  );
}
