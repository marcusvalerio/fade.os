import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBusinessDate, businessToday } from "@/lib/time";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { isCompanyManager, getOwnProfessionalId } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Vazio, Aviso } from "@/components/ui/estado";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { rotularHomonimos } from "@/lib/pessoas";
import { limitesDoMes, mesValido, rotuloDoMes } from "@/lib/mes";
import { MarkPaidButton } from "./MarkPaidButton";
import { PagarPendentes } from "./PagarPendentes";
import { cn } from "@/lib/cn";

type Resumo = {
  professional_id: string;
  professional_name: string;
  pendente: number;
  pendente_qtd: number;
  gerado: number;
  pago: number;
  revertido: number;
};

const STATUS: Record<string, { rotulo: string; quadrado: string }> = {
  predicted: { rotulo: "Prevista", quadrado: "border border-border-strong" },
  due: { rotulo: "A pagar", quadrado: "bg-warning" },
  paid: { rotulo: "Paga", quadrado: "bg-success" },
  reversed: { rotulo: "Revertida", quadrado: "bg-danger" },
};

/**
 * Comissões por pessoa, não por ranking: quanto cada um tem a receber agora
 * (pendente, de qualquer mês), quanto gerou e quanto recebeu no mês. A
 * ordem é alfabética de propósito. Os lançamentos aparecem ao abrir uma
 * pessoa — a lista crua de tudo não responde nenhuma pergunta.
 */
