import { Aviso } from "@/components/ui/estado";

/**
 * A forma compartilhada de "esta seção não tem backend ainda" — cabeçalho
 * real da tabela que a área terá, zero linhas fabricadas, e uma frase
 * explícita sobre por que não há dado. Uma peça só, reaproveitada por
 * Erros/Webhooks/Jobs em vez de três tabelas quase idênticas.
 */
export function UnavailableTable({ columns, note }: { columns: string[]; note: string }) {
  return (
    <div className="space-y-4">
      <Aviso tom="atencao">{note}</Aviso>
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-body-sm min-w-[640px]">
          <thead>
            <tr className="bg-surface-muted text-left">
              {columns.map((c) => (
                <th key={c} scope="col" className="px-4 py-2.5 text-label uppercase text-muted font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                Nenhum dado disponível.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
