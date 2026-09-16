import { cache } from "react";
import { cookies } from "next/headers";
import { getUserCompanyLinks } from "@/lib/tenancy";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_COMPANY_COOKIE = "cortex_active_company";
export const ACTIVE_UNIT_COOKIE = "cortex_active_unit";

export const getCurrentCompany = cache(async () => {
  const links = await getUserCompanyLinks();
  if (links.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active =
    (activeId && links.find((l) => l.company_id === activeId)) || links[links.length - 1];

  const supabase = await createClient();
  const { data: units } = await supabase
    .from("unit")
    .select("id, name, address, status")
    .eq("company_id", active.company.id)
    .order("created_at");

  const availableUnits = (units ?? []).filter((unit) => unit.status === "active");
  const activeUnitId = cookieStore.get(ACTIVE_UNIT_COOKIE)?.value;
  const activeUnit =
    (activeUnitId && availableUnits.find((unit) => unit.id === activeUnitId)) ||
    availableUnits[availableUnits.length - 1] ||
    null;

  return {
    company: active.company,
    roleKey: active.role_key,
    availableCompanies: links.map((l) => ({ id: l.company_id, name: l.company.name })),
    availableUnits,
    unit: activeUnit,
  };
});
