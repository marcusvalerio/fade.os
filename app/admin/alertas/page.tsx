import { alertasDaPlataforma } from "@/lib/admin-alertas-dados";
import { LIMITES, ORDEM_DOS_NIVEIS, ROTULO_DO_NIVEL } from "@/lib/admin-alertas";
import { ListaDeAlertas, MARCA_DO_NIVEL } from "../ListaDeAlertas";
import { cn } from "@/lib/cn";

/**
 * Alertas — o que pede ação agora, calculado ao abrir a página a partir do
 * banco e do Sentry, com regras fixas e visíveis (abaixo). Nada é previsto
 * nem inferido por modelo.
 */
export default async function AdminAlertasPage() {
  const dados = await alertasDaPlataforma();
  if (!dados) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível calcular os alertas agora.</p>
      </div>
    );
  }
  const { alertas } = dados;
  const porNivel = ORDEM_DOS_NIVEIS.map((n) => [n, alertas.filter((a) => a.nivel === n).length] as const);

  return (
    <div className="space-y-6">
      <header className="animate-rise-in max-w-2xl">
        <p className="eyebrow">Plataforma</p>
        <h1 className="text-page-title text-foreground mt-2.5">Alertas</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">Calculados agora, com as regras abaixo, sobre o banco e o Sentry. Uma barbearia gera no máximo um alerta.</p>
      </header>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-md overflow-hidden">
        {porNivel.map(([nivel, qtd]) => (
          <div key={nivel} className="bg-surface p-4">
            <dt className="flex items-center gap-2 font-subtitle text-caption text-muted">
              <span aria-hidden className={cn("size-2", MARCA_DO_NIVEL[nivel])} />
              {ROTULO_DO_NIVEL[nivel]}
            </dt>
            <dd className="numero text-metric-sm text-foreground mt-2">{qtd}</dd>
          </div>
        ))}
      </dl>

      <section className="painel overflow-hidden" aria-labelledby="lista">
        <h2 id="lista" className="sr-only">
          Alertas
        </h2>
        {alertas.length === 0 ? (
          <p className="p-5 text-body-sm text-muted">Nada pedindo ação. Barbearias operando, nenhum pedido esperando e nenhum erro novo.</p>
        ) : (
          <ListaDeAlertas alertas={alertas} />
        )}
      </section>

      <section className="painel p-5" aria-labelledby="regras">
        <h2 id="regras" className="text-section-title text-foreground">Regras</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-caption text-muted md:grid-cols-2">
          <li><span className="text-foreground">Crítico</span> · erro que apareceu pela primeira vez em produção nas últimas 24 h.</li>
          <li><span className="text-foreground">Importante</span> · pedido de beta esperando; barbearia sem operação há mais de 14 dias; configuração concluída sem nenhuma operação há {LIMITES.diasParaConfiguracaoTravada}+ dias.</li>
          <li><span className="text-foreground">Atenção</span> · última operação entre 7 e 14 dias; configuração inicial parada há {LIMITES.diasParaConfiguracaoTravada}+ dias; ninguém da equipe entra há {LIMITES.diasSemAcesso}+ dias; erro se repetindo.</li>
          <li><span className="text-foreground">Informativo</span> · beta termina em até {LIMITES.diasParaExpirar} dias; pesquisa com {LIMITES.exibicoesMinimasDaPesquisa}+ exibições e menos de {LIMITES.taxaBaixaDaPesquisa * 100}% de resposta; leitura de erros não conectada.</li>
        </ul>
      </section>
    </div>
  );
}
