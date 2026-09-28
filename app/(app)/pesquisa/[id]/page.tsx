import type { Metadata } from "next";
import { getCurrentCompany } from "@/lib/current-company";
import { buscarPesquisaParaResponder } from "@/actions/pesquisas";
import { PesquisaNaPagina } from "@/components/pesquisa-na-pagina";
import { Vazio } from "@/components/ui/estado";

export const metadata: Metadata = { title: "Pesquisa" };

/**
 * Pesquisa aberta pela notificação (equipe). O público é conferido no banco
 * pelo papel real nesta barbearia: quem não é do público vê "indisponível",
 * nunca a pergunta.
 */
export default async function PesquisaDaEquipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentCompany();
  const pesquisa = await buscarPesquisaParaResponder(id, "equipe", current!.company.id);
  return (
    <div className="max-w-xl">
      {pesquisa ? (
        <PesquisaNaPagina pesquisa={pesquisa} area="equipe" empresaId={current!.company.id} voltarPara="/dashboard" />
      ) : (
        <Vazio titulo="Pesquisa indisponível" descricao="Esta pesquisa não está disponível para o seu acesso nesta barbearia." />
      )}
    </div>
  );
}
