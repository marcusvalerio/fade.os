import Link from "next/link";
import { MODULOS_DA_MATRIZ, type LinhaDaMatriz, type AtividadeDaEmpresa, haQuanto } from "@/lib/admin";
import { cn } from "@/lib/cn";

// Escala sequencial de uma cor só (magnitude), em faixas absolutas: com
// poucas barbearias, normalizar por coluna exageraria diferenças pequenas.
const FAIXAS = [
  { ate: 0, classe: "", rotulo: "nenhum" },
  { ate: 2, classe: "bg-primary/15 text-foreground", rotulo: "1–2" },
  { ate: 9, classe: "bg-primary/35 text-foreground", rotulo: "3–9" },
  { ate: Infinity, classe: "bg-primary/75 text-primary-foreground", rotulo: "10+" },
];
const faixa = (n: number) => FAIXAS.find((f) => n <= f.ate)!;

const CURTO: Record<string, string> = {
  Agenda: "Agenda",
  Reagendamento: "Reagend.",
  Atendimento: "Atend.",
  "Nova venda (balcão)": "Venda",
  Caixa: "Caixa",
  "Estoque (manual)": "Estoque",
  "Financeiro (manual)": "Financ.",
  "Comissões pagas": "Comissão",
  "Clientes cadastrados": "Clientes",
  "Conta do cliente": "Conta cli.",
  Avaliações: "Avaliação",
};

/**
 * Quem usa o quê: cada linha é uma barbearia (na ordem em que entrou —
 * não é ranking), cada coluna um módulo, a célula é quantos registros no
 * período. O vazio é informação: módulo que ninguém toca, barbearia que
 * só usa agenda.
 */
export function MatrizDeUso({ linhas, empresas, dias }: { linhas: LinhaDaMatriz[]; empresas: AtividadeDaEmpresa[]; dias: number }) {
  const porId = new Map(empresas.map((e) => [e.id, e]));
  const semUso = linhas.filter((l) => Object.keys(l.uso).length === 0);
  const comUso = linhas.filter((l) => Object.keys(l.uso).length > 0);
  const naoUsados = MODULOS_DA_MATRIZ.filter((m) => !linhas.some((l) => (l.uso[m] ?? 0) > 0));

  return (
    <div className="grid gap-6 xl:grid-cols-12 items-start">
      <section className="painel overflow-hidden xl:col-span-8 min-w-0" aria-labelledby="matriz">
        <header className="px-5 pt-5 pb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="matriz" className="text-section-title text-foreground">Módulo × barbearia</h2>
            <p className="text-caption text-muted mt-1">Registros criados em cada módulo nos últimos {dias} dias. Barbearias na ordem de entrada.</p>
          </div>
          <ul className="flex items-center gap-3 text-micro text-muted" aria-label="Legenda">
            {FAIXAS.map((f) => (
              <li key={f.rotulo} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-3 border border-border", f.classe)} />
                {f.rotulo}
              </li>
            ))}
          </ul>
        </header>
        {comUso.length === 0 ? (
          <p className="px-5 pb-5 text-body-sm text-muted">Nenhuma barbearia registrou nada no período.</p>
        ) : (
          <div className="overflow-x-auto border-t border-border" tabIndex={0} aria-label="Tabela de uso por módulo; role para os lados">
            <table className="w-full min-w-[46rem] text-caption border-collapse">
              <thead>
                <tr className="text-micro font-subtitle text-muted">
                  <th scope="col" className="sticky left-0 z-[1] bg-surface text-left font-normal px-5 py-2 min-w-[11rem]">
                    Barbearia
                  </th>
                  {MODULOS_DA_MATRIZ.map((m) => (
                    <th key={m} scope="col" title={m} className="font-normal px-1 py-2 text-center whitespace-nowrap">
                      {CURTO[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comUso.map((l) => (
                  <tr key={l.company_id} className="border-t border-border">
                    <th scope="row" className="sticky left-0 z-[1] bg-surface text-left font-normal px-5 py-1.5 max-w-[14rem]">
                      <Link href={`/admin/empresas/${l.company_id}`} className="block truncate text-body-sm text-foreground hover:underline underline-offset-4">
                        {l.name}
                      </Link>
                    </th>
                    {MODULOS_DA_MATRIZ.map((m) => {
                      const n = l.uso[m] ?? 0;
                      const f = faixa(n);
                      return (
                        <td key={m} className="p-0.5">
                          <span
                            className={cn("grid h-8 place-items-center mono", n === 0 ? "text-muted/60" : f.classe)}
                            aria-label={`${l.name}, ${m}: ${n}`}
                            title={`${m}: ${n}`}
                          >
                            {n === 0 ? "·" : n}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {naoUsados.length > 0 && (
          <p className="px-5 py-3 border-t border-border text-caption text-muted">
            Nenhuma barbearia usou no período: <span className="text-foreground">{naoUsados.join(", ")}</span>.
          </p>
        )}
      </section>

      <section className="painel p-5 xl:col-span-4" aria-labelledby="sem-uso">
        <h2 id="sem-uso" className="text-section-title text-foreground">Não registraram nada</h2>
        <p className="text-caption text-muted mt-1">Em {dias} dias, em nenhum módulo.</p>
        {semUso.length === 0 ? (
          <p className="text-body-sm text-muted mt-3">Todas as barbearias usaram pelo menos um módulo.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {semUso.map((l) => {
              const e = porId.get(l.company_id);
              const motivo =
                l.status === "suspended"
                  ? "suspensa"
                  : !l.onboarding_completed
                    ? `em configuração · entrou ${haQuanto(l.criada_em)}`
                    : e?.ultima_atividade
                      ? `última operação ${haQuanto(e.ultima_atividade)}`
                      : "configurou e nunca operou";
              return (
                <li key={l.company_id} className="py-2.5">
                  <Link href={`/admin/empresas/${l.company_id}`} className="block truncate text-body-sm text-foreground hover:underline underline-offset-4">
                    {l.name}
                  </Link>
                  <span className="block text-caption text-muted">{motivo}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
