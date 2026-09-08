import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";

export default async function RootPage() {
  const current = await getCurrentCompany();

  if (!current) {
    redirect("/onboarding");
  }

  // Onboarding interrompido: a pessoa criou a empresa, saiu no meio e voltou.
  // Antes ela caía na Agenda de uma barbearia sem horário e sem forma de
  // pagamento e, se abrisse o wizard de novo, criava OUTRA empresa. Agora a
  // porta de entrada devolve para a configuração em andamento — que o wizard
  // retoma de onde parou. Só o responsável/gerente é levado para lá: quem não
  // pode concluir não é obrigado a ver a tela.
  const isManager = current.roleKey === "owner" || current.roleKey === "admin";
  if (isManager && current.company.onboarding_completed_at === null) {
    redirect("/onboarding");
  }

  redirect("/agenda");
}
