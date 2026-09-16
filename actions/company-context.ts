"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { ACTIVE_COMPANY_COOKIE, ACTIVE_UNIT_COOKIE } from "@/lib/current-company";

export async function setActiveCompany(companyId: string) {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_company_role")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) throw new Error("Você não tem acesso a essa empresa.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.delete(ACTIVE_UNIT_COOKIE);
  redirect("/agenda");
}

export async function setActiveUnit(unitId: string) {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("unit")
    .select("id, company_id, status")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit || unit.status !== "active") throw new Error("Unidade não encontrada ou inativa.");

  const { data: link } = await supabase
    .from("user_company_role")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("company_id", unit.company_id)
    .maybeSingle();

  if (!link) throw new Error("Você não tem acesso a essa unidade.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, unit.company_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.set(ACTIVE_UNIT_COOKIE, unit.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/agenda");
}
