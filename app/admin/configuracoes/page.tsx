import { PageHeader } from "@/components/ui/page-header";
import { Surface, SurfaceRow } from "@/components/ui/surface";
import { Aviso } from "@/components/ui/estado";

/**
 * Configurações de PLATAFORMA — nada aqui edita nada de uma empresa
 * específica (isso mora em /configuracoes, dentro do produto operacional,
 * fora desta superfície). Não existe uma tabela `platform_settings`: o
 * que aparece abaixo é informativo (ambiente, projeto), lido de variáveis
 * já públicas — nenhum segredo, nenhum formulário que finge salvar algo
 * que não persiste em lugar nenhum.
 */
export default function AdminSettingsPage() {
  const environment = process.env.NODE_ENV;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "não configurado";

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Configurações da plataforma — não da empresa." />

      <Aviso tom="atencao">
        Isto é diferente de Configurações dentro do produto operacional, que pertence a cada
        empresa (barbearia). Não existe hoje uma tabela de configurações editáveis da
        plataforma — esta página é informativa; nenhum campo abaixo é salvo em lugar nenhum.
      </Aviso>

      <section>
        <p className="text-label uppercase tracking-[0.1em] text-muted mb-3">Ambiente</p>
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
