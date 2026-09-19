import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso, Vazio } from "@/components/ui/estado";

type CompanyUsageRow = { id: string; name: string; user_count: number; professional_count: number };

/**
 * "Requests/API usage/storage" não existem como telemetria — nenhuma
 * contagem de chamada de API ou uso de armazenamento é registrada hoje.
 * O que É real e já vem de `admin_list_companies()` são contagens de uso
 * operacional por empresa (usuários, profissionais) — mostradas aqui sob
 * o nome que já têm, não reescritas como "requests" para parecer mais.
 */
export default async function AdminUsagePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_companies");
  const companies = ((data ?? []) as CompanyUsageRow[]).sort((a, b) => b.user_count - a.user_count);

  return (
    <div className="space-y-6">
      <PageHeader title="Uso" description="Uso operacional por empresa." />

      <Aviso tom="atencao">
        Não há telemetria de requests, uso de banco, storage, e-mails ou consumo de API por
        tenant — nada disso é registrado hoje. O que existe é a contagem de usuários e
        profissionais por empresa, abaixo.
      </Aviso>

      {error ? (
        <Vazio titulo="Não foi possível carregar o uso por empresa" descricao={error.message} />
      ) : companies.length === 0 ? (
        <Vazio titulo="Nenhuma empresa cadastrada ainda" />
      ) : (
        <Surface>
          {companies.map((c) => (
            <SurfaceRow key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="text-body-sm text-foreground truncate">{c.name}</span>
              <span className="text-caption text-muted tabular-nums shrink-0">
                {c.user_count} usuário(s) · {c.professional_count} profissional(is)
              </span>
            </SurfaceRow>
          ))}
        </Surface>
      )}
    </div>
  );
}
