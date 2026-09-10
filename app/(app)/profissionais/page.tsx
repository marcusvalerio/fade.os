import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/current-company";
import { isCompanyManager } from "@/lib/permissions";
import { toggleProfessionalActive } from "@/actions/profissionais";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { rotularHomonimos } from "@/lib/pessoas";
import type { Professional } from "@/lib/types";

export default async function ProfissionaisPage() {
  const current = await getCurrentCompany();
  // Catálogo e equipe são administração, não operação. O banco já recusa a
  // escrita para quem não é owner/admin (RLS + trigger assert_admin_write);
  // esta tela deixa de oferecer o que não vai funcionar, no mesmo formato de
  // Financeiro, Relatórios e Configurações.
  if (!(await isCompanyManager(current!.company.id))) {
    return (
      <div>
        <PageHeader title="Profissionais" />
        <EmptyState
          title="Acesso restrito"
          description="Esta área é visível apenas para o responsável e gerentes da empresa."
        />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: professionals } = await supabase
    .from("professional")
    .select("*")
    .eq("company_id", current!.company.id)
    .order("name");

  // Esta linha carrega o botão que ativa e desativa o profissional, e o
  // subtítulo é a função — que some ("Sem função definida") justamente quando
  // ninguém preencheu. Dois homônimos sem função ficavam idênticos na tela em
  // que se aperta o botão. Foi assim que, numa rodada de QA, o profissional
  // errado foi desativado.
  const nomes = new Map(
    rotularHomonimos((professionals as Professional[] | null) ?? []).map((p) => [p.id, p.name])
  );

  return (
    <div>
      <PageHeader
        title="Profissionais"
        description="Quem realiza os serviços da barbearia — cadastro, jornada e comissão de cada um."
        action={
          <div className="flex items-center gap-4">
            <Link href="/comissoes" className="text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard">
              Ver comissões
            </Link>
            <Link href="/profissionais/novo" className={buttonClasses()}>
              Novo profissional
            </Link>
          </div>
        }
      />

      <Surface>
        {(professionals as Professional[] | null)?.length ? (
          (professionals as Professional[]).map((p) => (
            <SurfaceRow key={p.id} className="flex items-center justify-between gap-3">
              <Link href={`/profissionais/${p.id}`} className="flex items-center gap-3 text-body-sm min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="size-9 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="size-9 rounded-full bg-surface-muted shrink-0 flex items-center justify-center text-caption text-muted">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <p className="font-medium text-foreground truncate">{nomes.get(p.id) ?? p.name}</p>
                  <p className="text-caption text-muted mt-0.5 truncate">
                    {p.role_title || "Sem função definida"}
                  </p>
                </span>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await toggleProfessionalActive(p.id, !p.active);
                }}
              >
                <button type="submit">
                  <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                </button>
              </form>
            </SurfaceRow>
          ))
        ) : (
          <EmptyState
            title="Nenhum profissional cadastrado ainda"
            description="Cadastre quem realiza os atendimentos para começar a montar a agenda."
            action={
              <Link href="/profissionais/novo" className={buttonClasses({ variant: "secondary" })}>
                Novo profissional
              </Link>
            }
          />
        )}
      </Surface>
    </div>
  );
}
