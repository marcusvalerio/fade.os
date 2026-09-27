import { empresasNoBeta, pesquisasDoAdmin, pulsoDaPlataforma, type EmpresaNoBeta } from "@/lib/admin";
import { lerErrosDoSentry, type LeituraDoSentry } from "@/lib/sentry-leitura";
import { gerarAlertas, type Alerta } from "@/lib/admin-alertas";

/**
 * Junta as fontes reais (banco + Sentry) e aplica as regras de
 * lib/admin-alertas. Só roda no servidor, dentro do /admin.
 */
export async function alertasDaPlataforma(): Promise<{
  alertas: Alerta[];
  empresas: EmpresaNoBeta[] | null;
  erros: LeituraDoSentry;
} | null> {
  const [empresas, pesquisas, pulso, erros] = await Promise.all([
    empresasNoBeta(30),
    pesquisasDoAdmin(),
    pulsoDaPlataforma("hoje"),
    lerErrosDoSentry("production"),
  ]);
  if (!empresas || !pulso) return null;
  const alertas = gerarAlertas({
    empresas,
    betaPendentes: pulso.beta_pendentes,
    pesquisas: pesquisas ?? [],
    erros: erros.estado === "ok" ? { estado: "ok", resumo: erros.resumo } : erros,
  });
  return { alertas, empresas, erros };
}
