"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { getOwnProfessionalId } from "@/lib/permissions";
import { getCurrentCompany } from "@/lib/current-company";
import { ACTIVE_MODE_COOKIE, type ActiveMode } from "@/lib/active-mode";

/**
 * Troca só a preferência de navegação ("modo"), nunca autorização. Ainda
 * assim confere que o contexto pedido existe de verdade para esta conta
 * nesta empresa — sem isso, alguém poderia forjar a chamada e ver o menu
 * de "Atendimento" sem nunca ter sido vinculado como profissional (o menu
 * não protegeria nada por si só, mas não faz sentido oferecer um modo que
 * não corresponde a nenhum contexto real da conta).
 */
export async function setActiveMode(mode: ActiveMode): Promise<never> {
  const current = await getCurrentCompany();
  if (!current) redirect("/onboarding");

  const user = await requireAuthenticatedUser();
  const isManager = current.roleKey === "owner" || current.roleKey === "admin";
  const ownProfessionalId = await getOwnProfessionalId(current.company.id, user.id);

  const modeIsValid =
    (mode === "admin" && isManager) || (mode === "atendimento" && !!ownProfessionalId);

  const cookieStore = await cookies();
  if (modeIsValid) {
    cookieStore.set(ACTIVE_MODE_COOKIE, mode, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/");
}
