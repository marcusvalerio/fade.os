import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso } from "@/components/ui/estado";
import { createClient } from "@/lib/supabase/server";
import { ExigenciaDeSessao } from "./ExigenciaDeSessao";

/**
 * Configurações de PLATAFORMA — nada aqui edita nada de uma empresa
 * específica (isso mora em /configuracoes, dentro do produto operacional,
 * fora desta superfície). Não existe uma tabela `platform_settings`: o
 * que aparece abaixo é informativo (ambiente, projeto), lido de variáveis
 * já públicas — nenhum segredo, nenhum formulário que finge salvar algo
 * que não persiste em lugar nenhum. A exceção é a exigência de sessão
 * administrativa, que mora em `plataforma_ajuste` e só muda pela função
 * `admin_exigir_sessao` (auditada).
 */
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: exigida } = await supabase.rpc("admin_sessao_obrigatoria");
  const environment = process.env.NODE_ENV;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "não configurado";

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Configurações da plataforma — não da empresa." />

      <Aviso tom="atencao">
        Isto é diferente de Configurações dentro do produto operacional, que pertence a cada
        empresa (barbearia).
      </Aviso>

      <section>
        <p className="text-label uppercase tracking-label text-muted mb-3">Sessão administrativa</p>
        <Surface>
          <SurfaceRow className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <p className="text-body-sm text-foreground font-medium">
                Exigência no banco: {exigida === true ? "ligada" : "desligada (modo compatível)"}
              </p>
              <p className="text-caption text-muted mt-1">
                No app, o Admin já exige a sessão aberta em /admin/login (8 h). No banco, a exigência fica desligada até
                esta versão chegar à produção, para o Admin atual continuar funcionando. Depois do merge, ligue aqui.
              </p>
            </div>
            <ExigenciaDeSessao ligada={exigida === true} />
          </SurfaceRow>
        </Surface>
      </section>

      <section>
        <p className="text-label uppercase tracking-label text-muted mb-3">Ambiente</p>
        <Surface>
          <SurfaceRow className="flex items-center justify-between gap-4">
            <span className="text-body-sm text-foreground">Ambiente de execução</span>
            <span className="text-body-sm text-muted">{environment}</span>
          </SurfaceRow>
          <SurfaceRow className="flex items-center justify-between gap-4">
            <span className="text-body-sm text-foreground">Projeto Supabase</span>
            <span className="text-body-sm text-muted truncate max-w-[60%] text-right">{supabaseUrl}</span>
          </SurfaceRow>
        </Surface>
      </section>
    </div>
  );
}
