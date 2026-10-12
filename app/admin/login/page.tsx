import type { Metadata } from "next";
import { getSessionUser } from "@/lib/tenancy";
import { ehPlatformAdmin, isPlatformAdmin } from "@/lib/platform-permissions";
import { destinoDepoisDaEntrada } from "@/lib/admin-entrada";
import { EntradaDoAdmin, AvisoDaEntrada } from "../EntradaDoAdmin";
import { FormularioDoAdmin } from "./FormularioDoAdmin";
import Link from "next/link";

export const metadata: Metadata = { title: "Entrar · CORTEX ADMIN" };

/**
 * Entrada do CORTEX ADMIN — a única porta da sessão administrativa
 * (platform_admin_sessao, 8 h). Estados:
 *   - sessão do Admin já aberta → atalho para continuar;
 *   - admin logado no CORTEX.OS, sem sessão do Admin (?sessao=entrar) →
 *     confirma a senha; o CORTEX.OS continua logado;
 *   - conta que não administra a plataforma (?acesso=negado);
 *   - ?saiu=1 (&app=1 quando o CORTEX.OS continua logado);
 *   - ?proximo=/admin/... → volta para onde ia (só rotas do Admin).
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ acesso?: string; saiu?: string; app?: string; proximo?: string; sessao?: string }>;
}) {
  const { acesso, saiu, app, proximo } = await searchParams;
  const user = await getSessionUser();
  const jaAdmin = user ? await isPlatformAdmin() : false;
  const ehAdmin = user && !jaAdmin ? await ehPlatformAdmin() : false;
  const destino = destinoDepoisDaEntrada(proximo);

  return (
    <EntradaDoAdmin
      titulo="CORTEX ADMIN"
      descricao="Entre com a sua conta de administrador da plataforma para gerenciar empresas, acessos, usuários e auditoria."
      rodape="Esta entrada é exclusiva da administração da plataforma. Ser proprietário, gerente ou profissional de uma barbearia não concede acesso ao Admin."
    >
      {saiu === "1" && (
        <AvisoDaEntrada tom="sucesso">
          Você saiu do Admin.{app === "1" && user ? " Continua conectado ao CORTEX.OS." : ""}
        </AvisoDaEntrada>
      )}

      {user && jaAdmin ? (
        <div className="space-y-4">
          <AvisoDaEntrada tom="info">
            Você já está conectado como <strong className="text-white">{user.email}</strong>, com acesso ao Admin.
          </AvisoDaEntrada>
          <Link
            href={destino}
            className="min-h-11 w-full inline-flex items-center justify-center rounded-sm bg-primary text-primary-foreground text-button font-medium hover:opacity-90 transition-opacity duration-fast ease-standard"
          >
            Continuar para o Admin
          </Link>
        </div>
      ) : (
        <>
          {user && ehAdmin && saiu !== "1" && (
            <AvisoDaEntrada tom="info">
              Você está conectado ao CORTEX.OS como <strong className="text-white">{user.email}</strong>. Para abrir o Admin,
              confirme a senha — a sessão do Admin dura 8 horas e sair dela não tira você do CORTEX.OS.
            </AvisoDaEntrada>
          )}
          {user && !ehAdmin && (
            <AvisoDaEntrada tom={acesso === "negado" ? "erro" : "info"}>
              {acesso === "negado" ? "Acesso negado. " : ""}
              Você está conectado ao CORTEX.OS como <strong className="text-white">{user.email}</strong>, e esta conta não
              administra a plataforma. Entrar abaixo com a conta de administrador encerra a sessão atual neste navegador.
            </AvisoDaEntrada>
          )}
          <FormularioDoAdmin proximo={proximo && destino !== "/admin" ? destino : null} emailPadrao={ehAdmin ? (user?.email ?? undefined) : undefined} />
        </>
      )}
    </EntradaDoAdmin>
  );
}
