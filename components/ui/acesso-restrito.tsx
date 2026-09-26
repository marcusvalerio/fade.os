import Link from "next/link";
import { Vazio } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";

/**
 * Quem cai numa área de gestão sem ser responsável ou gerente (recepção,
 * barbeiro — normalmente por um link antigo ou digitando o endereço). Não
 * basta dizer "não pode": diz de quem é a área e leva para onde está o
 * trabalho dessa pessoa, a Agenda. A barreira real continua no servidor e no
 * banco; isto é só a tela.
 */
export function AcessoRestrito() {
  return (
    <Vazio
      titulo="Esta área é da gestão"
      descricao="Números, catálogo e equipe ficam com o responsável e os gerentes da barbearia. O seu dia começa na Agenda."
      acao={
        <Link href="/agenda" className={buttonClasses({ variant: "secondary" })}>
          Ir para a Agenda
        </Link>
      }
    />
  );
}
