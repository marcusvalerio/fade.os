import type { Metadata } from "next";
import Link from "next/link";
import { pilotosDoAdmin, empresasNoBeta, haQuanto } from "@/lib/admin";
import { diaDoPiloto, rotuloDoDia, type StatusDoPiloto } from "@/lib/piloto";
import { formatCurrency } from "@/lib/format";
import { NovoPiloto } from "./NovoPiloto";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Pilotos" };

const STATUS: Record<StatusDoPiloto, { rotulo: string; marca: string }> = {
  planejado: { rotulo: "Planejado", marca: "border border-border-strong" },
  ativo: { rotulo: "Em andamento", marca: "bg-primary" },
  encerrado: { rotulo: "Encerrado", marca: "bg-border-strong" },
  cancelado: { rotulo: "Cancelado", marca: "bg-border-strong" },
};

const dataCurta = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

/**
 * Pilotos — acompanhamento interno de uso por N dias. Um retrato por dia,
 * gravado automaticamente a partir dos dados reais; a barbearia não vê
 * nada disto. Queda de uso aparece aqui, nunca como notificação.
 */
export default async function PilotosPage() {
  const [pilotos, empresas] = await Promise.all([pilotosDoAdmin(), empresasNoBeta(30)]);
  if (!pilotos) {
    return (
      <div className="painel p-6">
        <p className="text-body-sm text-foreground font-medium">Não foi possível carregar os pilotos.</p>
      </div>
    );
  }
  const hoje = pilotos[0]?.hoje ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const abertos = new Set(pilotos.filter((p) => p.status === "planejado" || p.status === "ativo").map((p) => p.company_id));
  const elegiveis = (empresas ?? []).filter((e) => e.status === "active" && !abertos.has(e.id)).map((e) => ({ id: e.id, name: e.name }));

  return (
    <div className="space-y-6">
      <header className="animate-rise-in max-w-3xl">
        <p className="eyebrow">Beta e produto</p>
        <h1 className="text-page-title text-foreground mt-2.5">Pilotos</h1>
        <p className="font-subtitle text-subtitle text-muted mt-2.5">
          Um retrato por dia do uso real de uma barbearia, comparado com o Dia 0 (véspera do início). A coleta só lê a operação — nada muda para a barbearia.
        </p>
      </header>

      <NovoPiloto empresas={elegiveis} hoje={hoje} />

      {pilotos.length === 0 ? (
        <div className="painel p-6">
          <p className="text-body-sm text-muted">Nenhum piloto ainda.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pilotos.map((p) => {
            const d = diaDoPiloto(p.inicio, p.fim, p.hoje);
            const s = STATUS[p.status];
            return (
              <li key={p.id}>
                <Link href={`/admin/pilotos/${p.id}`} className="painel block p-5 hover:bg-surface-muted transition-colors duration-fast ease-standard">
                  <p className="flex items-center gap-2 text-caption text-muted">
                    <span aria-hidden className={cn("size-2 shrink-0", s.marca)} />
                    {s.rotulo} · {dataCurta(p.inicio)} a {dataCurta(p.fim)}
                  </p>
                  <h2 className="text-section-title text-foreground mt-2 truncate">{p.nome}</h2>
                  <p className="text-caption text-muted truncate">{p.empresa}</p>
                  <p className="numero text-metric-sm text-foreground mt-3">
                    {p.status === "ativo" || p.status === "planejado" ? rotuloDoDia(d.dia, d.total) : `${p.dias_registrados} dias registrados`}
                  </p>
                  {p.ultimo && (
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-caption">
                      <div className="min-w-0">
                        <dt className="text-muted truncate">Último acesso</dt>
                        <dd className="numero text-foreground truncate">{haQuanto(p.ultimo.ultimo_acesso)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted truncate">Ativos no dia</dt>
                        <dd className="numero text-foreground">{p.ultimo.usuarios_ativos ?? "—"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted truncate">Vendas no dia</dt>
                        <dd className="numero text-foreground truncate">{formatCurrency(Number(p.ultimo.valor ?? 0))}</dd>
                      </div>
                    </dl>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
