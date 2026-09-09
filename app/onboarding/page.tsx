import { redirect } from "next/navigation";
import { getOnboardingAccess } from "@/actions/onboarding";
import OnboardingWizard from "./OnboardingWizard";

// O wizard não pode ser servido estaticamente: quem pode vê-lo depende de
// quem está pedindo.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const access = await getOnboardingAccess();
  if (!access.allowed) redirect(access.redirectTo);

  return <OnboardingWizard />;
}
