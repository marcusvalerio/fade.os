import Link from "next/link";
import { atividadeDasEmpresas, haQuanto } from "@/lib/admin";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

const DIAS = 30;

const FILTROS = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "movimento", rotulo: "Com movimento" },
  { chave: "paradas", rotulo: "Sem movimento" },
  { chave: "configuracao", rotulo: "Em configuração" },
  { chave: "suspensas", rotulo: "Suspensas" },
] as const;

/**
 * Empresas — cada linha diz o tamanho da barbearia e se ela está usando o
 * CORTEX: movimento nos últimos 30 dias, receita, módulos em uso e a última
 * atividade. A ação destrutiva (suspender) continua só no detalhe.
 */
export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; q?: string }>;
}) {
  const { filtro = "todas", q = "" } = await searchParams;
  const todas = await atividadeDasEmpresas(DIAS);

  if (!todas) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar as empresas.</p>
      </div>
    );
  }

  const busca = q.trim().toLowerCase();
  const movimento = (e: (typeof todas)[number]) => e.agendamentos_periodo + e.atendimentos_periodo > 0 || e.receita_periodo > 0;
  const lista = todas
    .filter((e) => {
      if (filtro === "movimento") return e.status === "active" && movimento(e);
      if (filtro === "paradas") return e.status === "active" && !movimento(e);
      if (filtro === "configuracao") return !e.onboarding_completed;
      if (filtro === "suspensas") return e.status === "suspended";
      return true;
    })
    .filter((e) => !busca || e.name.toLowerCase().includes(busca) || e.slug.includes(busca));

  const contagem = (chave: string) =>
    chave === "todas"
      ? todas.length
      : chave === "movimento"
        ? todas.filter((e) => e.status === "active" && movimento(e)).length
        : chave === "paradas"
          ? todas.filter((e) => e.status === "active" && !movimento(e)).length
          : chave === "configuracao"
            ? todas.filter((e) => !e.onboarding_completed).length
            : todas.filter((e) => e.status === "suspended").length;

  return (
    <div className="space-y-6">
      <header className="animate-rise-in">
        <p className="eyebrow">Barbearias</p>
        <h1 className="text-page-title text-foreground mt-2.5">Empresas.</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          {todas.length} cadastradas · movimento contado nos últimos {DIAS} dias.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrar empresas" className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <Link
              key={f.chave}
              href={`/admin/empresas?filtro=${f.chave}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={filtro === f.chave ? "page" : undefined}
              className={cn(
                "rounded-sm px-2.5 py-1.5 text-caption transition-colors duration-micro",
                filtro === f.chave ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground hover:bg-surface"
              )}
            >
              {f.rotulo} <span className="mono opacity-70">{contagem(f.chave)}</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          <input type="hidden" name="filtro" value={filtro} />
          <label htmlFor="busca-empresa" className="sr-only">
            Buscar empresa
          </label>
          <input
            id="busca-empresa"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou endereço da página"
            className="h-9 w-64 max-w-full rounded-sm border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted"
          />
        </form>
      </div>

      {lista.length === 0 ? (
        <div className="painel p-8 text-center">
          <p className="text-body-sm text-foreground font-medium">Nenhuma empresa neste filtro.</p>
          <p className="text-caption text-muted mt-1">
            {filtro === "suspensas" ? "Nenhuma barbearia suspensa." : "Tente outro filtro ou limpe a busca."}
          </p>
        </div>
      ) : (
        <div className="painel overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))] gap-3 px-5 py-2.5 border-b border-border text-micro font-subtitle text-muted">
            <span>Empresa</span>
            <span className="text-right">Equipe · clientes</span>
            <span className="text-right">Agend. {DIAS}d</span>
            <span className="text-right">Receita {DIAS}d</span>
            <span className="text-right">Módulos</span>
            <span className="text-right">Última atividade</span>
          </div>
          <ul className="divide-y divide-border">
            {lista.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/admin/empresas/${e.id}`}
                  className="grid grid-cols-2 md:grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))] gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted/60 transition-colors duration-micro"
                >
                  <span className="col-span-2 md:col-span-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0",
                          e.status === "suspended" ? "bg-danger" : !e.onboarding_completed ? "border border-border-strong" : movimento(e) ? "bg-success" : "bg-warning"
                        )}
                      />
                      <span className="text-body-sm font-medium text-foreground truncate">{e.name}</span>
                    </span>
                    <span className="block text-micro text-muted mono truncate mt-0.5 pl-3.5">
                      /{e.slug} · {e.status === "suspended" ? "suspensa" : e.onboarding_completed ? "operacional" : "em configuração"}
                    </span>
                  </span>
                  <Celula rotulo="Equipe · clientes" valor={`${e.usuarios} · ${e.clientes}`} />
                  <Celula rotulo={`Agend. ${DIAS}d`} valor={String(e.agendamentos_periodo)} />
                  <Celula rotulo={`Receita ${DIAS}d`} valor={formatCurrency(e.receita_periodo)} destaque={e.receita_periodo > 0} />
                  <Celula rotulo="Módulos" valor={`${e.modulos_usados}/7`} />
                  <Celula rotulo="Última atividade" valor={haQuanto(e.ultima_atividade)} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Celula({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <span className="flex md:block justify-between gap-2 md:text-right min-w-0">
      <span className="md:hidden text-micro text-muted">{rotulo}</span>
      <span className={cn("mono text-caption truncate", destaque ? "text-foreground" : "text-muted")}>{valor}</span>
    </span>
  );
}
