import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";

export default async function RootPage() {
  const current = await getCurrentCompany();

  if (!current) {
    redirect("/onboarding");
  }

  redirect("/agenda");
}