export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; profissional?: string }>;
}) {
  const sp = await searchParams;
  const current = await getCurrentCompany();
  const companyId = current!.company.id;
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const hoje = businessToday();
  const mes = mesValido(sp.mes, hoje);
  const { de, ate, anterior, seguinte } = limitesDoMes(mes);
  const noMesAtual = mes === hoje.slice(0, 7);

  const manager = await isCompanyManager(companyId);
  const ownProfessionalId = manager ? null : await getOwnProfessionalId(companyId, user.id);

  if (!manager && !ownProfessionalId) {
    return (
      <div className="max-w-2xl">
        <PageHeader eyebrow="Negócio" title="Comissões" />
        <Vazio titulo="Nenhum perfil de profissional vinculado" descricao="Sua conta ainda não está ligada a um profissional desta empresa." />
      </div>
    );
  }

  const { data: resumoBruto, error } = await supabase.rpc("get_commission_summary", {
    p_company_id: companyId,
    p_from: de.toISOString(),
    p_to: ate.toISOString(),
  });
  const resumo = ((resumoBruto ?? []) as Resumo[])
    .map((r) => ({ ...r, pendente: Number(r.pendente), gerado: Number(r.gerado), pago: Number(r.pago), revertido: Number(r.revertido) }))
    .filter((r) => manager || r.professional_id === ownProfessionalId);

  const totais = resumo.reduce(
    (t, r) => ({ pendente: t.pendente + r.pendente, gerado: t.gerado + r.gerado, pago: t.pago + r.pago, revertido: t.revertido + r.revertido }),
    { pendente: 0, gerado: 0, pago: 0, revertido: 0 }
  );

  // Homônimos: pagar a pessoa errada é erro de dinheiro.
  const { data: equipe } = await supabase
    .from("professional")
    .select("id, name, phone:phone_last4, role_title")
    .in("id", resumo.map((r) => r.professional_id).concat(ownProfessionalId ?? []));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomes = new Map(rotularHomonimos((equipe ?? []) as any[]).map((p) => [p.id, p.name]));

  const aberto = manager ? (sp.profissional && resumo.some((r) => r.professional_id === sp.profissional) ? sp.profissional : null) : ownProfessionalId;

  // Lançamentos de uma pessoa: tudo o que está a pagar + o que aconteceu no mês.
  let lancamentos: {
    id: string;
    base_amount: number;
    percent: number;
    amount: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    sale_item: { service: { name: string } | null; product: { name: string } | null } | null;
  }[] = [];
  if (aberto) {
    const { data } = await supabase
      .from("commission")
      .select("id, base_amount, percent, amount, status, created_at, paid_at, sale_item:sale_item_id(service:service_id(name), product:product_id(name))")
      .eq("company_id", companyId)
      .eq("professional_id", aberto)
      .or(`status.eq.due,and(created_at.gte.${de.toISOString()},created_at.lt.${ate.toISOString()}),and(paid_at.gte.${de.toISOString()},paid_at.lt.${ate.toISOString()})`)
      .order("created_at", { ascending: false })
      .limit(500);
    lancamentos = (data ?? []) as unknown as typeof lancamentos;
  }
  const idsPendentes = lancamentos.filter((l) => l.status === "due").map((l) => l.id);
  const qs = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (mes !== hoje.slice(0, 7)) p.set("mes", mes);
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `/comissoes?${s}` : "/comissoes";
  };

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Negócio"
        title={manager ? "Comissões" : "Minhas comissões"}
        description={manager ? "Quanto cada pessoa tem a receber agora, e o que foi gerado e pago no mês." : "O que você tem a receber e o que já recebeu."}
        action={
          manager ? (
            <Link href="/profissionais" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Ver equipe
            </Link>
          ) : undefined
        }
      />

      {error && <Aviso tom="erro">Não foi possível carregar as comissões.</Aviso>}

      <nav aria-label="Mês" className="flex items-center gap-2">
        <Link href={qs({ mes: anterior, profissional: aberto && manager ? aberto : null })} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label="Mês anterior">
          ←
        </Link>
        <p className="font-subtitle text-body text-foreground min-w-40 text-center">{rotuloDoMes(mes)}</p>
        {!noMesAtual ? (
          <Link
            href={qs({ mes: seguinte === hoje.slice(0, 7) ? null : seguinte, profissional: aberto && manager ? aberto : null })}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
            aria-label="Mês seguinte"
          >
            →
          </Link>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </nav>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        {[
          { r: "A pagar agora", v: totais.pendente, nota: "de qualquer mês", destaque: true },
          { r: "Gerado no mês", v: totais.gerado, nota: "atendimentos e vendas fechados" },
          { r: "Pago no mês", v: totais.pago, nota: "pagamentos registrados" },
          { r: "Revertido no mês", v: totais.revertido, nota: "vendas canceladas" },
        ].map((f) => (
          <div key={f.r} className="bg-surface p-4 sm:p-5">
            <dt className="font-subtitle text-caption text-muted">{f.r}</dt>
            <dd className={cn("numero mt-1 text-foreground", f.destaque ? "text-metric" : "text-section-title")}>{formatCurrency(f.v)}</dd>
            <dd className="text-micro text-muted mt-0.5">{f.nota}</dd>
          </div>
        ))}
      </dl>

      {manager && (
        <section aria-labelledby="por-pessoa">
          <h2 id="por-pessoa" className="text-section-title text-foreground mb-3">
            Por pessoa
          </h2>
          {resumo.length === 0 ? (
            <div className="painel">
              <Vazio titulo="Nenhuma comissão ainda" descricao="Comissões são geradas quando um atendimento ou uma venda com profissional é fechado." />
            </div>
          ) : (
            <div className="painel overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="text-left font-subtitle text-caption text-muted border-b border-border">
                    <th className="px-4 py-2.5 font-normal">Pessoa</th>
                    <th className="px-4 py-2.5 font-normal text-right">A pagar</th>
                    <th className="px-4 py-2.5 font-normal text-right hidden sm:table-cell">Gerado no mês</th>
                    <th className="px-4 py-2.5 font-normal text-right hidden sm:table-cell">Pago no mês</th>
                    <th className="px-4 py-2.5 font-normal hidden sm:table-cell">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resumo.map((r) => {
                    const nome = nomes.get(r.professional_id) ?? r.professional_name;
                    const ativo = aberto === r.professional_id;
                    return (
                      <tr key={r.professional_id} className={cn(ativo && "bg-surface-muted")}>
                        <td className="px-4 py-3">
                          <Link href={ativo ? qs({ profissional: null }) : qs({ profissional: r.professional_id })} className="font-medium text-foreground hover:underline underline-offset-4" aria-expanded={ativo}>
                            {nome}
                          </Link>
                          <span className="block sm:hidden text-caption text-muted numero">
                            gerou {formatCurrency(r.gerado)} · pago {formatCurrency(r.pago)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right numero">
                          <span className={r.pendente > 0 ? "text-foreground" : "text-muted"}>{formatCurrency(r.pendente)}</span>
                          {r.pendente_qtd > 0 && <span className="block text-micro text-muted">{r.pendente_qtd} {r.pendente_qtd === 1 ? "lançamento" : "lançamentos"}</span>}
                        </td>
                        <td className="px-4 py-3 text-right numero text-muted hidden sm:table-cell">{formatCurrency(r.gerado)}</td>
                        <td className="px-4 py-3 text-right numero text-muted hidden sm:table-cell">{formatCurrency(r.pago)}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <Link href={ativo ? qs({ profissional: null }) : qs({ profissional: r.professional_id })} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                            {ativo ? "Fechar" : "Detalhes"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {aberto && (
        <section aria-labelledby="lancamentos" id="lancamentos-sec">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <h2 id="lancamentos" className="text-section-title text-foreground">
                {manager ? nomes.get(aberto) ?? "Lançamentos" : "Seus lançamentos"}
              </h2>
              <p className="text-caption text-muted mt-0.5">Tudo o que está a pagar, e o que foi gerado ou pago em {rotuloDoMes(mes).toLowerCase()}.</p>
            </div>
            {manager && idsPendentes.length > 0 && (
              <PagarPendentes
                companyId={companyId}
                professionalId={aberto}
                nome={nomes.get(aberto) ?? "profissional"}
                ids={idsPendentes}
                total={lancamentos.filter((l) => l.status === "due").reduce((s, l) => s + Number(l.amount), 0)}
              />
            )}
          </div>
          <div className="painel divide-y divide-border">
            {lancamentos.length === 0 ? (
              <Vazio titulo="Nada neste mês" descricao="Nenhum lançamento a pagar e nada gerado ou pago no mês escolhido." />
            ) : (
              lancamentos.map((c) => {
                const s = STATUS[c.status] ?? { rotulo: c.status, quadrado: "border border-border-strong" };
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-body-sm text-foreground">{c.sale_item?.service?.name ?? c.sale_item?.product?.name ?? "Venda"}</p>
                      <p className="text-caption text-muted mt-0.5 numero">
                        {c.percent}% de {formatCurrency(c.base_amount)} · {formatBusinessDate(c.created_at, { day: "2-digit", month: "short" })}
                        {c.paid_at && ` · paga em ${formatBusinessDate(c.paid_at, { day: "2-digit", month: "short" })}`}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-caption text-muted">
                        <span aria-hidden="true" className={cn("size-1.5", s.quadrado)} />
                        {s.rotulo}
                      </span>
                      <span className={cn("numero text-body-sm", c.status === "reversed" ? "text-muted line-through" : "text-foreground")}>{formatCurrency(c.amount)}</span>
                      {manager && c.status === "due" && <MarkPaidButton commissionId={c.id} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
