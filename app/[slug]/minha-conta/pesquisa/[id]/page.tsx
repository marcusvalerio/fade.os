import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/tenancy";
import { getPublicCompany } from "@/actions/public";
import { buscarPesquisaParaResponder } from "@/actions/pesquisas";
import { PesquisaNaPagina } from "@/components/pesquisa-na-pagina";
import { Vazio } from "@/components/ui/estado";

export const metadata: Metadata = { title: "Pesquisa" };
export const dynamic = "force-dynamic";

/** Pesquisa aberta pela notificação (cliente com conta nesta barbearia). */
export default async function PesquisaDoClientePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!(await getSessionUser())) redirect(`/${slug}/entrar`);
  const barbearia = await getPublicCompany(slug);
  const empresaId = barbearia.ok ? barbearia.data?.company_id : undefined;
  const pesquisa = empresaId ? await buscarPesquisaParaResponder(id, "cliente", empresaId) : null;
  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-xl">
        {pesquisa && empresaId ? (
          <PesquisaNaPagina pesquisa={pesquisa} area="cliente" empresaId={empresaId} voltarPara={`/${slug}/minha-conta`} />
        ) : (
          <Vazio titulo="Pesquisa indisponível" descricao="Esta pesquisa não está disponível para a sua conta nesta barbearia." />
        )}
      </div>
    </div>
  );
}
