import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { getSessionUser } from "@/lib/tenancy";
import { Landing } from "./_landing/Landing";

export const metadata: Metadata = {
  title: "CORTEX.OS — Sistema operacional para barbearias",
  description:
    "Do horário marcado ao caixa fechado: agenda, atendimento, clientes, equipe, vendas e caixa da barbearia no mesmo registro.",
  openGraph: {
    title: "CORTEX.OS — Do horário marcado ao caixa fechado.",
    description:
      "O sistema operacional da barbearia. O horário que o cliente marca vira atendimento, o atendimento vira venda, e a venda fecha o caixa.",
    type: "website",
    locale: "pt_BR",
  },
};

/**
 * P1.5 — "/" deixou de ser sempre o redirecionador do app operacional:
 * agora é a landing pública do CORTEX.OS para quem não tem sessão. Quem já
 * está logado continua caindo exatamente onde caía antes (onboarding
 * pendente ou agenda) — nada muda para conta existente.
 */
export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) {
    return <Landing />;
  }

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
