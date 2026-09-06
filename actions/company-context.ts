"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/current-company";

/**
 * Troca a empresa ativa — só grava o cookie depois de confirmar que o
 * usuário realmente tem vínculo com essa empresa (nunca confia num id
 * vindo do formulário sem checar). É a única forma legítima de mudar de
 * contexto; getCurrentCompany() nunca decide isso sozinho.
 */
export async function setActiveCompany(companyId: string) {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_company_role")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) {
    throw new Error("Você não tem acesso a essa empresa.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/agenda");
}
