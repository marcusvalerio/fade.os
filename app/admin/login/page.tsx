import type { Metadata } from "next";
import { getSessionUser } from "@/lib/tenancy";
import { isPlatformAdmin } from "@/lib/platform-permissions";
import { destinoDepoisDaEntrada } from "@/lib/admin-entrada";
import { EntradaDoAdmin, AvisoDaEntrada } from "../EntradaDoAdmin";
import { FormularioDoAdmin } from "./FormularioDoAdmin";
import Link from "next/link";

export const metadata: Metadata = { title: "Entrar · CORTEX ADMIN" };

/**
 * Entrada do CORTEX ADMIN. Estados:
 *   - ?acesso=negado → a conta atual não administra a plataforma;
 *   - ?saiu=1        → saiu do Admin;
 *   - ?proximo=/admin/... → volta para onde a pessoa ia (só rotas do Admin);
 *   - já é admin     → atalho para continuar, sem digitar a senha de novo.
 *
 * PENDENTE — REQUER ACESSO AO SUPABASE: com a sessão administrativa própria
 * (platform_admin_sessao), estar logado no app como dono deixa de valer como
 * estar no Admin — a pessoa confirma a senha aqui e abre a sessão do Admin
 * sem sair do CORTEX.OS.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ acesso?: string; saiu?: string; proximo?: string }>;
}) {
  const { acesso, saiu, proximo } = await searchParams;
  const user = await getSessionUser();
  const jaAdmin = user ? await isPlatformAdmin() : false;
  const destino = destinoDepoisDaEntrada(proximo);

  return (
    <EntradaDoAdmin
      titulo="CORTEX ADMIN"
      descricao="Entre com a sua conta de administrador da plataforma para gerenciar empresas, acessos, usuários e auditoria."
      rodape="Esta entrada é exclusiva da administração da plataforma. Ser proprietário, gerente ou profissional de uma barbearia não concede acesso ao Admin."
    >
      {saiu === "1" && !user && <AvisoDaEntrada tom="sucesso">Você saiu do Admin.</AvisoDaEntrada>}

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
          {user && (
            <AvisoDaEntrada tom={acesso === "negado" ? "erro" : "info"}>
              {acesso === "negado" ? "Acesso negado. " : ""}
              Você está conectado ao CORTEX.OS como <strong className="text-white">{user.email}</strong>, e esta conta não
              administra a plataforma. Entrar abaixo com a conta de administrador encerra a sessão atual neste navegador.
            </AvisoDaEntrada>
          )}
          <FormularioDoAdmin proximo={proximo && destino !== "/admin" ? destino : null} />
        </>
      )}
    </EntradaDoAdmin>
  );
}
